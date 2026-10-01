import { cookies } from "next/headers";
import { getPaidSession } from "../../../lib/accounts/store";
import { ACCOUNT_SESSION_COOKIE } from "../../../lib/payments/config";
import { assertSessionConfiguration } from "../../../lib/payments/errors";
import { assertUploadRegion, assertSameSiteOrigin, getDailyIdentity } from "../../../lib/generation/identity";
import { GenerationError, errorResponse } from "../../../lib/generation/errors";
import { assertUploadConfig, noStoreJson } from "../../../lib/generation/http";
import { getRedis } from "../../../lib/generation/redis";
import { verifyTurnstile } from "../../../lib/generation/turnstile";
import {
  completeFalUpload,
  acquireAssetCompletionLock,
  getAsset,
  isAllowedUploadType,
  isValidUploadSize,
  initiateFalUpload,
  newAssetId,
  reserveUpload,
  releaseAssetCompletionLock,
  saveAsset,
  type AllowedUploadType,
  type AssetRecord,
} from "../../../lib/generation/asset";
import { ASSET_TTL_SECONDS, MAX_GENERATION_BODY_BYTES, MAX_UPLOAD_BYTES } from "../../../lib/generation/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel functions have a small incoming-body ceiling. The upload endpoint is
 * therefore an initiate/complete protocol: the browser sends the file directly
 * to the signed FAL URL, and this route only validates a bounded server fetch.
 */
export async function POST(request: Request) {
  try {
    assertSameSiteOrigin(request);
    const body = await readJsonBody(request);
    const keys = Object.keys(body).sort();
    const completeEndpoint = new URL(request.url).pathname.replace(/\/$/, "").endsWith("/uploads/complete");
    const cookieStore = await cookies();
    const identity = getDailyIdentity(request, cookieStore);
    const paidEditEntitled = await getPaidEditUploadEntitlement(request, cookieStore);
    assertUploadRegion(identity.country, paidEditEntitled);
    assertUploadConfig();
    const redis = getRedis();

    if (!completeEndpoint && keys.length === 3 && keys.join(",") === "contentType,size,turnstileToken") {
      const contentType = body.contentType;
      const size = body.size;
      const token = body.turnstileToken;
      if (!isAllowedUploadType(contentType) || !isValidUploadSize(size) || typeof token !== "string" || !token) {
        throw new GenerationError("INVALID_UPLOAD", 400, "Upload details are invalid.");
      }
      await verifyTurnstile(token, identity.ip);
      await reserveUpload(redis, identity.ipHash, size);
      const assetId = newAssetId();
      const initiated = await initiateFalUpload(assetId, contentType);
      const asset: AssetRecord = {
        assetId,
        ownerId: identity.ownerId,
        ipHash: identity.ipHash,
        contentType,
        size,
        status: "pending",
        uploadUrl: initiated.uploadUrl,
        ...(initiated.fileUrl ? { fileUrl: initiated.fileUrl } : {}),
        createdAt: new Date().toISOString(),
      };
      await saveAsset(redis, asset);
      return noStoreJson({ assetId, uploadUrl: initiated.uploadUrl, expiresIn: ASSET_TTL_SECONDS, maxBytes: MAX_UPLOAD_BYTES }, 201);
    }

    if (completeEndpoint && keys.length === 1 && keys[0] === "assetId") {
      if (typeof body.assetId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.assetId)) {
        throw new GenerationError("INVALID_ASSET", 400, "Uploaded image is invalid.");
      }
      let asset = await getAsset(redis, body.assetId.toLowerCase());
      if (!asset || asset.ownerId !== identity.ownerId || asset.ipHash !== identity.ipHash) {
        throw new GenerationError("INVALID_ASSET", 400, "Uploaded image is invalid.");
      }
      if (asset.status === "validated" && asset.url) return noStoreJson({ assetId: asset.assetId, url: asset.url }, 200);
      const lockToken = await acquireAssetCompletionLock(redis, asset.assetId);
      try {
        asset = await getAsset(redis, asset.assetId);
        if (!asset || asset.ownerId !== identity.ownerId || asset.ipHash !== identity.ipHash || asset.status !== "pending") {
          if (asset?.status === "validated" && asset.url) return noStoreJson({ assetId: asset.assetId, url: asset.url }, 200);
          throw new GenerationError("INVALID_ASSET", 400, "Uploaded image is invalid.");
        }
        const completed = await completeFalUpload(asset);
        await saveAsset(redis, completed);
        return noStoreJson({ assetId: completed.assetId, url: completed.url }, 200);
      } finally {
        await releaseAssetCompletionLock(redis, asset?.assetId ?? body.assetId.toLowerCase(), lockToken);
      }
    }

    throw new GenerationError("INVALID_REQUEST", 400, "Upload request is invalid.");
  } catch (error) {
    return errorResponse(error);
  }
}

async function getPaidEditUploadEntitlement(request: Request, cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<boolean> {
  // Free visitors never trigger account configuration checks or a database
  // read. A paid session is considered only when its cookie is present and it
  // still has an available edit credit; invalid or unavailable sessions fail
  // closed to the free-region policy.
  if (!cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value) return false;
  try {
    assertSessionConfiguration();
    const session = await getPaidSession(request);
    return Number(session?.balances.edit ?? 0) > 0;
  } catch {
    return false;
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > MAX_GENERATION_BODY_BYTES) {
    throw new GenerationError("REQUEST_TOO_LARGE", 413, "Request is too large.");
  }
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) throw new GenerationError("UNSUPPORTED_MEDIA_TYPE", 415, "Request must be JSON.");
  if (!request.body) throw new GenerationError("INVALID_JSON", 400, "Request body is invalid.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_GENERATION_BODY_BYTES) { await reader.cancel(); throw new GenerationError("REQUEST_TOO_LARGE", 413, "Request is too large."); }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("INVALID_JSON", 400, "Request body is invalid.");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed as Record<string, unknown>;
  } catch { throw new GenerationError("INVALID_JSON", 400, "Request body is invalid."); }
}
