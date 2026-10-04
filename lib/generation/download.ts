import { GenerationError } from "./errors";
import { isAllowedCdnUrl, type ProviderName } from "./provider";
import { canReadJob, type JobRecord, type JobResult } from "./store";

export const GENERATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DOWNLOAD_TIMEOUT_MS = 30_000;
const IMAGE_MAX_BYTES = 64 * 1024 * 1024;
const VIDEO_MAX_BYTES = 256 * 1024 * 1024;

const IMAGE_TYPES: ReadonlyMap<string, string> = new Map([
  ["image/webp", "webp"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

const VIDEO_TYPES: ReadonlyMap<string, string> = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);

export interface DownloadSource {
  provider: ProviderName;
  result: JobResult;
}

export interface DownloadFetchOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Resolve a free job's already persisted result without polling or changing
 * any generation state. The caller supplies the identity that was obtained
 * from the normal request path.
 */
export function getOwnedFreeDownloadSource(
  id: string,
  job: JobRecord | null,
  ownerId: string,
  ipHash: string,
): DownloadSource {
  if (!GENERATION_ID_RE.test(id) || !job || !canReadJob(job, ownerId, ipHash)) {
    throw new GenerationError("GENERATION_NOT_FOUND", 404, "Generation was not found.");
  }
  if (job.id !== id) throw new GenerationError("GENERATION_NOT_FOUND", 404, "Generation was not found.");
  return getSavedDownloadSource(job.provider, job.status, job.result);
}

/** Validate the saved provider result before any upstream request is made. */
export function getSavedDownloadSource(
  provider: ProviderName,
  status: JobRecord["status"],
  result: JobResult | undefined,
): DownloadSource {
  if (status !== "succeeded" || !result || !isAllowedCdnUrl(result.url, provider)) {
    throw downloadUnavailable();
  }
  return { provider, result };
}

/**
 * Fetch a server-owned provider result and return it as a same-origin binary
 * response. No request headers are forwarded and redirects are rejected so a
 * saved provider URL cannot turn this endpoint into an SSRF proxy.
 */
export async function downloadSavedResult(
  source: DownloadSource,
  options: DownloadFetchOptions = {},
): Promise<Response> {
  if (!isAllowedCdnUrl(source.result.url, source.provider)) throw downloadUnavailable();

  const fetchImpl = options.fetchImpl ?? fetch;
  const abortController = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abortController.abort(), DOWNLOAD_TIMEOUT_MS);
  let cleaned = false;
  const abortRequest = () => abortController.abort();
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
    options.signal?.removeEventListener("abort", abortRequest);
  };
  if (options.signal?.aborted) {
    cleanup();
    throw downloadUnavailable();
  }
  options.signal?.addEventListener("abort", abortRequest, { once: true });

  let upstream: Response;
  try {
    upstream = await fetchImpl(source.result.url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
      signal: abortController.signal,
    });
  } catch {
    cleanup();
    throw downloadUnavailable();
  }

  if (abortController.signal.aborted || options.signal?.aborted) {
    await cancelBody(upstream);
    cleanup();
    throw downloadUnavailable();
  }

  if (!upstream.ok) {
    await cancelBody(upstream);
    cleanup();
    throw downloadUnavailable();
  }

  const contentType = normalizeContentType(upstream.headers.get("content-type"));
  const extension = extensionFor(source.result.mediaType, contentType);
  const maxBytes = source.result.mediaType === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  const declaredLength = parseContentLength(upstream.headers.get("content-length"));
  if (!contentType || !extension || declaredLength !== undefined && (!Number.isFinite(declaredLength) || declaredLength <= 0 || declaredLength > maxBytes) || !upstream.body) {
    await cancelBody(upstream);
    cleanup();
    throw downloadUnavailable();
  }

  const reader = upstream.body.getReader();
  let totalBytes = 0;
  let settled = false;
  let aborted = false;

  const cancelReader = () => {
    aborted = true;
    cleanup();
    void reader.cancel().catch(() => undefined);
  };
  const cleanupStream = () => {
    if (settled) return;
    settled = true;
    abortController.signal.removeEventListener("abort", cancelReader);
    options.signal?.removeEventListener("abort", cancelReader);
    cleanup();
  };
  abortController.signal.addEventListener("abort", cancelReader, { once: true });
  options.signal?.addEventListener("abort", cancelReader, { once: true });

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (settled) return;
      try {
        const part = await reader.read();
        if (part.done) {
          cleanupStream();
          if (aborted || totalBytes === 0) controller.error(new Error("download unavailable"));
          else controller.close();
          return;
        }
        totalBytes += part.value.byteLength;
        if (aborted || totalBytes > maxBytes) {
          await reader.cancel();
          cleanupStream();
          controller.error(new Error("download unavailable"));
          return;
        }
        controller.enqueue(part.value);
      } catch {
        try { await reader.cancel(); } catch { /* upstream body is already closed */ }
        cleanupStream();
        controller.error(new Error("download unavailable"));
      }
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } catch { /* upstream body is already closed */ }
      cleanupStream();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="ovanto-${source.result.mediaType}.${extension}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeContentType(value: string | null): string | undefined {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  return normalized || undefined;
}

function extensionFor(mediaType: JobResult["mediaType"], contentType: string | undefined): string | undefined {
  if (!contentType) return undefined;
  return (mediaType === "video" ? VIDEO_TYPES : IMAGE_TYPES).get(contentType);
}

function parseContentLength(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

async function cancelBody(response: Response): Promise<void> {
  try { await response.body?.cancel(); } catch { /* upstream body is already closed */ }
}

function downloadUnavailable(): GenerationError {
  return new GenerationError("DOWNLOAD_UNAVAILABLE", 502, "The generated file is unavailable for download.");
}
