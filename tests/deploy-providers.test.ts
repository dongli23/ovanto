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
import { logReplicateFailure, type ReplicateDiagnosticEvent } from "../src/lib/providers/replicate-diagnostics";
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

async function captureReplicateDiagnostic(response: Response): Promise<ReplicateDiagnosticEvent> {
  let event: ReplicateDiagnosticEvent | undefined;
  await logReplicateFailure(response, MODELS["image.free"].slug, (nextEvent) => {
    event = nextEvent;
  });
  assert.ok(event);
  return event;
}

test("Replicate diagnostics classify billing, authentication, and safe invalid fields", async () => {
  const billing = await captureReplicateDiagnostic(new Response(JSON.stringify({
    error: {
      type: "insufficient_quota",
      code: "insufficient_quota",
      message: "account has insufficient credit",
    },
  }), { status: 402 }));
  assert.equal(billing.provider, "replicate");
  assert.equal(billing.http_status, 402);
  assert.equal(billing.provider_error_type, "insufficient_quota");
  assert.equal(billing.provider_error_code, "insufficient_quota");
  assert.equal(billing.provider_error_summary, "Provider account has insufficient credit.");

  const authentication = await captureReplicateDiagnostic(new Response(JSON.stringify({ detail: "Invalid API token" }), { status: 401 }));
  assert.equal(authentication.provider_error_type, null);
  assert.equal(authentication.provider_error_code, null);
  assert.equal(authentication.provider_error_summary, "Provider authentication failed.");

  const invalidField = await captureReplicateDiagnostic(new Response(JSON.stringify({
    error: { type: "validation_error", field: "prompt", message: "field is invalid" },
  }), { status: 422 }));
  assert.equal(invalidField.provider_error_type, "validation_error");
  assert.equal(invalidField.provider_error_code, null);
  assert.equal(invalidField.provider_error_summary, "Provider rejected input field: prompt.");
});

test("Replicate diagnostics never serialize prompt, secret, URL, or nested body data", async () => {
  const secret = "r8_sensitive-provider-token";
  const prompt = "private prompt that must not be logged";
  const event = await captureReplicateDiagnostic(new Response(JSON.stringify({
    detail: "request rejected",
    error: {
      body: {
        detail: `authentication failed for ${prompt}`,
        token: secret,
        url: "https://api.replicate.com/v1/models/private",
      },
    },
    nested: { prompt, secret },
  }), { status: 400 }));
  const serialized = JSON.stringify(event);
  assert.equal(event.provider_error_type, null);
  assert.equal(event.provider_error_summary, "Provider rejected the request fields.");
  assert.ok(event.provider_error_summary.length <= 500);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes(prompt), false);
  assert.equal(serialized.includes("api.replicate.com"), false);
  assert.equal(serialized.includes("authentication failed"), false);
});

test("Replicate diagnostics do not serialize sensitive top-level scalar detail or error values", async () => {
  const secret = "r8_scalar-provider-token";
  const prompt = "top-level private prompt";
  const event = await captureReplicateDiagnostic(new Response(JSON.stringify({
    detail: `request rejected ${prompt} ${secret}`,
    error: `provider detail ${prompt} ${secret}`,
  }), { status: 400 }));
  const serialized = JSON.stringify(event);
  assert.equal(event.provider_error_type, null);
  assert.equal(event.provider_error_summary, "Provider rejected the request fields.");
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes(prompt), false);
});

test("Replicate diagnostic read and logger failures preserve reject/unavailable errors", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  process.env.REPLICATE_API_TOKEN = "replicate-test";
  try {
    globalThis.fetch = async () => new Response("not json", { status: 400 });
    await assert.rejects(generate("image", "free", { prompt: "cat" }), (error: unknown) => error instanceof ProviderRejectedError);

    globalThis.fetch = async () => new Response("x".repeat(16 * 1024 + 1), { status: 503 });
    await assert.rejects(generate("image", "free", { prompt: "cat" }), (error: unknown) => error instanceof ProviderUnavailableError);

    const nonJson = await captureReplicateDiagnostic(new Response("not json", { status: 400 }));
    assert.equal(nonJson.provider_error_type, null);
    assert.equal(nonJson.provider_error_summary, "Provider returned a non-JSON error response; details omitted");

    const oversized = await captureReplicateDiagnostic(new Response("x".repeat(16 * 1024 + 1), { status: 503 }));
    assert.equal(oversized.provider_error_type, null);
    assert.equal(oversized.provider_error_summary, "Provider error response exceeded diagnostic limit; details omitted");

    const unreadable = await captureReplicateDiagnostic(new Response(null, { status: 400 }));
    assert.equal(unreadable.provider_error_type, null);
    assert.equal(unreadable.provider_error_summary, "Provider error response could not be read; details omitted");

    await assert.doesNotReject(() => logReplicateFailure(
      new Response(JSON.stringify({ detail: "bad request" }), { status: 400 }),
      MODELS["image.free"].slug,
      () => { throw new Error("logger failure"); },
    ));
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    console.error = originalConsoleError;
  }
});

test("Replicate diagnostics do not log successful responses", async () => {
  process.env.REPLICATE_API_TOKEN = "replicate-test";
  const originalConsoleError = console.error;
  let logCount = 0;
  console.error = () => { logCount += 1; };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ id: "replicate-success-id" }), { status: 201 });
    const submitted = await generate("image", "free", { prompt: "cat" });
    assert.equal(submitted.requestId, "replicate-success-id");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(logCount, 0);
  } finally {
    console.error = originalConsoleError;
  }
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
