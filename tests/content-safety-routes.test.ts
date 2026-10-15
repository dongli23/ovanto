import assert from "node:assert/strict";
import test from "node:test";
import { POST as freeGenerate } from "../app/api/generations/route";
import { POST as paidGenerate } from "../app/api/paid/generate/route";
import {
  resetRouteTestState,
  routeTestState,
  setRouteTestScanError,
  setRouteTestVerdict,
} from "./content-safety-route-state";

const FREE_IDEMPOTENCY_KEY = "550e8400-e29b-41d4-a716-446655440000";
const PAID_IDEMPOTENCY_KEY = "550e8400-e29b-41d4-a716-446655440001";

function freeRequest(prompt = "a private test prompt"): Request {
  return new Request("https://www.ovanto.ai/api/generate", {
    method: "POST",
    headers: {
      origin: "https://www.ovanto.ai",
      "content-type": "application/json",
      "x-ovanto-interface-locale": "fr",
    },
    body: JSON.stringify({
      task: "image",
      tier: "free",
      prompt,
      turnstileToken: "test-turnstile-token",
      idempotencyKey: FREE_IDEMPOTENCY_KEY,
    }),
  });
}

function paidRequest(prompt = "a private paid test prompt"): Request {
  return new Request("https://www.ovanto.ai/api/paid/generate", {
    method: "POST",
    headers: {
      origin: "https://www.ovanto.ai",
      "content-type": "application/json",
      "x-ovanto-interface-locale": "nl",
    },
    body: JSON.stringify({
      kind: "video",
      prompt,
      idempotencyKey: PAID_IDEMPOTENCY_KEY,
    }),
  });
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function assertNoGenerationSideEffects(): void {
  assert.equal(routeTestState.reserveCalls, 0);
  assert.equal(routeTestState.startPaidCalls, 0);
  assert.equal(routeTestState.providerCalls, 0);
  assert.equal(routeTestState.releaseCalls, 0);
  assert.equal(routeTestState.freeQuota, 3);
  assert.equal(routeTestState.paidBalance, 2);
}

test.beforeEach(() => {
  resetRouteTestState();
});

test("free POST returns a safe 403 for blocked prompts before reservation/provider", async () => {
  setRouteTestVerdict({
    action: "block",
    reasonCode: "restricted_content",
    matchedCategories: ["adult_nsfw"],
    requestId: "blocked-route-test",
    semanticStatus: "scored",
  });

  const response = await freeGenerate(freeRequest());
  assert.equal(response.status, 403);
  assert.deepEqual(await responseBody(response), {
    error: { code: "CONTENT_SAFETY_BLOCKED", message: "This prompt cannot be used for generation." },
  });
  assert.equal(routeTestState.scanCalls, 1);
  assert.equal(routeTestState.turnstileCalls, 1);
  assertNoGenerationSideEffects();
});

test("paid POST returns a safe 403 for review before credit reservation/provider", async () => {
  setRouteTestVerdict({
    action: "review",
    reasonCode: "review_required",
    matchedCategories: [],
    requestId: "review-route-test",
    semanticStatus: "scored",
  });

  const response = await paidGenerate(paidRequest());
  assert.equal(response.status, 403);
  assert.deepEqual(await responseBody(response), {
    error: { code: "CONTENT_SAFETY_REVIEW", message: "This prompt requires additional review before generation." },
  });
  assert.equal(routeTestState.scanCalls, 1);
  assertNoGenerationSideEffects();
});

test("free POST returns 503 when the safety service errors before reservation/provider", async () => {
  setRouteTestScanError(true);

  const response = await freeGenerate(freeRequest("service error test"));
  assert.equal(response.status, 503);
  assert.deepEqual(await responseBody(response), {
    error: { code: "CONTENT_SAFETY_UNAVAILABLE", message: "Generation is temporarily unavailable." },
  });
  assert.equal(routeTestState.scanCalls, 1);
  assert.equal(routeTestState.turnstileCalls, 1);
  assertNoGenerationSideEffects();
});

test("paid POST returns 503 when the safety service errors before paid credit operations", async () => {
  setRouteTestScanError(true);

  const response = await paidGenerate(paidRequest("paid service error test"));
  assert.equal(response.status, 503);
  assert.deepEqual(await responseBody(response), {
    error: { code: "CONTENT_SAFETY_UNAVAILABLE", message: "Generation is temporarily unavailable." },
  });
  assert.equal(routeTestState.scanCalls, 1);
  assertNoGenerationSideEffects();
});

test("free allow verdict reaches only mocked reservation/provider dependencies", async () => {
  const response = await freeGenerate(freeRequest("allowed free prompt"));
  assert.equal(response.status, 202);
  assert.equal(routeTestState.scanCalls, 1);
  assert.equal(routeTestState.reserveCalls, 1);
  assert.equal(routeTestState.providerCalls, 1);
  assert.equal(routeTestState.freeQuota, 3);
});

test("paid allow verdict reaches only mocked paid generation dependencies", async () => {
  const response = await paidGenerate(paidRequest("allowed paid prompt"));
  assert.equal(response.status, 202);
  assert.equal(routeTestState.scanCalls, 1);
  assert.equal(routeTestState.startPaidCalls, 1);
  assert.equal(routeTestState.providerCalls, 1);
  assert.equal(routeTestState.paidBalance, 2);
});
