import { createHash, randomUUID } from "node:crypto";
import { fal } from "@fal-ai/client";
import sharp from "sharp";
import {
  ASSET_TTL_SECONDS,
  MAX_UPLOAD_BYTES,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_COUNT,
  UPLOAD_WINDOW_SECONDS,
} from "./config";
import { GenerationError, storageError } from "./errors";
import { isAllowedFalStorageUrl } from "./provider";
import { UPLOAD_RESERVE_SCRIPT } from "./scripts";
import type { RedisLike } from "./redis";

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type AllowedUploadType = typeof ALLOWED_UPLOAD_TYPES[number];

export interface AssetRecord {
  assetId: string;
  ownerId: string;
  ipHash: string;
  contentType: AllowedUploadType;
  size: number;
  status: "pending" | "validated";
  uploadUrl: string;
  fileUrl?: string;
  url?: string;
  sha256?: string;
  createdAt: string;
}

export function keyForAsset(assetId: string): string { return `ovanto:asset:${assetId}`; }
export function keyForUploadCount(ipHash: string): string { return `ovanto:upload:count:${ipHash}`; }
export function keyForUploadBytes(ipHash: string): string { return `ovanto:upload:bytes:${ipHash}`; }
export function keyForAssetCompletionLock(assetId: string): string { return `ovanto:asset-lock:${assetId}`; }

const RELEASE_ASSET_LOCK_SCRIPT = String.raw`
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export function extensionForUploadType(contentType: AllowedUploadType): string {
  return contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length);
}

export function isAllowedUploadType(value: unknown): value is AllowedUploadType {
  return typeof value === "string" && (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(value);
}

export function isValidUploadSize(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_UPLOAD_BYTES;
}

export async function reserveUpload(redis: RedisLike, ipHash: string, size: number): Promise<void> {
  const result = await redis.eval<string[]>(UPLOAD_RESERVE_SCRIPT, [keyForUploadCount(ipHash), keyForUploadBytes(ipHash)], [String(UPLOAD_MAX_COUNT), String(UPLOAD_MAX_BYTES), String(size), String(UPLOAD_WINDOW_SECONDS)]);
  if (!Array.isArray(result) || typeof result[0] !== "string") throw storageError();
  if (result[0] === "LIMIT") throw new GenerationError("UPLOAD_RATE_LIMITED", 429, "Upload rate limit reached for technical protection. Try again later.");
  if (result[0] !== "RESERVED") throw storageError();
}

export async function saveAsset(redis: RedisLike, asset: AssetRecord): Promise<void> {
  await redis.command(["SET", keyForAsset(asset.assetId), JSON.stringify(asset), "EX", String(ASSET_TTL_SECONDS)]);
}

export async function acquireAssetCompletionLock(redis: RedisLike, assetId: string): Promise<string> {
  const token = randomUUID();
  const result = await redis.command(["SET", keyForAssetCompletionLock(assetId), token, "EX", "60", "NX"]);
  if (result !== "OK") throw new GenerationError("UPLOAD_IN_PROGRESS", 409, "Upload validation is already in progress. Try again.");
  return token;
}

export async function releaseAssetCompletionLock(redis: RedisLike, assetId: string, token: string): Promise<void> {
  await redis.eval(RELEASE_ASSET_LOCK_SCRIPT, [keyForAssetCompletionLock(assetId)], [token]);
}

export async function getAsset(redis: RedisLike, assetId: string): Promise<AssetRecord | null> {
  const raw = await redis.get(keyForAsset(assetId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AssetRecord>;
    if (!parsed || typeof parsed !== "object" || parsed.assetId !== assetId || typeof parsed.ownerId !== "string" || typeof parsed.ipHash !== "string" || !isAllowedUploadType(parsed.contentType) || !isValidUploadSize(parsed.size) || (parsed.status !== "pending" && parsed.status !== "validated") || typeof parsed.uploadUrl !== "string" || typeof parsed.createdAt !== "string") return null;
    return parsed as AssetRecord;
  } catch { return null; }
}

export async function getOwnedValidatedAsset(redis: RedisLike, assetId: string, ownerId: string, ipHash: string): Promise<AssetRecord> {
  const asset = await getAsset(redis, assetId);
  if (!asset || asset.status !== "validated" || asset.ownerId !== ownerId || asset.ipHash !== ipHash || !asset.url || !isAllowedFalStorageUrl(asset.url)) {
    throw new GenerationError("INVALID_ASSET", 400, "An uploaded image is required.");
  }
  return asset;
}

export async function initiateFalUpload(assetId: string, contentType: AllowedUploadType): Promise<{ uploadUrl: string; fileUrl?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
        "x-fal-object-lifecycle-preference": JSON.stringify({ expiration_duration_seconds: ASSET_TTL_SECONDS }),
      },
      body: JSON.stringify({ content_type: contentType, file_name: `${assetId}.${extensionForUploadType(contentType)}` }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
    const payload = await readJsonResponse(response, 32 * 1024);
    if (!isRecord(payload)) throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
    const uploadUrl = typeof payload.upload_url === "string" ? payload.upload_url : typeof payload.uploadUrl === "string" ? payload.uploadUrl : undefined;
    const fileUrl = typeof payload.file_url === "string" ? payload.file_url : typeof payload.fileUrl === "string" ? payload.fileUrl : undefined;
    if (!uploadUrl || !isAllowedFalStorageUrl(uploadUrl) || (fileUrl && !isAllowedFalStorageUrl(fileUrl))) throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
    return { uploadUrl, ...(fileUrl ? { fileUrl } : {}) };
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
  } finally { clearTimeout(timeout); }
}

export async function completeFalUpload(asset: AssetRecord): Promise<AssetRecord> {
  if (!asset.fileUrl || !isAllowedFalStorageUrl(asset.fileUrl)) throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
  const source = await fetchImageBytes(asset.fileUrl);
  if (source.bytes.byteLength !== asset.size) throw new GenerationError("INVALID_UPLOAD", 400, "Uploaded file size is invalid.");
  if (source.contentType !== asset.contentType) throw new GenerationError("INVALID_UPLOAD", 400, "Uploaded file type is invalid.");
  await validateImageBytes(source.bytes, asset.contentType);
  const key = process.env.FAL_KEY;
  if (!key) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  fal.config({ credentials: key });
  const fileBytes = new Uint8Array(source.bytes.byteLength);
  fileBytes.set(source.bytes);
  const file = new File([fileBytes.buffer], `${asset.assetId}.${extensionForUploadType(asset.contentType)}`, { type: asset.contentType });
  const uploaded = await fal.storage.upload(file, { lifecycle: { expiresIn: "1h" } });
  const url = typeof uploaded === "string" ? uploaded : undefined;
  if (!url || !isAllowedFalStorageUrl(url)) throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
  const completed: AssetRecord = { ...asset, status: "validated", url, sha256: createHash("sha256").update(source.bytes).digest("hex") };
  return completed;
}

export async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; contentType: AllowedUploadType }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: controller.signal });
    if (!response.ok || !response.body) throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (!isAllowedUploadType(contentType)) throw new GenerationError("INVALID_UPLOAD", 400, "Uploaded file type is invalid.");
    const declaredLength = response.headers.get("content-length");
    if (declaredLength && Number.isSafeInteger(Number(declaredLength)) && Number(declaredLength) > MAX_UPLOAD_BYTES) throw new GenerationError("INVALID_UPLOAD", 400, "Uploaded file is too large or incomplete.");
    const bytes = await readResponseBytes(response, MAX_UPLOAD_BYTES);
    if (!bytes) throw new GenerationError("INVALID_UPLOAD", 400, "Uploaded file is too large or incomplete.");
    return { bytes, contentType };
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("UPLOAD_UNAVAILABLE", 503, "Upload is temporarily unavailable.");
  } finally { clearTimeout(timeout); }
}

export async function validateImageBytes(bytes: Uint8Array, contentType: AllowedUploadType): Promise<void> {
  if (!hasMagic(bytes, contentType) || bytes.byteLength > MAX_UPLOAD_BYTES) throw new GenerationError("INVALID_UPLOAD", 400, "Uploaded file is invalid.");
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (metadata.format !== formatForType(contentType)) throw new Error("format mismatch");
    // Force a bounded decode, rather than trusting a header-only metadata parse.
    await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).toBuffer();
  } catch { throw new GenerationError("INVALID_UPLOAD", 400, "Uploaded file is invalid."); }
}

function formatForType(contentType: AllowedUploadType): string { return contentType === "image/jpeg" ? "jpeg" : contentType.slice("image/".length); }

function hasMagic(bytes: Uint8Array, contentType: AllowedUploadType): boolean {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (contentType === "image/gif") return bytes.length >= 6 && (new TextDecoder().decode(bytes.slice(0, 6)) === "GIF89a" || new TextDecoder().decode(bytes.slice(0, 6)) === "GIF87a");
  return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

async function readJsonResponse(response: Response, maxBytes: number): Promise<unknown> {
  const bytes = await readResponseBytes(response, maxBytes);
  if (!bytes) return null;
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
  } catch { try { await reader.cancel(); } catch { /* generic upstream failure */ } return null; }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }

export function newAssetId(): string { return randomUUID(); }
