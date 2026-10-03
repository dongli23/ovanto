import { modelFor, MODELS, type GenerationTask, type GenerationTier, type ModelDefinition } from "../models";
import { PROVIDER_REQUEST_TIMEOUT_MS } from "../../../lib/generation/config";
import { GenerationError } from "../../../lib/generation/errors";
import { logReplicateFailure } from "./replicate-diagnostics";

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
  | { state: "succeeded"; result: { url: string; mediaType: "image" | "video" } }
  | { state: "failed" };

export interface GenerateOptions {
  task: GenerationTask;
  prompt: string;
  sourceImageUrl?: string;
}

export class ProviderRejectedError extends Error {
  constructor() {
    super("provider rejected request");
    this.name = "ProviderRejectedError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor() {
    super("provider unavailable");
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderProtocolError extends Error {
  constructor() {
    super("provider protocol error");
    this.name = "ProviderProtocolError";
  }
}

export async function submitReplicate(model: ModelDefinition, options: GenerateOptions): Promise<ProviderSubmission> {
  if (model.provider !== "replicate") throw new ProviderProtocolError();
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  if (options.task === "edit" && (!options.sourceImageUrl || !isAllowedFalStorageUrl(options.sourceImageUrl))) {
    throw new ProviderProtocolError();
  }

  const input = options.task === "edit"
    ? { prompt: options.prompt, input_image: options.sourceImageUrl }
    : { prompt: options.prompt, num_outputs: 1, output_format: "webp" };
  const response = await providerFetch(
    `https://api.replicate.com/v1/models/${model.slug}/predictions`,
    {
      method: "POST",
      headers: headersFor(token),
      body: JSON.stringify({ input }),
    },
    model.slug,
  );
  if (response.kind === "reject") throw new ProviderRejectedError();
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (!isRecord(response.payload) || typeof response.payload.id !== "string" || !response.payload.id || response.payload.id.length > 256) {
    throw new ProviderProtocolError();
  }
  return { provider: "replicate", model: model.slug, requestId: response.payload.id };
}

export async function pollReplicate(
  requestId: string,
  task: GenerationTask,
  modelSlug?: string,
): Promise<ProviderPoll> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  const model = resolveModel(task, modelSlug);
  if (model.provider !== "replicate") throw new ProviderProtocolError();
  const response = await providerFetch(
    `https://api.replicate.com/v1/predictions/${encodeURIComponent(requestId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    model.slug,
  );
  if (response.kind === "unavailable") throw new ProviderUnavailableError();
  if (response.kind === "reject") throw new ProviderProtocolError();
  if (!isRecord(response.payload)) throw new ProviderProtocolError();
  return parseReplicatePoll(response.payload, task);
}

function parseReplicatePoll(payload: Record<string, unknown>, task: GenerationTask): ProviderPoll {
  const status = payload.status;
  if (status === "starting" || status === "processing") return { state: "processing" };
  if (status === "failed" || status === "canceled" || status === "cancelled") return { state: "failed" };
  if (status !== "succeeded") throw new ProviderProtocolError();
  const url = firstUrl(payload.output);
  if (!url || !isAllowedCdnUrl(url, "replicate")) throw new ProviderProtocolError();
  return { state: "succeeded", result: { url, mediaType: task === "video" ? "video" : "image" } };
}

function resolveModel(task: GenerationTask, modelSlug?: string): ModelDefinition {
  if (modelSlug) {
    const configured = Object.values(MODELS).find((model) => model.slug === modelSlug);
    if (configured) return configured;
  }
  return modelFor(task, "free");
}

function headersFor(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

type FetchResult = { kind: "ok"; payload: unknown } | { kind: "reject" } | { kind: "unavailable" };

async function providerFetch(url: string, init: RequestInit, modelSlug: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store", redirect: "error" });
    if (response.status >= 400 && response.status < 500) {
      await logReplicateFailure(response, modelSlug).catch(() => undefined);
      return { kind: "reject" };
    }
    if (!response.ok) {
      await logReplicateFailure(response, modelSlug).catch(() => undefined);
      return { kind: "unavailable" };
    }
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

export function isAllowedCdnUrl(value: string, provider: ProviderName): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
    const host = parsed.hostname.toLowerCase();
    if (provider === "replicate") {
      return host === "replicate.delivery"
        || host.endsWith(".replicate.delivery")
        || isAllowedReplicateR2Url(parsed, value);
    }
    return host === "fal.media" || host.endsWith(".fal.media") || host === "fal.ai" || host.endsWith(".fal.ai") || host === "storage.googleapis.com";
  } catch {
    return false;
  }
}

function isAllowedReplicateR2Url(parsed: URL, originalValue: string): boolean {
  // This is structural validation for an authenticated provider output; it does not verify the AWS signature.
  if (hasExplicitPort(originalValue) || parsed.pathname.length <= 1) return false;
  const labels = parsed.hostname.toLowerCase().split(".");
  if (labels.length !== 5) return false;
  const [bucket, account, providerLabel, storageLabel, tld] = labels;
  if (providerLabel !== "r2" || storageLabel !== "cloudflarestorage" || tld !== "com") return false;
  if (!/^[a-f0-9]{32}$/.test(account)) return false;
  if (bucket.length < 3 || bucket.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(bucket)) return false;

  const algorithm = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Algorithm");
  const signedHeaders = exactlyOneQueryValue(parsed.searchParams, "X-Amz-SignedHeaders");
  const signature = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Signature");
  const amzDate = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Date");
  const expires = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Expires");
  const credential = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Credential");
  if (algorithm !== "AWS4-HMAC-SHA256" || signedHeaders !== "host") return false;
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (!amzDate || !/^\d{8}T\d{6}Z$/.test(amzDate)) return false;
  if (!expires || !/^\d+$/.test(expires)) return false;
  const expiresSeconds = Number(expires);
  if (!Number.isSafeInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 604800) return false;
  const credentialParts = credential?.match(/^([A-Za-z0-9]+)\/(\d{8})\/auto\/s3\/aws4_request$/);
  if (!credentialParts || credentialParts[2] !== amzDate.slice(0, 8)) return false;
  return true;
}

function exactlyOneQueryValue(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name);
  return values.length === 1 && values[0] !== "" ? values[0] : undefined;
}

function hasExplicitPort(value: string): boolean {
  const authority = value.match(/^https:\/\/([^/?#]*)/i)?.[1];
  if (!authority) return false;
  const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
  return /:\d+$/.test(hostPort);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
