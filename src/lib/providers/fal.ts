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
import { falHttpFailureCategory, logFalFailure, type FalDiagnosticCategory } from "./fal-diagnostics";

export async function submitFal(model: ModelDefinition, options: GenerateOptions): Promise<ProviderSubmission> {
  if (model.provider !== "fal") {
    await logFalFailure("submit", model.slug, null, "protocol");
    throw new ProviderProtocolError();
  }
  const token = process.env.FAL_KEY;
  if (!token) {
    await logFalFailure("submit", model.slug, null, "authentication");
    throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  }
  if (options.task === "edit" && (!options.sourceImageUrl || !isAllowedFalStorageUrl(options.sourceImageUrl))) {
    await logFalFailure("submit", model.slug, null, "protocol");
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
      ? buildFalVideoInput(model, options.prompt)
      : undefined;
  if (!input) {
    await logFalFailure("submit", model.slug, null, "protocol");
    throw new ProviderProtocolError();
  }

  const response = await providerFetch(
    `https://queue.fal.run/${model.slug}`,
    {
      method: "POST",
      headers: { Authorization: `Key ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (response.kind === "reject") {
    await logFalFailure("submit", model.slug, response.httpStatus, falHttpFailureCategory(response.httpStatus));
    throw new ProviderRejectedError();
  }
  if (response.kind === "unavailable") {
    await logFalFailure("submit", model.slug, response.httpStatus, response.category);
    throw new ProviderUnavailableError();
  }
  if (!isRecord(response.payload)) {
    await logFalFailure("submit", model.slug, response.httpStatus, "protocol");
    throw new ProviderProtocolError();
  }
  const requestId = typeof response.payload.request_id === "string"
    ? response.payload.request_id
    : typeof response.payload.requestId === "string"
      ? response.payload.requestId
      : undefined;
  if (!requestId || !isValidFalRequestId(requestId)) {
    await logFalFailure("submit", model.slug, response.httpStatus, "protocol");
    throw new ProviderProtocolError();
  }
  const statusUrl = typeof response.payload.status_url === "string" ? response.payload.status_url : undefined;
  const responseUrl = typeof response.payload.response_url === "string" ? response.payload.response_url : undefined;
  const queueSlug = queueSlugForModel(model);
  return {
    provider: "fal",
    model: model.slug,
    requestId,
    statusUrl: validateFalQueueUrl(statusUrl, requestId, "status", queueSlug) ?? falQueueUrl(requestId, "status", queueSlug),
    responseUrl: validateFalQueueUrl(responseUrl, requestId, "response", queueSlug) ?? falQueueUrl(requestId, "response", queueSlug),
  };
}

export async function pollFal(
  requestId: string,
  task: GenerationTask,
  options?: { statusUrl?: string; responseUrl?: string; model?: string },
): Promise<ProviderPoll> {
  const token = process.env.FAL_KEY;
  if (!token) {
    await logFalFailure("status", options?.model ?? "unknown", null, "authentication");
    throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  }
  const model = resolveModel(task, options?.model);
  if (model.provider !== "fal") {
    await logFalFailure("status", model.slug, null, "protocol");
    throw new ProviderProtocolError();
  }
  if (!isValidFalRequestId(requestId)) {
    await logFalFailure("status", model.slug, null, "protocol");
    throw new ProviderProtocolError();
  }
  const queueSlug = queueSlugForModel(model);
  const headers = { Authorization: `Key ${token}` };
  const statusUrl = validateFalQueueUrl(options?.statusUrl, requestId, "status", queueSlug) ?? falQueueUrl(requestId, "status", queueSlug);
  const response = await providerFetch(statusUrl, { method: "GET", headers });
  if (response.kind === "unavailable") {
    await logFalFailure("status", model.slug, response.httpStatus, response.category);
    throw new ProviderUnavailableError();
  }
  if (response.kind === "reject") {
    await logFalFailure("status", model.slug, response.httpStatus, falHttpFailureCategory(response.httpStatus));
    if (response.httpStatus === 429) throw new ProviderUnavailableError();
    throw new ProviderProtocolError();
  }
  if (!isRecord(response.payload)) {
    await logFalFailure("status", model.slug, response.httpStatus, "protocol");
    throw new ProviderProtocolError();
  }
  return parseFalPoll(response.payload, task, requestId, headers, options?.responseUrl, model.slug, queueSlug, response.httpStatus);
}

function parseFalPoll(
  payload: Record<string, unknown>,
  task: GenerationTask,
  requestId: string,
  headers: HeadersInit,
  returnedResponseUrl: string | undefined,
  modelSlug: string,
  queueSlug: string,
  httpStatus: number,
): Promise<ProviderPoll> | ProviderPoll {
  const status = payload.status ?? (isRecord(payload.data) ? payload.data.status : undefined);
  if (status === "IN_QUEUE" || status === "IN_PROGRESS" || status === "QUEUED" || status === "PROCESSING") return { state: "processing" };
  if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") {
    return logFalFailure("status", modelSlug, httpStatus, "upstream").then(() => ({ state: "failed" as const }));
  }
  if (status === "COMPLETED" || status === "SUCCEEDED" || status === "SUCCESS") {
    const statusData = isRecord(payload.data) ? payload.data : undefined;
    if (payload.error != null || payload.error_type != null || statusData?.error != null || statusData?.error_type != null) {
      return logFalFailure("status", modelSlug, httpStatus, "upstream").then(() => ({ state: "failed" as const }));
    }
    const responseUrl = validateFalQueueUrl(returnedResponseUrl, requestId, "response", queueSlug) ?? falQueueUrl(requestId, "response", queueSlug);
    return getFalResult(responseUrl, task, headers, modelSlug);
  }
  const directUrl = firstUrlFromFalResult(payload);
  if (directUrl && isAllowedCdnUrl(directUrl, "fal")) return { state: "succeeded", result: { url: directUrl, mediaType: task === "video" ? "video" : "image" } };
  if (directUrl) return logFalFailure("result", modelSlug, httpStatus, "protocol").then(() => { throw new ProviderProtocolError(); });
  return logFalFailure("status", modelSlug, httpStatus, "protocol").then(() => { throw new ProviderProtocolError(); });
}

async function getFalResult(url: string, task: GenerationTask, headers: HeadersInit, modelSlug: string): Promise<ProviderPoll> {
  const response = await providerFetch(url, { method: "GET", headers });
  if (response.kind === "unavailable") {
    await logFalFailure("result", modelSlug, response.httpStatus, response.category);
    throw new ProviderUnavailableError();
  }
  if (response.kind === "reject") {
    const category = falHttpFailureCategory(response.httpStatus);
    await logFalFailure("result", modelSlug, response.httpStatus, category);
    if (response.httpStatus === 422) return { state: "failed" };
    if (response.httpStatus === 429) throw new ProviderUnavailableError();
    throw new ProviderProtocolError();
  }
  if (!isRecord(response.payload)) {
    await logFalFailure("result", modelSlug, response.httpStatus, "protocol");
    throw new ProviderProtocolError();
  }
  const resultUrl = firstUrlFromFalResult(response.payload);
  if (!resultUrl || !isAllowedCdnUrl(resultUrl, "fal")) {
    await logFalFailure("result", modelSlug, response.httpStatus, "protocol");
    throw new ProviderProtocolError();
  }
  return { state: "succeeded", result: { url: resultUrl, mediaType: task === "video" ? "video" : "image" } };
}

function resolveModel(task: GenerationTask, modelSlug?: string): ModelDefinition {
  if (modelSlug) {
    const configured = (Object.values(MODELS) as ModelDefinition[]).find((model) => model.slug === modelSlug || model.queueSlug === modelSlug);
    if (configured) return configured;
  }
  return modelFor(task, "free");
}

function queueSlugForModel(model: ModelDefinition): string {
  return model.queueSlug ?? model.slug;
}

function buildFalVideoInput(model: ModelDefinition, prompt: string): Record<string, unknown> {
  if (model.slug === "fal-ai/kling-video/v2.5-turbo/pro/text-to-video") {
    return {
      prompt,
      duration: String(model.fixedSeconds),
      aspect_ratio: "16:9",
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
    };
  }
  if (model.resolution === undefined) {
    return {
      prompt,
      duration: String(model.fixedSeconds),
      aspect_ratio: "16:9",
      negative_prompt: "",
      cfg_scale: 7,
    };
  }
  return {
    prompt,
    duration: String(model.fixedSeconds),
    resolution: model.resolution,
    aspect_ratio: "16:9",
    enable_prompt_expansion: false,
    enable_safety_checker: true,
  };
}

function isValidFalRequestId(value: string): boolean {
  return value.length > 0 && value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value);
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


type FetchResult =
  | { kind: "ok"; payload: unknown; httpStatus: number }
  | { kind: "reject"; httpStatus: number }
  | { kind: "unavailable"; httpStatus: number | null; category: FalDiagnosticCategory };

async function providerFetch(url: string, init: RequestInit): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store", redirect: "error" });
    if (response.status >= 400 && response.status < 500) return { kind: "reject", httpStatus: response.status };
    if (!response.ok) return { kind: "unavailable", httpStatus: response.status, category: "upstream" };
    const bytes = await readResponseBytes(response, 128 * 1024);
    if (!bytes) {
      return {
        kind: "unavailable",
        httpStatus: response.status,
        category: controller.signal.aborted ? "timeout" : "protocol",
      };
    }
    try {
      return { kind: "ok", payload: JSON.parse(new TextDecoder().decode(bytes)), httpStatus: response.status };
    } catch {
      return { kind: "unavailable", httpStatus: response.status, category: "protocol" };
    }
  } catch (error) {
    return {
      kind: "unavailable",
      httpStatus: null,
      category: error instanceof Error && error.name === "AbortError" ? "timeout" : "network",
    };
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
