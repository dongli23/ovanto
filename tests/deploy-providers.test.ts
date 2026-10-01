import test from "node:test";
import assert from "node:assert/strict";
import { MODELS } from "../src/lib/models";
import { FREE_COST_MICRO_USD, PAID_MODELS, providerEnvKey } from "../lib/generation/config";
import {
  generate,
  isAllowedCdnUrl,
  ProviderProtocolError,
  ProviderRejectedError,
  ProviderUnavailableError,
} from "../src/lib/providers";
import { generateKie } from "../src/lib/providers/kie";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test("model table owns provider slugs, units, and configured costs", () => {
  assert.equal(MODELS["image.free"].slug, "black-forest-labs/flux-schnell");
  assert.equal(MODELS["edit.free"].unit, "image");
  assert.equal(MODELS["video.free"].fixedSeconds, 5);
  assert.equal(MODELS["video.free"].resolution, "480p");
  assert.deepEqual(FREE_COST_MICRO_USD, { image: 3_000, edit: 23_000, video: 250_000 });
  assert.equal(PAID_MODELS.video.costMicroUsd, 350_000);
  assert.equal(providerEnvKey("image"), "REPLICATE_API_TOKEN");
  assert.equal(providerEnvKey("video"), "FAL_KEY");
});

test("image.free submits the documented Replicate input through the configured slug", async () => {
  process.env.REPLICATE_API_TOKEN = "replicate-test";
  let request: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({ id: "replicate-image-id" }), { status: 201 });
  };

  const submitted = await generate("image", "free", { prompt: "a blue cat" });
  assert.equal(submitted.provider, "replicate");
  assert.equal(request?.url, `https://api.replicate.com/v1/models/${MODELS["image.free"].slug}/predictions`);
  assert.equal((request?.init.headers as Record<string, string>).Authorization, "Bearer replicate-test");
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    input: { prompt: "a blue cat", num_outputs: 1, output_format: "webp" },
  });
});

test("edit.free submits an image URL and never accepts a caller-controlled model", async () => {
  process.env.REPLICATE_API_TOKEN = "replicate-test";
  let requestUrl = "";
  let body: unknown;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "replicate-edit-id" }), { status: 201 });
  };

  await generate("edit", "free", {
    prompt: "remove the background",
    sourceImageUrl: "https://v3.fal.media/files/source.png",
  });
  assert.equal(requestUrl, `https://api.replicate.com/v1/models/${MODELS["edit.free"].slug}/predictions`);
  assert.deepEqual(body, {
    input: {
      prompt: "remove the background",
      input_image: "https://v3.fal.media/files/source.png",
    },
  });
});

test("video.free sends the fal queue input directly with fixed five-second 480p settings", async () => {
  process.env.FAL_KEY = "fal-test";
  let request: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({ request_id: "fal-video-id" }), { status: 200 });
  };

  const submitted = await generate("video", "free", { prompt: "a calm lake" });
  assert.equal(submitted.provider, "fal");
  assert.equal(request?.url, `https://queue.fal.run/${MODELS["video.free"].slug}`);
  assert.equal((request?.init.headers as Record<string, string>).Authorization, "Key fal-test");
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    prompt: "a calm lake",
    duration: "5",
    resolution: "480p",
    aspect_ratio: "16:9",
    enable_prompt_expansion: false,
    enable_safety_checker: true,
  });
});

test("provider errors map HTTP rejection and availability without leaking upstream details", async () => {
  process.env.REPLICATE_API_TOKEN = "replicate-test";
  globalThis.fetch = async () => new Response("bad request", { status: 400 });
  await assert.rejects(generate("image", "free", { prompt: "cat" }), (error: unknown) => error instanceof ProviderRejectedError);

  globalThis.fetch = async () => new Response("upstream down", { status: 503 });
  await assert.rejects(generate("image", "free", { prompt: "cat" }), (error: unknown) => error instanceof ProviderUnavailableError);
});

test("provider input and output URLs reject unsafe hosts", async () => {
  process.env.REPLICATE_API_TOKEN = "replicate-test";
  assert.equal(isAllowedCdnUrl("http://replicate.delivery/output.webp", "replicate"), false);
  assert.equal(isAllowedCdnUrl("https://evil.example/output.webp", "replicate"), false);
  globalThis.fetch = async () => new Response(JSON.stringify({ id: "replicate-edit-id" }), { status: 201 });
  await assert.rejects(generate("edit", "free", { prompt: "edit", sourceImageUrl: "https://evil.example/source.png" }), (error: unknown) => error instanceof ProviderProtocolError);
});

test("KIE remains an explicit unimplemented provider boundary", () => {
  assert.throws(() => generateKie({ prompt: "test" }), (error: unknown) => error instanceof Error && error.name === "NotImplemented");
});
