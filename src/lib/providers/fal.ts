import { MODELS, modelFor, type GenerationTask, type ModelDefinition } from "../models";
import { PROVIDER_REQUEST_TIMEOUT_MS } from "../../../lib/generation/config";
import { GenerationError } from "../../../lib/generation/errors";
import {
  isAllowedCdnUrl,
  type GenerateOptions,
  type ProviderPoll,
  type ProviderSubmission,
  ProviderProtocolError,
  ProviderRejectedError,
  ProviderUnavailableError,
} from "./replicate";

export async function submitFal(model: ModelDefinition, options: GenerateOptions): Promise<ProviderSubmission> {
  if (model.provider !== "fal") throw new ProviderProtocolError();
  const token = process.env.FAL_KEY;
  if (!token) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  if (options.task === "edit" && (!options.sourceImageUrl || !isAllowedFalStorageUrl(options.sourceImageUrl))) {
    throw new ProviderProtocolError();
  }

  const input = options.task === "edit"
    ? {
        prompt: options.prompt,
        image_url: options.sourceImageUrl,
        num_images: 1,
        output_format: "png",
        safety_tolerance: "2",
        enhance_prompt: false,
      }
    : options.task === "video"
      ? model.resolution === undefined
        ? {
            prompt: options.prompt,
            duration: String(model.fixedSeconds),
            aspect_ratio: "16:9",
            negative_prompt: "",
            cfg_scale: 7,
          }
        : {
            prompt: options.prompt,
            duration: String(model.fixedSeconds),
            resolution: model.resolution,
            aspect_ratio: "16:9",
            enable_prompt_expansion: false,
            enable_safety_checker: true,
          }
      : undefined;
  if (!input) throw new ProviderProtocolError();

  const response = await providerFetch(
    `https://queue.fal.run/${model.slug}`,
    {
      method: "POST",
      headers: { Authorization: `Key ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (response.kind === "reject") throw new ProviderRejectedError();
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (!isRecord(response.payload)) throw new ProviderProtocolError();
  const requestId = typeof response.payload.request_id === "string"
    ? response.payload.request_id
    : typeof response.payload.requestId === "string"
      ? response.payload.requestId
      : undefined;
  if (!requestId || requestId.length > 256) throw new ProviderProtocolError();
  const statusUrl = typeof response.payload.status_url === "string" ? response.payload.status_url : undefined;
  const responseUrl = typeof response.payload.response_url === "string" ? response.payload.response_url : undefined;
  return {
    provider: "fal",
    model: model.slug,
    requestId,
    statusUrl: validateFalQueueUrl(statusUrl, requestId, "status", model.slug) ?? falQueueUrl(requestId, "status", model.slug),
    responseUrl: validateFalQueueUrl(responseUrl, requestId, "response", model.slug) ?? falQueueUrl(requestId, "response", model.slug),
  };
}

export async function pollFal(
  requestId: string,
  task: GenerationTask,
  options?: { statusUrl?: string; responseUrl?: string; model?: string },
): Promise<ProviderPoll> {
  const token = process.env.FAL_KEY;
  if (!token) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  const model = resolveModel(task, options?.model);
  if (model.provider !== "fal") throw new ProviderProtocolError();
  const queueSlug = model.slug;
  const headers = { Authorization: `Key ${token}` };
  const statusUrl = validateFalQueueUrl(options?.statusUrl, requestId, "status", model.slug) ?? falQueueUrl(requestId, "status", queueSlug);
  const response = await providerFetch(statusUrl, { method: "GET", headers });
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (response.kind === "reject") throw new ProviderProtocolError();
  if (!isRecord(response.payload)) throw new ProviderProtocolError();
  return parseFalPoll(response.payload, task, requestId, headers, options?.responseUrl, model.slug, queueSlug);
}

function parseFalPoll(
  payload: Record<string, unknown>,
  task: GenerationTask,
  requestId: string,
  headers: HeadersInit,
  returnedResponseUrl: string | undefined,
  modelSlug: string,
  queueSlug: string,
): Promise<ProviderPoll> | ProviderPoll {
  const status = payload.status ?? (isRecord(payload.data) ? payload.data.status : undefined);
  if (status === "IN_QUEUE" || status === "IN_PROGRESS" || status === "QUEUED" || status === "PROCESSING") return { state: "processing" };
  if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") return { state: "failed" };
  if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
    const statusData = isRecord(payload.data) ? payload.data : undefined;
    if (payload.error != null || payload.error_type != null || statusData?.error != null || statusData?.error_type != null) return { state: "failed" };
    const responseUrl = validateFalQueueUrl(returnedResponseUrl, requestId, "response", modelSlug) ?? falQueueUrl(requestId, "response", queueSlug);
    return getFalResult(responseUrl, task, headers);
  }
  const directUrl = firstUrlFromFalResult(payload);
  if (directUrl && isAllowedCdnUrl(directUrl, "fal")) return { state: "succeeded", result: { url: directUrl, mediaType: task === "video" ? "video" : "image" } };
  throw new ProviderProtocolError();
}

async function getFalResult(url: string, task: GenerationTask, headers: HeadersInit): Promise<ProviderPoll> {
  const response = await providerFetch(url, { method: "GET", headers });
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (response.kind === "reject" || !isRecord(response.payload)) throw new ProviderProtocolError();
  const resultUrl = firstUrlFromFalResult(response.payload);
  if (!resultUrl || !isAllowedCdnUrl(resultUrl, "fal")) throw new ProviderProtocolError();
  return { state: "succeeded", result: { url: resultUrl, mediaType: task === "video" ? "video" : "image" } };
}

function resolveModel(task: GenerationTask, modelSlug?: string): ModelDefinition {
  if (modelSlug) {
    const configured = Object.values(MODELS).find((model) => model.slug === modelSlug);
    if (configured) return configured;
  }
  return modelFor(task, "free");
}

function firstUrlFromFalResult(payload: Record<string, unknown>): string | undefined {
  const data = isRecord(payload.data) ? payload.data : undefined;
  return firstUrl(
    payload.video
      ?? payload.video_url
      ?? payload.image
      ?? payload.image_url
      ?? payload.images
      ?? data?.video
      ?? data?.video_url
      ?? data?.image
      ?? data?.image_url
      ?? data?.images
      ?? payload.output,
  );
}

function firstUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = firstUrl(entry);
      if (result) return result;
    }
    return undefined;
  }
  if (isRecord(value)) {
    for (const key of ["url", "download_url", "video_url", "image_url"]) {
      if (typeof value[key] === "string") return value[key] as string;
    }
  }
  return undefined;
}

export function isAllowedFalStorageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
    const host = parsed.hostname.toLowerCase();
    return host === "fal.media" || host.endsWith(".fal.media") || host === "storage.googleapis.com";
  } catch {
    return false;
  }
}

function falQueueUrl(requestId: string, kind: "status" | "response", modelSlug: string): string {
  const encoded = encodeURIComponent(requestId);
  return kind === "status"
    ? `https://queue.fal.run/${modelSlug}/requests/${encoded}/status`
    : `https://queue.fal.run/${modelSlug}/requests/${encoded}`;
}

function validateFalQueueUrl(value: string | undefined, requestId: string, kind: "status" | "response", modelSlug: string): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.hostname !== "queue.fal.run" || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return undefined;
    const expectedPath = new URL(falQueueUrl(requestId, kind, modelSlug)).pathname;
    return parsed.pathname === expectedPath ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
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
    try {
      return { kind: "ok", payload: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return { kind: "unavailable" };
    }
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
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
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* upstream body is already closed */ }
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
