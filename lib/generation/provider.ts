import {
  PAID_PROVIDER_MODELS,
  PROVIDER_REQUEST_TIMEOUT_MS,
  providerFor,
  type GenerationKind,
  type GenerationTier,
  type MediaType,
} from "./config";
import { GenerationError } from "./errors";

export type ProviderName = "replicate" | "fal";

export interface ProviderSubmission {
  provider: ProviderName;
  model: string;
  requestId: string;
  statusUrl?: string;
  responseUrl?: string;
}

export type ProviderPoll =
  | { state: "processing" }
  | { state: "succeeded"; result: { url: string; mediaType: MediaType } }
  | { state: "failed" };

export class ProviderRejectedError extends Error {
  constructor() { super("provider rejected request"); this.name = "ProviderRejectedError"; }
}
export class ProviderUnavailableError extends Error {
  constructor() { super("provider unavailable"); this.name = "ProviderUnavailableError"; }
}
export class ProviderProtocolError extends Error {
  constructor() { super("provider protocol error"); this.name = "ProviderProtocolError"; }
}

export async function submitGeneration(kind: GenerationKind, prompt: string, sourceImageUrl?: string): Promise<ProviderSubmission> {
  return submitWithProvider(kind, prompt, sourceImageUrl, "free");
}

/** Payment code may call this only after it has independently reserved credit. */
export async function submitPaidGeneration(kind: GenerationKind, prompt: string, sourceImageUrl?: string): Promise<ProviderSubmission> {
  return submitWithProvider(kind, prompt, sourceImageUrl, "paid");
}

async function submitWithProvider(kind: GenerationKind, prompt: string, sourceImageUrl: string | undefined, tier: GenerationTier): Promise<ProviderSubmission> {
  const provider = providerFor(kind, tier);
  const token = process.env[provider.provider === "replicate" ? "REPLICATE_API_KEY" : "FAL_API_KEY"];
  if (!token) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  if (kind === "edit" && (!sourceImageUrl || !isAllowedFalStorageUrl(sourceImageUrl))) throw new ProviderProtocolError();

  const kontextVersion = kind === "edit" && tier === "free" && provider.provider === "replicate" && "modelInfoUrl" in provider
    ? await resolveReplicateModelVersion(provider.modelInfoUrl, headersFor("replicate", token))
    : undefined;
  const body = kind === "edit" && tier === "paid"
    ? { image_url: sourceImageUrl, prompt, num_images: 1, output_format: "png", safety_tolerance: "2", enhance_prompt: false }
    : kind === "image"
      ? { input: { prompt, num_outputs: 1, output_format: "webp" } }
      : kind === "edit"
        ? { version: kontextVersion, input: { prompt, input_image: sourceImageUrl } }
        : tier === "paid"
          ? { prompt, duration: "5", aspect_ratio: "16:9", negative_prompt: "", cfg_scale: 7 }
          : { prompt, duration: "5", resolution: "480p", aspect_ratio: "16:9", enable_prompt_expansion: false, enable_safety_checker: true };
  const headers = headersFor(provider.provider, token);
  const submitUrl = kontextVersion ? "https://api.replicate.com/v1/predictions" : provider.submitUrl;
  const response = await providerFetch(submitUrl, { method: "POST", headers, body: JSON.stringify(body) });
  if (response.kind === "reject") throw new ProviderRejectedError();
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (!isRecord(response.payload)) throw new ProviderProtocolError();
  const requestId = provider.provider === "replicate" ? response.payload.id : response.payload.request_id;
  if (typeof requestId !== "string" || !requestId || requestId.length > 256) throw new ProviderProtocolError();
  if (provider.provider === "fal") {
    const returnedStatus = typeof response.payload.status_url === "string" ? response.payload.status_url : undefined;
    const returnedResponse = typeof response.payload.response_url === "string" ? response.payload.response_url : undefined;
    return {
      provider: provider.provider,
      model: provider.model,
      requestId,
      statusUrl: validateFalQueueUrl(returnedStatus, requestId, "status", provider.model) ?? falQueueUrl(requestId, "status", provider.model),
      responseUrl: validateFalQueueUrl(returnedResponse, requestId, "response", provider.model) ?? falQueueUrl(requestId, "response", provider.model),
    };
  }
  return { provider: provider.provider, model: provider.model, requestId };
}

function headersFor(provider: ProviderName, token: string): Record<string, string> {
  return provider === "replicate"
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { Authorization: `Key ${token}`, "Content-Type": "application/json" };
}

async function resolveReplicateModelVersion(modelInfoUrl: string, headers: HeadersInit): Promise<string> {
  const response = await providerFetch(modelInfoUrl, { method: "GET", headers });
  if (response.kind === "reject") throw new ProviderRejectedError();
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (!isRecord(response.payload)) throw new ProviderProtocolError();
  const latest = response.payload.latest_version;
  const version = typeof latest === "string" ? latest : isRecord(latest) && typeof latest.id === "string" ? latest.id : undefined;
  if (!version || !/^[0-9a-f]{64}$/i.test(version)) throw new ProviderProtocolError();
  return version;
}

export async function pollGeneration(provider: ProviderName, requestId: string, kind: GenerationKind, options?: { statusUrl?: string; responseUrl?: string; model?: string }): Promise<ProviderPoll> {
  const token = process.env[provider === "replicate" ? "REPLICATE_API_KEY" : "FAL_API_KEY"];
  if (!token) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  const safeId = encodeURIComponent(requestId);
  const headers = provider === "replicate" ? { Authorization: `Bearer ${token}` } : { Authorization: `Key ${token}` };
  const url = provider === "replicate"
    ? `https://api.replicate.com/v1/predictions/${safeId}`
    : validateFalQueueUrl(options?.statusUrl, requestId, "status", options?.model) ?? falQueueUrl(requestId, "status", options?.model);
  const response = await providerFetch(url, { method: "GET", headers });
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (response.kind === "reject") throw new ProviderProtocolError();
  if (!isRecord(response.payload)) throw new ProviderProtocolError();
  if (provider === "replicate") return parseReplicatePoll(response.payload, kind);
  return parseFalPoll(response.payload, kind, requestId, headers, options);
}

type FetchResult = { kind: "ok"; payload: unknown } | { kind: "reject" } | { kind: "unavailable" };

async function providerFetch(url: string, init: RequestInit): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store", redirect: "error" });
    if (response.status >= 400 && response.status < 500) return { kind: "reject" };
    if (!response.ok) return { kind: "unavailable" };
    const bytes = await readResponseBytes(response, 128 * 1024);
    if (!bytes) return { kind: "unavailable" };
    try { return { kind: "ok", payload: JSON.parse(new TextDecoder().decode(bytes)) }; } catch { return { kind: "unavailable" }; }
  } catch { return { kind: "unavailable" }; } finally { clearTimeout(timeout); }
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

function parseReplicatePoll(payload: Record<string, unknown>, kind: GenerationKind): ProviderPoll {
  const status = payload.status;
  if (status === "starting" || status === "processing") return { state: "processing" };
  if (status === "failed" || status === "canceled") return { state: "failed" };
  if (status !== "succeeded") throw new ProviderProtocolError();
  const url = firstUrl(payload.output);
  if (!url || !isAllowedCdnUrl(url, "replicate")) throw new ProviderProtocolError();
  return { state: "succeeded", result: { url, mediaType: kind === "video" ? "video" : "image" } };
}

async function parseFalPoll(payload: Record<string, unknown>, kind: GenerationKind, requestId: string, headers: HeadersInit, options?: { statusUrl?: string; responseUrl?: string; model?: string }): Promise<ProviderPoll> {
  const status = payload.status ?? (isRecord(payload.data) ? payload.data.status : undefined);
  if (status === "IN_QUEUE" || status === "IN_PROGRESS" || status === "QUEUED" || status === "PROCESSING") return { state: "processing" };
  if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") return { state: "failed" };
  if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
    const statusData = isRecord(payload.data) ? payload.data : undefined;
    if (payload.error != null || payload.error_type != null || statusData?.error != null || statusData?.error_type != null) return { state: "failed" };
    const responseUrl = validateFalQueueUrl(options?.responseUrl, requestId, "response", options?.model) ?? falQueueUrl(requestId, "response", options?.model);
    const response = await providerFetch(responseUrl, { method: "GET", headers });
    if (response.kind === "unavailable") throw new ProviderUnavailableError();
    if (response.kind === "reject" || !isRecord(response.payload)) throw new ProviderProtocolError();
    const completedUrl = firstUrlFromFalResult(response.payload);
    if (!completedUrl || !isAllowedCdnUrl(completedUrl, "fal")) throw new ProviderProtocolError();
    return { state: "succeeded", result: { url: completedUrl, mediaType: kind === "video" ? "video" : "image" } };
  }
  const url = firstUrlFromFalResult(payload);
  if (url && isAllowedCdnUrl(url, "fal")) return { state: "succeeded", result: { url, mediaType: kind === "video" ? "video" : "image" } };
  throw new ProviderProtocolError();
}

function firstUrlFromFalResult(payload: Record<string, unknown>): string | undefined {
  const data = isRecord(payload.data) ? payload.data : undefined;
  return firstUrl(payload.video ?? payload.video_url ?? payload.image ?? payload.image_url ?? payload.images ?? data?.video ?? data?.video_url ?? data?.image ?? data?.image_url ?? data?.images ?? payload.output);
}

function firstUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) { for (const entry of value) { const result = firstUrl(entry); if (result) return result; } return undefined; }
  if (isRecord(value)) for (const key of ["url", "download_url", "video_url", "image_url"]) if (typeof value[key] === "string") return value[key] as string;
  return undefined;
}

export function isAllowedCdnUrl(value: string, provider: ProviderName): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
    const host = parsed.hostname.toLowerCase();
    if (provider === "replicate") return host === "replicate.delivery" || host.endsWith(".replicate.delivery");
    return host === "fal.media" || host.endsWith(".fal.media") || host === "fal.ai" || host.endsWith(".fal.ai") || host === "storage.googleapis.com";
  } catch { return false; }
}

export function isAllowedFalStorageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
    const host = parsed.hostname.toLowerCase();
    return host === "fal.media" || host.endsWith(".fal.media") || host === "storage.googleapis.com";
  } catch { return false; }
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }

function falQueuePaths(model: string | undefined): string[] {
  const known = [providerFor("video").model, PAID_PROVIDER_MODELS.edit.model, PAID_PROVIDER_MODELS.video.model];
  if (!model || !known.includes(model as typeof known[number])) return ["fal-ai/wan-25-preview"];
  if (model === providerFor("video").model) return ["fal-ai/wan-25-preview", model];
  if (model === PAID_PROVIDER_MODELS.edit.model) return ["fal-ai/flux-pro", model];
  return ["fal-ai/kling-video/v2.5-turbo/pro", model];
}

function falQueueUrl(requestId: string, kind: "status" | "response", model?: string): string {
  const encoded = encodeURIComponent(requestId);
  const path = falQueuePaths(model)[0];
  return kind === "status" ? `https://queue.fal.run/${path}/requests/${encoded}/status` : `https://queue.fal.run/${path}/requests/${encoded}`;
}

function validateFalQueueUrl(value: string | undefined, requestId: string, kind: "status" | "response", model?: string): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname !== "queue.fal.run" || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return undefined;
    const expectedId = encodeURIComponent(requestId);
    const prefix = falQueuePaths(model).find((candidate) => parsed.pathname.startsWith(`/${candidate}/requests/`));
    if (!prefix) return undefined;
    const suffix = parsed.pathname.slice(`/${prefix}/requests/`.length);
    if (kind === "status" && suffix !== `${expectedId}/status`) return undefined;
    if (kind === "response" && suffix !== expectedId) return undefined;
    return parsed.toString();
  } catch { return undefined; }
}
