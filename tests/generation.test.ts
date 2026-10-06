import test from "node:test";
import assert from "node:assert/strict";
import { FREE_COST_MICRO_USD, FREE_DAILY_BUDGET_MICRO_USD, FREE_LIMITS } from "../lib/generation/config";
import { assertFreeRegion, assertUploadRegion, getTrustedNetworkIdentity, assertSameSiteOrigin } from "../lib/generation/identity";
import { GenerationError } from "../lib/generation/errors";
import { parseGenerateInput } from "../lib/generation/validation";
import { submitGeneration, submitPaidGeneration, pollGeneration } from "../lib/generation/provider";
import { verifyTurnstile } from "../lib/generation/turnstile";
import { canReadJob, type JobRecord } from "../lib/generation/store";
import { validateImageBytes } from "../lib/generation/asset";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function setEnv(name: string, value: string): void {
  process.env[name] = value;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test("free constants keep the v4 quotas, integer costs, and separate pools", () => {
  assert.deepEqual(FREE_LIMITS, { image: 3, edit: 1, video: 1 });
  assert.deepEqual(FREE_COST_MICRO_USD, { image: 3_000, edit: 23_000, video: 250_000 });
  assert.deepEqual(FREE_DAILY_BUDGET_MICRO_USD, { image: 3_000_000, edit: 2_000_000, video: 5_000_000 });
});

test("trusted identity ignores spoofable forwarding headers outside explicitly allowed local development", () => {
  setEnv("NODE_ENV", "development");
  process.env.VERCEL = "";
  process.env.DEV_ALLOW_LOCAL_REQUESTS = "false";
  assert.throws(() => getTrustedNetworkIdentity(new Request("https://ovanto.ai/api/quota", { headers: { "x-forwarded-for": "8.8.8.8", "cf-country": "US" } })), (error: unknown) => error instanceof GenerationError && error.code === "TRUSTED_IDENTITY_UNAVAILABLE");
  process.env.DEV_ALLOW_LOCAL_REQUESTS = "true";
  assert.deepEqual(getTrustedNetworkIdentity(new Request("http://localhost:3000/api/quota", { headers: { "x-forwarded-for": "8.8.8.8", "cf-country": "RU" } })), { ip: "127.0.0.1", country: "US" });
});

test("Vercel identity only accepts platform headers and a known country", () => {
  process.env.VERCEL = "1";
  setEnv("NODE_ENV", "production");
  assert.deepEqual(getTrustedNetworkIdentity(new Request("https://ovanto.ai/api/quota", { headers: { "x-vercel-forwarded-for": "203.0.113.8", "x-vercel-ip-country": "US" } })), { ip: "203.0.113.8", country: "US" });
  assert.throws(() => getTrustedNetworkIdentity(new Request("https://ovanto.ai/api/quota", { headers: { "x-forwarded-for": "203.0.113.8", "cf-country": "US" } })), (error: unknown) => error instanceof GenerationError && error.code === "TRUSTED_IDENTITY_UNAVAILABLE");
});

test("free regions IN and RU are blocked and unknown countries fail closed", () => {
  assert.throws(() => assertFreeRegion("IN"), (error: unknown) => error instanceof GenerationError && error.code === "REGION_BLOCKED");
  assert.throws(() => assertFreeRegion("RU"), (error: unknown) => error instanceof GenerationError && error.code === "REGION_BLOCKED");
  assert.throws(() => assertFreeRegion("UN"), (error: unknown) => error instanceof GenerationError && error.code === "COUNTRY_UNAVAILABLE");
});

test("paid edit entitlement can opt uploads out of free-region blocking", () => {
  assert.throws(() => assertUploadRegion("IN"), (error: unknown) => error instanceof GenerationError && error.code === "REGION_BLOCKED");
  assert.doesNotThrow(() => assertUploadRegion("IN", true));
  assert.throws(() => assertUploadRegion("ZZ", true), (error: unknown) => error instanceof GenerationError && error.code === "COUNTRY_UNAVAILABLE");
});

test("generation input rejects extra controls and applies the fixed video prompt bound", async () => {
  const base = { task: "video", tier: "free", prompt: "short scene", turnstileToken: "token", idempotencyKey: "550e8400-e29b-41d4-a716-446655440000" };
  const extra = new Request("https://ovanto.ai/api/generations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, duration: "60" }) });
  await assert.rejects(parseGenerateInput(extra), (error: unknown) => error instanceof GenerationError && error.code === "INVALID_REQUEST");
  const tooLong = new Request("https://ovanto.ai/api/generations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, prompt: "x".repeat(1501) }) });
  await assert.rejects(parseGenerateInput(tooLong), (error: unknown) => error instanceof GenerationError && error.code === "INVALID_PROMPT");
});

test("edit input requires exactly one server-owned asset id", async () => {
  const base = { task: "edit", tier: "free", prompt: "brighten portrait", turnstileToken: "token", idempotencyKey: "550e8400-e29b-41d4-a716-446655440000" };
  const missing = new Request("https://ovanto.ai/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(base) });
  await assert.rejects(parseGenerateInput(missing), (error: unknown) => error instanceof GenerationError && error.code === "INVALID_REQUEST");
  const valid = new Request("https://ovanto.ai/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, assetId: "550e8400-e29b-41d4-a716-446655440001" }) });
  assert.equal((await parseGenerateInput(valid)).assetId, "550e8400-e29b-41d4-a716-446655440001");
});

test("upload validation requires matching magic bytes and a real sharp decode", async () => {
  const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await validateImageBytes(onePixelPng, "image/png");
  await assert.rejects(validateImageBytes(onePixelPng, "image/jpeg"), (error: unknown) => error instanceof GenerationError && error.code === "INVALID_UPLOAD");
  await assert.rejects(validateImageBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png"), (error: unknown) => error instanceof GenerationError && error.code === "INVALID_UPLOAD");
});

test("same-site Origin rejects cross-site requests before provider access", () => {
  setEnv("NODE_ENV", "production");
  assert.throws(() => assertSameSiteOrigin(new Request("https://ovanto.ai/api/generations", { headers: { origin: "https://attacker.example" } })), (error: unknown) => error instanceof GenerationError && error.code === "ORIGIN_MISMATCH");
});

test("Turnstile failures stay generic and never invoke a provider", async () => {
  process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ success: false, action: "generate", hostname: "ovanto.ai", "error-codes": ["invalid-input-response"] }), { status: 200 });
  };
  await assert.rejects(verifyTurnstile("replayed-token", "203.0.113.8"), (error: unknown) => error instanceof GenerationError && error.code === "TURNSTILE_FAILED");
  assert.equal(calls, 1);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: "other", hostname: "configured.example" }), { status: 200 });
  await assert.rejects(verifyTurnstile("wrong-action", "203.0.113.8"), (error: unknown) => error instanceof GenerationError && error.code === "TURNSTILE_FAILED");
});

test("Turnstile accepts only the two deployment hostnames and the generate action", async () => {
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  for (const hostname of ["www.ovanto.ai", "ovanto.vercel.app"]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: "generate", hostname }));
    await verifyTurnstile("valid-test-token", "203.0.113.8");
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: "generate", hostname: "attacker.example" }));
  await assert.rejects(verifyTurnstile("test-token", "203.0.113.8"), (error: unknown) => error instanceof GenerationError && error.code === "TURNSTILE_FAILED");
  await assert.rejects(verifyTurnstile("", "203.0.113.8"), (error: unknown) => error instanceof GenerationError && error.code === "TURNSTILE_REQUIRED");
});

test("free input accepts task and tier while rejecting a paid tier or browser model controls", async () => {
  const body = { task: "image", tier: "free", prompt: "blue cat", turnstileToken: "test-token", idempotencyKey: "550e8400-e29b-41d4-a716-446655440000" };
  const request = (value: unknown) => new Request("https://www.ovanto.ai/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  assert.equal((await parseGenerateInput(request(body))).kind, "image");
  await assert.rejects(parseGenerateInput(request({ ...body, tier: "paid" })), (error: unknown) => error instanceof GenerationError && error.code === "INVALID_TIER");
  for (const extra of [{ slug: "arbitrary" }, { model: "arbitrary" }, { duration: 10 }, { resolution: "1080p" }]) {
    await assert.rejects(parseGenerateInput(request({ ...body, ...extra })), (error: unknown) => error instanceof GenerationError && error.code === "INVALID_REQUEST");
  }
});

test("Replicate submission fixes model input to one WebP output", async () => {
  process.env.REPLICATE_API_TOKEN = "test-replicate";
  let call: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    call = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({ id: "replicate-id" }), { status: 201, headers: { "content-type": "application/json" } });
  };
  const result = await submitGeneration("image", "a blue cat");
  assert.equal(result.requestId, "replicate-id");
  assert.equal(call?.url, "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions");
  assert.deepEqual(JSON.parse(String(call?.init.body)), { input: { prompt: "a blue cat", num_outputs: 1, output_format: "webp" } });
  assert.equal(call?.init.redirect, "error");
});

test("FAL submission fixes Wan duration, resolution, aspect ratio, safety, and no audio input", async () => {
  process.env.FAL_KEY = "test-fal";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, { prompt: "a calm lake", duration: "5", resolution: "480p", aspect_ratio: "16:9", enable_prompt_expansion: false, enable_safety_checker: true });
    return new Response(JSON.stringify({ request_id: "fal-id", status_url: "https://queue.fal.run/fal-ai/wan-25-preview/text-to-video/requests/fal-id/status", response_url: "https://queue.fal.run/fal-ai/wan-25-preview/text-to-video/requests/fal-id" }), { status: 200 });
  };
  const result = await submitGeneration("video", "a calm lake");
  assert.equal(result.requestId, "fal-id");
  assert.equal(result.statusUrl, "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-id/status");
});

test("Replicate Kontext edit submission only forwards the server-owned source URL", async () => {
  process.env.REPLICATE_API_TOKEN = "test-replicate";
  let call: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    call = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({ id: "kontext-id" }), { status: 201 });
  };
  const result = await submitGeneration("edit", "remove the background", "https://v3b.fal.media/files/a/source.png");
  assert.equal(result.requestId, "kontext-id");
  assert.equal(call?.url, "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-dev/predictions");
  assert.deepEqual(JSON.parse(String(call?.init.body)), { input: { prompt: "remove the background", input_image: "https://v3b.fal.media/files/a/source.png" } });
});

test("paid provider helper keeps fixed model schemas and is separate from free routing", async () => {
  process.env.FAL_KEY = "test-fal";
  let call: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    call = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({ request_id: "paid-kling-id" }), { status: 200 });
  };
  const result = await submitPaidGeneration("video", "a calm lake");
  assert.equal(result.model, "fal-ai/kling-video/v2.5-turbo/pro/text-to-video");
  assert.equal(call?.url, "https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/text-to-video");
  assert.deepEqual(JSON.parse(String(call?.init.body)), { prompt: "a calm lake", duration: "5", aspect_ratio: "16:9", negative_prompt: "", cfg_scale: 7 });
});

test("provider status errors fail closed and output URLs require HTTPS allowlisted CDN hosts", async () => {
  process.env.REPLICATE_API_TOKEN = "test-replicate";
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "succeeded", output: "https://evil.example/output.webp" }), { status: 200 });
  await assert.rejects(pollGeneration("replicate", "prediction-id", "image"), (error: unknown) => error instanceof Error && error.name === "ProviderProtocolError");
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "succeeded", output: "https://user:secret@replicate.delivery/prediction/output.webp" }), { status: 200 });
  await assert.rejects(pollGeneration("replicate", "prediction-id", "image"), (error: unknown) => error instanceof Error && error.name === "ProviderProtocolError");
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "succeeded", output: "https://replicate.delivery/prediction/output.webp" }), { status: 200 });
  const result = await pollGeneration("replicate", "prediction-id", "image");
  assert.deepEqual(result, { state: "succeeded", result: { url: "https://replicate.delivery/prediction/output.webp", mediaType: "image" } });
});

test("FAL completed image result supports Kontext image payload and parent queue URLs", async () => {
  process.env.FAL_KEY = "test-fal";
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
    assert.equal(String(input), "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-image");
    return new Response(JSON.stringify({ images: [{ url: "https://v3b.fal.media/files/a/result.png" }] }), { status: 200 });
  };
  const result = await pollGeneration("fal", "fal-image", "edit", { model: "fal-ai/wan-25-preview/text-to-video", statusUrl: "https://queue.fal.run/fal-ai/wan-25-preview/text-to-video/requests/fal-image/status" });
  assert.deepEqual(result, { state: "succeeded", result: { url: "https://v3b.fal.media/files/a/result.png", mediaType: "image" } });
});

test("status ownership requires both the signed anonymous owner and current trusted IP bucket", () => {
  const job: JobRecord = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    kind: "image",
    prompt: "",
    inputHash: "hash",
    ownerId: "owner-a",
    ipHash: "ip-a",
    createdAt: "2026-09-30T00:00:00.000Z",
    status: "processing",
    provider: "replicate",
    tier: "free",
    expectedCostMicroUsd: 3_000,
    providerModel: "black-forest-labs/flux-schnell",
  };
  assert.equal(canReadJob(job, "owner-a", "ip-a"), true);
  assert.equal(canReadJob(job, "owner-b", "ip-a"), false);
  assert.equal(canReadJob(job, "owner-a", "ip-b"), false);
});

