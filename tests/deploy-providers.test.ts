import test from "node:test";
import assert from "node:assert/strict";
import { MODELS } from "../src/lib/models";
import { FREE_COST_MICRO_USD, PAID_MODELS, providerEnvKey } from "../lib/generation/config";
import {
  generate,
  isAllowedCdnUrl,
  poll,
  ProviderProtocolError,
  ProviderRejectedError,
  ProviderUnavailableError,
} from "../src/lib/providers";
import { logReplicateFailure, type ReplicateDiagnosticEvent } from "../src/lib/providers/replicate-diagnostics";
import { logFalFailure, type FalDiagnosticEvent } from "../src/lib/providers/fal-diagnostics";
import { generateKie } from "../src/lib/providers/kie";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const R2_BUCKET = "ovanto-output";
const R2_ACCOUNT = "0123456789abcdef0123456789abcdef";
const R2_DATE = "20261003T021006Z";

function syntheticR2Url(overrides: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `AKIAEXAMPLE/${R2_DATE.slice(0, 8)}/auto/s3/aws4_request`,
    "X-Amz-Date": R2_DATE,
    "X-Amz-Expires": "600",
    "X-Amz-SignedHeaders": "host",
    "X-Amz-Signature": "a".repeat(64),
    ...overrides,
  });
  return `https://${R2_BUCKET}.${R2_ACCOUNT}.r2.cloudflarestorage.com/generated/image.webp?${params.toString()}`;
}

function mutateSyntheticR2Url(mutator: (url: URL) => void): string {
  const url = new URL(syntheticR2Url());
  mutator(url);
  return url.toString();
}

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
  assert.equal(MODELS["video.free"].queueSlug, "fal-ai/wan-25-preview");
  assert.equal(MODELS["video.paid"].queueSlug, "fal-ai/kling-video");
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
  assert.equal(submitted.statusUrl, "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-video-id/status");
  assert.equal(submitted.responseUrl, "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-video-id");
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

test("FAL submission accepts the queue slug and safely falls back from legacy or unsafe URLs", async () => {
  process.env.FAL_KEY = "fal-test";
  const queueSlug = MODELS["video.free"].queueSlug;
  assert.equal(queueSlug, "fal-ai/wan-25-preview");
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      request_id: "fal-base-id",
      status_url: `https://queue.fal.run/${queueSlug}/requests/fal-base-id/status`,
      response_url: `https://queue.fal.run/${queueSlug}/requests/fal-base-id`,
    }), { status: 200 });
    const accepted = await generate("video", "free", { prompt: "base" });
    assert.equal(accepted.statusUrl, `https://queue.fal.run/${queueSlug}/requests/fal-base-id/status`);
    assert.equal(accepted.responseUrl, `https://queue.fal.run/${queueSlug}/requests/fal-base-id`);

    globalThis.fetch = async () => new Response(JSON.stringify({
      request_id: "fal-legacy-id",
      status_url: `https://queue.fal.run/${MODELS["video.free"].slug}/requests/fal-legacy-id/status`,
      response_url: `https://queue.fal.run/${MODELS["video.free"].slug}/requests/fal-legacy-id`,
    }), { status: 200 });
    const legacy = await generate("video", "free", { prompt: "legacy" });
    assert.equal(legacy.statusUrl, `https://queue.fal.run/${queueSlug}/requests/fal-legacy-id/status`);
    assert.equal(legacy.responseUrl, `https://queue.fal.run/${queueSlug}/requests/fal-legacy-id`);

    globalThis.fetch = async () => new Response(JSON.stringify({
      request_id: "fal-unsafe-id",
      status_url: "https://evil.example/requests/fal-unsafe-id/status",
      response_url: "http://queue.fal.run/fal-ai/wan-25-preview/requests/fal-unsafe-id",
    }), { status: 200 });
    const unsafeUrls = await generate("video", "free", { prompt: "unsafe urls" });
    assert.equal(unsafeUrls.statusUrl, `https://queue.fal.run/${queueSlug}/requests/fal-unsafe-id/status`);
    assert.equal(unsafeUrls.responseUrl, `https://queue.fal.run/${queueSlug}/requests/fal-unsafe-id`);

    globalThis.fetch = async () => new Response(JSON.stringify({ request_id: "fal/id" }), { status: 200 });
    await assert.rejects(generate("video", "free", { prompt: "unsafe id" }), (error: unknown) => error instanceof ProviderProtocolError);
  } finally {
    console.error = originalConsoleError;
  }
});

test("paid Kling submits to the full model endpoint while accepting base queue URLs", async () => {
  process.env.FAL_KEY = "fal-test";
  const model = MODELS["video.paid"];
  assert.equal(model.queueSlug, "fal-ai/kling-video");
  let request: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({
      request_id: "paid-kling-id",
      status_url: `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-id/status`,
      response_url: `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-id`,
    }), { status: 200 });
  };

  const submitted = await generate("video", "paid", { prompt: "paid video" });
  assert.equal(request?.url, `https://queue.fal.run/${model.slug}`);
  assert.equal(request?.init.method, "POST");
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    prompt: "paid video",
    duration: "5",
    aspect_ratio: "16:9",
    negative_prompt: "blur, distort, and low quality",
    cfg_scale: 0.5,
  });
  assert.equal(submitted.statusUrl, `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-id/status`);
  assert.equal(submitted.responseUrl, `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-id`);
});

test("paid Kling polling falls back from legacy full-slug URLs without submitting", async () => {
  process.env.FAL_KEY = "fal-test";
  const model = MODELS["video.paid"];
  const requestUrls: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method, "GET");
    requestUrls.push(String(input));
    if (requestUrls.length === 1) return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
    return new Response(JSON.stringify({ video: { url: "https://v3.fal.media/files/paid/result.mp4" } }), { status: 200 });
  };

  const result = await poll("fal", "paid-kling-id", "video", {
    model: model.slug,
    statusUrl: `https://queue.fal.run/${model.slug}/requests/paid-kling-id/status`,
    responseUrl: `https://queue.fal.run/${model.slug}/requests/paid-kling-id`,
  });
  assert.deepEqual(result, {
    state: "succeeded",
    result: { url: "https://v3.fal.media/files/paid/result.mp4", mediaType: "video" },
  });
  assert.deepEqual(requestUrls, [
    `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-id/status`,
    `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-id`,
  ]);
});

test("FAL result HTTP 422 becomes terminal failure without submitting again", async () => {
  process.env.FAL_KEY = "fal-test";
  const model = MODELS["video.paid"];
  const requestUrls: string[] = [];
  const originalConsoleError = console.error;
  const diagnostics: string[] = [];
  console.error = (value?: unknown) => {
    if (typeof value === "string") diagnostics.push(value);
  };
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(init?.method, "GET");
      requestUrls.push(String(input));
      if (requestUrls.length === 1) return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      return new Response(JSON.stringify({ detail: "provider payload rejected" }), { status: 422 });
    };

    const result = await poll("fal", "paid-kling-422", "video", {
      model: model.slug,
      statusUrl: `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-422/status`,
      responseUrl: `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-422`,
    });

    assert.deepEqual(result, { state: "failed" });
    assert.deepEqual(requestUrls, [
      `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-422/status`,
      `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-422`,
    ]);
    assert.equal(diagnostics.length, 1);
    assert.deepEqual(JSON.parse(diagnostics[0]), {
      provider: "fal",
      stage: "result",
      model: model.slug,
      http_status: 422,
      category: "invalid_request",
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("FAL result authentication and transient failures keep their existing error semantics", async () => {
  process.env.FAL_KEY = "fal-test";
  const model = MODELS["video.paid"];
  for (const [status, errorType] of [
    [401, ProviderProtocolError],
    [403, ProviderProtocolError],
    [429, ProviderUnavailableError],
    [503, ProviderUnavailableError],
  ] as const) {
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.method, "GET");
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
      return new Response("provider error", { status });
    };
    await assert.rejects(
      poll("fal", `paid-kling-${status}`, "video", {
        model: model.slug,
        statusUrl: `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-${status}/status`,
        responseUrl: `https://queue.fal.run/${model.queueSlug}/requests/paid-kling-${status}`,
      }),
      (error: unknown) => error instanceof errorType,
    );
  }

  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "GET");
    throw new Error("network unavailable");
  };
  await assert.rejects(
    poll("fal", "paid-kling-network", "video", { model: model.slug }),
    (error: unknown) => error instanceof ProviderUnavailableError,
  );

  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "GET");
    const error = new Error("request timed out");
    error.name = "AbortError";
    throw error;
  };
  await assert.rejects(
    poll("fal", "paid-kling-timeout", "video", { model: model.slug }),
    (error: unknown) => error instanceof ProviderUnavailableError,
  );

  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "GET");
    return new Response("rate limited", { status: 429 });
  };
  await assert.rejects(
    poll("fal", "paid-kling-rate-limit", "video", { model: model.slug }),
    (error: unknown) => error instanceof ProviderUnavailableError,
  );
});

test("FAL explicit terminal statuses and completed error payloads remain failed", async () => {
  process.env.FAL_KEY = "fal-test";
  const model = MODELS["video.paid"];
  for (const status of ["FAILED", "CANCELED", "CANCELLED"]) {
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.method, "GET");
      calls += 1;
      return new Response(JSON.stringify({ status }), { status: 200 });
    };
    const result = await poll("fal", `paid-kling-${status}`, "video", { model: model.slug });
    assert.deepEqual(result, { state: "failed" });
    assert.equal(calls, 1);
  }

  for (const payload of [
    { status: "COMPLETED", error: "provider rejected output" },
    { status: "SUCCEEDED", error_type: "provider_error" },
    { status: "COMPLETED", data: { error: "provider rejected output" } },
    { status: "COMPLETED", data: { error_type: "provider_error" } },
  ]) {
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.method, "GET");
      calls += 1;
      return new Response(JSON.stringify(payload), { status: 200 });
    };
    const result = await poll("fal", "paid-kling-completed-error", "video", { model: model.slug });
    assert.deepEqual(result, { state: "failed" });
    assert.equal(calls, 1);
  }
});

test("FAL polling uses the queue slug for processing, result, and legacy URL fallback", async () => {
  process.env.FAL_KEY = "fal-test";
  const queueSlug = MODELS["video.free"].queueSlug;
  assert.equal(queueSlug, "fal-ai/wan-25-preview");
  const requestUrls: string[] = [];
  let call = 0;
  globalThis.fetch = async (input) => {
    requestUrls.push(String(input));
    call += 1;
    if (call === 1) return new Response(JSON.stringify({ status: "IN_PROGRESS" }), { status: 200 });
    if (call === 2) return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 });
    return new Response(JSON.stringify({ video: { url: "https://v3.fal.media/files/a/result.mp4" } }), { status: 200 });
  };

  const processing = await poll("fal", "fal-processing", "video", {
    model: MODELS["video.free"].slug,
    statusUrl: `https://queue.fal.run/${MODELS["video.free"].slug}/requests/fal-processing/status`,
  });
  assert.deepEqual(processing, { state: "processing" });
  assert.equal(requestUrls[0], `https://queue.fal.run/${queueSlug}/requests/fal-processing/status`);

  const completed = await poll("fal", "fal-complete", "video", {
    model: MODELS["video.free"].slug,
    statusUrl: `https://evil.example/fal-complete/status`,
    responseUrl: `https://queue.fal.run/${MODELS["video.free"].slug}/requests/fal-complete`,
  });
  assert.deepEqual(completed, {
    state: "succeeded",
    result: { url: "https://v3.fal.media/files/a/result.mp4", mediaType: "video" },
  });
  assert.equal(requestUrls[1], `https://queue.fal.run/${queueSlug}/requests/fal-complete/status`);
  assert.equal(requestUrls[2], `https://queue.fal.run/${queueSlug}/requests/fal-complete`);

  globalThis.fetch = async () => {
    throw new Error("should not fetch an invalid request id");
  };
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    await assert.rejects(poll("fal", "fal/invalid", "video", { model: MODELS["video.free"].slug }), (error: unknown) => error instanceof ProviderProtocolError);
  } finally {
    console.error = originalConsoleError;
  }
});

async function captureFalDiagnostic(
  stage: FalDiagnosticEvent["stage"],
  httpStatus: number | null,
  category: FalDiagnosticEvent["category"],
  model: string = MODELS["video.free"].slug,
): Promise<FalDiagnosticEvent> {
  let event: FalDiagnosticEvent | undefined;
  await logFalFailure(stage, model, httpStatus, category, (nextEvent) => {
    event = nextEvent;
  });
  assert.ok(event);
  return event;
}

test("FAL diagnostics are static, bounded, and never include provider response data", async () => {
  const event = await captureFalDiagnostic("result", 402, "billing");
  assert.deepEqual(event, {
    provider: "fal",
    stage: "result",
    model: MODELS["video.free"].slug,
    http_status: 402,
    category: "billing",
  });
  const serialized = JSON.stringify(event);
  assert.equal(serialized.length <= 500, true);
  assert.equal(serialized.includes("https://"), false);
  assert.equal(serialized.includes("prompt"), false);
  assert.equal(serialized.includes("fal-test"), false);

  const unknown = await captureFalDiagnostic("status", null, "protocol", "https://evil.example/model?token=secret");
  assert.equal(unknown.model, "unknown");
  assert.equal(unknown.http_status, null);
  assert.equal(JSON.stringify(unknown).includes("evil.example"), false);
});

test("FAL provider failures preserve errors while logging actual HTTP status safely", async () => {
  process.env.FAL_KEY = "fal-test";
  const originalConsoleError = console.error;
  const events: FalDiagnosticEvent[] = [];
  console.error = (value?: unknown) => {
    if (typeof value === "string") {
      try { events.push(JSON.parse(value) as FalDiagnosticEvent); } catch { /* no raw provider output */ }
    }
  };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: "account billing secret" }), { status: 402 });
    await assert.rejects(generate("video", "free", { prompt: "private prompt" }), (error: unknown) => error instanceof ProviderRejectedError);
    assert.deepEqual(events[events.length - 1], {
      provider: "fal",
      stage: "submit",
      model: MODELS["video.free"].slug,
      http_status: 402,
      category: "billing",
    });
    assert.equal(JSON.stringify(events).includes("billing secret"), false);
    assert.equal(JSON.stringify(events).includes("private prompt"), false);

    globalThis.fetch = async () => new Response("not-json", { status: 200 });
    await assert.rejects(generate("video", "free", { prompt: "private prompt" }), (error: unknown) => error instanceof ProviderUnavailableError);
    assert.deepEqual(events[events.length - 1], {
      provider: "fal",
      stage: "submit",
      model: MODELS["video.free"].slug,
      http_status: 200,
      category: "protocol",
    });
  } finally {
    console.error = originalConsoleError;
  }
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

test("Replicate poll accepts a structurally valid presigned R2 output", async () => {
  process.env.REPLICATE_API_TOKEN = "replicate-test";
  const outputUrl = syntheticR2Url();
  assert.equal(isAllowedCdnUrl(outputUrl, "replicate"), true);
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: "succeeded",
    output: [outputUrl],
  }), { status: 200 });

  const polled = await poll("replicate", "prediction-id", "image", { model: MODELS["image.free"].slug });
  assert.deepEqual(polled, {
    state: "succeeded",
    result: { url: outputUrl, mediaType: "image" },
  });
});

test("Replicate R2 output validation rejects lookalike hosts and invalid signatures", () => {
  const rejectedUrls = [
    mutateSyntheticR2Url((url) => { url.hostname = `${R2_BUCKET}.${R2_ACCOUNT}.r2.cloudflarestorage.com.evil.example`; }),
    mutateSyntheticR2Url((url) => { url.hostname = `${R2_BUCKET}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaz.r2.cloudflarestorage.com`; }),
    mutateSyntheticR2Url((url) => { url.username = "user"; url.password = "password"; }),
    mutateSyntheticR2Url((url) => { url.protocol = "http:"; }),
    mutateSyntheticR2Url((url) => { url.port = "8443"; }),
    syntheticR2Url().replace(`.${R2_ACCOUNT}.r2.cloudflarestorage.com/`, `.${R2_ACCOUNT}.r2.cloudflarestorage.com:443/`),
    syntheticR2Url().replace("/generated/image.webp?", "/?"),
    syntheticR2Url({ "X-Amz-Date": "20261003-021006Z" }),
    mutateSyntheticR2Url((url) => { url.search = ""; }),
    mutateSyntheticR2Url((url) => { url.searchParams.delete("X-Amz-Signature"); }),
    mutateSyntheticR2Url((url) => { url.searchParams.append("X-Amz-Signature", "b".repeat(64)); }),
    syntheticR2Url({ "X-Amz-Signature": "g".repeat(64) }),
    syntheticR2Url({ "X-Amz-Algorithm": "AWS4-HMAC-SHA1" }),
    syntheticR2Url({ "X-Amz-Expires": "0" }),
    syntheticR2Url({ "X-Amz-Expires": "604801" }),
    syntheticR2Url({ "X-Amz-Credential": "AKIAEXAMPLE/20261003/us-east-1/s3/aws4_request" }),
    syntheticR2Url({ "X-Amz-Credential": "AKIAEXAMPLE/20261002/auto/s3/aws4_request" }),
    syntheticR2Url({ "X-Amz-SignedHeaders": "host;content-type" }),
  ];
  for (const value of rejectedUrls) assert.equal(isAllowedCdnUrl(value, "replicate"), false, value);
  assert.equal(isAllowedCdnUrl(syntheticR2Url(), "fal"), false);
});

test("KIE remains an explicit unimplemented provider boundary", () => {
  assert.throws(() => generateKie({ prompt: "test" }), (error: unknown) => error instanceof Error && error.name === "NotImplemented");
});
