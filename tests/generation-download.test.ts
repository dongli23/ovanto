import test from "node:test";
import assert from "node:assert/strict";
import { GenerationError } from "../lib/generation/errors";
import {
  downloadSavedResult,
  getOwnedFreeDownloadSource,
  getSavedDownloadSource,
  type DownloadSource,
} from "../lib/generation/download";
import type { JobRecord } from "../lib/generation/store";

const R2_URL = syntheticR2Url();
const REPLICATE_URL = "https://replicate.delivery/pbxt/example/image.webp";
const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

function syntheticR2Url(): string {
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "AKIAEXAMPLE/20261003/auto/s3/aws4_request",
    "X-Amz-Date": "20261003T021006Z",
    "X-Amz-Expires": "600",
    "X-Amz-SignedHeaders": "host",
    "X-Amz-Signature": "a".repeat(64),
  });
  return `https://ovanto-output.0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/generated/image.webp?${params.toString()}`;
}

function source(url = R2_URL, mediaType: "image" | "video" = "image"): DownloadSource {
  return getSavedDownloadSource("replicate", "succeeded", { url, mediaType });
}

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: JOB_ID,
    kind: "image",
    prompt: "test prompt",
    inputHash: "a".repeat(64),
    ownerId: "owner-a",
    ipHash: "ip-a",
    createdAt: "2026-10-05T00:00:00.000Z",
    status: "succeeded",
    provider: "replicate",
    tier: "free",
    expectedCostMicroUsd: 3_000,
    providerModel: "black-forest-labs/flux-schnell",
    result: { url: R2_URL, mediaType: "image" },
    ...overrides,
  };
}

function imageResponse(body = new Uint8Array([1, 2, 3]), status = 200, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
      ...headers,
    },
  });
}

function assertDownloadUnavailable(error: unknown): boolean {
  return error instanceof GenerationError && error.code === "DOWNLOAD_UNAVAILABLE" && error.status === 502;
}

test("provider output allowlist accepts replicate.delivery and signed R2 results", () => {
  assert.equal(source(REPLICATE_URL).result.url, REPLICATE_URL);
  assert.equal(source().result.url, R2_URL);
});

test("arbitrary external provider output is rejected before fetch", async () => {
  let calls = 0;
  assert.throws(
    () => getSavedDownloadSource("replicate", "succeeded", { url: "https://evil.example/image.webp", mediaType: "image" }),
    assertDownloadUnavailable,
  );
  await assert.rejects(
    downloadSavedResult({ provider: "replicate", result: { url: "https://evil.example/image.webp", mediaType: "image" } }, {
      fetchImpl: async () => { calls += 1; return imageResponse(); },
    }),
    assertDownloadUnavailable,
  );
  assert.equal(calls, 0);
});

test("invalid generation id, missing result, and foreign owner fail closed", () => {
  assert.throws(() => getOwnedFreeDownloadSource("not-a-uuid", job(), "owner-a", "ip-a"), (error: unknown) => error instanceof GenerationError && error.code === "GENERATION_NOT_FOUND");
  assert.throws(() => getOwnedFreeDownloadSource(JOB_ID, job({ id: "550e8400-e29b-41d4-a716-446655440001" }), "owner-a", "ip-a"), (error: unknown) => error instanceof GenerationError && error.code === "GENERATION_NOT_FOUND");
  assert.throws(() => getOwnedFreeDownloadSource(JOB_ID, job({ result: undefined }), "owner-a", "ip-a"), assertDownloadUnavailable);
  assert.throws(() => getOwnedFreeDownloadSource(JOB_ID, job(), "owner-b", "ip-a"), (error: unknown) => error instanceof GenerationError && error.code === "GENERATION_NOT_FOUND");
  assert.throws(() => getOwnedFreeDownloadSource(JOB_ID, job(), "owner-a", "ip-b"), (error: unknown) => error instanceof GenerationError && error.code === "GENERATION_NOT_FOUND");
  assert.throws(() => getOwnedFreeDownloadSource(JOB_ID, job({ status: "processing" }), "owner-a", "ip-a"), assertDownloadUnavailable);
});

test("download fetch strips credentials, rejects redirects, and returns safe headers", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const response = await downloadSavedResult(source(), {
    fetchImpl: async (url, init) => {
      seen = { url: String(url), init: init ?? {} };
      return imageResponse(new Uint8Array([0x52, 0x49, 0x46, 0x46]));
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="ovanto-image.webp"');
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(seen?.url, R2_URL);
  assert.equal(seen?.init.method, "GET");
  assert.equal(seen?.init.redirect, "error");
  assert.equal(seen?.init.cache, "no-store");
  assert.equal(seen?.init.credentials, "omit");
  assert.equal(seen?.init.headers, undefined);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0x52, 0x49, 0x46, 0x46]));
});

test("content type selects a matching safe filename for images and videos", async () => {
  const png = await downloadSavedResult(source(REPLICATE_URL), {
    fetchImpl: async () => imageResponse(new Uint8Array([1]), 200, { "content-type": "image/png; charset=binary" }),
  });
  assert.equal(png.headers.get("content-type"), "image/png");
  assert.equal(png.headers.get("content-disposition"), 'attachment; filename="ovanto-image.png"');
  await png.arrayBuffer();

  const video = await downloadSavedResult(source(REPLICATE_URL, "video"), {
    fetchImpl: async () => new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "video/webm" } }),
  });
  assert.equal(video.headers.get("content-type"), "video/webm");
  assert.equal(video.headers.get("content-disposition"), 'attachment; filename="ovanto-video.webm"');
  await video.arrayBuffer();
});

test("upstream non-2xx and expired signed URLs become generic download errors", async () => {
  await assert.rejects(downloadSavedResult(source(), { fetchImpl: async () => imageResponse(new Uint8Array([1]), 403) }), assertDownloadUnavailable);
  await assert.rejects(downloadSavedResult(source(), { fetchImpl: async () => { throw new TypeError("expired"); } }), assertDownloadUnavailable);
});

test("unsupported or empty upstream bodies are rejected", async () => {
  await assert.rejects(downloadSavedResult(source(), { fetchImpl: async () => new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "application/octet-stream" } }) }), assertDownloadUnavailable);
  await assert.rejects(downloadSavedResult(source(), { fetchImpl: async () => new Response(new Uint8Array(), { status: 200, headers: { "content-type": "image/webp", "content-length": "0" } }) }), assertDownloadUnavailable);
  await assert.rejects(downloadSavedResult(source(), { fetchImpl: async () => new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/webp", "content-length": String(65 * 1024 * 1024) } }) }), assertDownloadUnavailable);
});

test("stream body overflow fails closed after the upstream response", async () => {
  const response = await downloadSavedResult(source(), {
    fetchImpl: async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64 * 1024 * 1024));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": "image/webp" } }),
  });
  await assert.rejects(response.arrayBuffer(), /download unavailable/);
});

test("an abort racing fetch resolution cancels the upstream response", async () => {
  const requestController = new AbortController();
  let upstreamCanceled = false;
  const upstreamBody = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1])); },
    cancel() { upstreamCanceled = true; },
  });
  await assert.rejects(downloadSavedResult(source(), {
    signal: requestController.signal,
    fetchImpl: async () => {
      requestController.abort();
      return new Response(upstreamBody, { status: 200, headers: { "content-type": "image/webp" } });
    },
  }), assertDownloadUnavailable);
  assert.equal(upstreamCanceled, true);
});

test("client cancellation cancels the upstream reader and cleans the stream", async () => {
  let upstreamCanceled = false;
  const upstreamBody = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1])); },
    cancel() { upstreamCanceled = true; },
  });
  const response = await downloadSavedResult(source(), {
    fetchImpl: async () => new Response(upstreamBody, { status: 200, headers: { "content-type": "image/webp" } }),
  });
  await response.body?.cancel("client disconnected");
  assert.equal(upstreamCanceled, true);
});
