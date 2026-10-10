import assert from "node:assert/strict";
import test from "node:test";
import { buildFreeGenerationBody, buildPaidGenerationBody } from "../lib/generation/request-body";

const videoInput = {
  kind: "video" as const,
  prompt: "a cat surfing",
  idempotencyKey: "11111111-2222-4333-8444-555555555555",
};

const editInput = {
  ...videoInput,
  kind: "edit" as const,
  assetId: "asset-123",
};

test("paid video payload contains kind=video plus prompt and idempotencyKey", () => {
  const body = buildPaidGenerationBody(videoInput);
  assert.equal(body.kind, "video");
  assert.equal(body.prompt, "a cat surfing");
  assert.equal(body.idempotencyKey, videoInput.idempotencyKey);
});

test("paid payload has no task field", () => {
  assert.equal("task" in buildPaidGenerationBody(videoInput), false);
});

test("paid payload has no tier field", () => {
  assert.equal("tier" in buildPaidGenerationBody(videoInput), false);
});

test("paid payload has no turnstileToken field", () => {
  assert.equal("turnstileToken" in buildPaidGenerationBody(videoInput), false);
});

test("free payload remains unchanged: task/tier/prompt/idempotencyKey/turnstileToken (+assetId for edit)", () => {
  const videoBody = buildFreeGenerationBody(videoInput, "token-abc");
  assert.deepEqual(videoBody, {
    task: "video",
    tier: "free",
    prompt: "a cat surfing",
    idempotencyKey: videoInput.idempotencyKey,
    turnstileToken: "token-abc",
  });
  const editBody = buildFreeGenerationBody(editInput, "token-abc");
  assert.equal(editBody.assetId, "asset-123");
  assert.equal(editBody.task, "edit");
});

test("paid edit retains assetId; paid video never carries assetId", () => {
  assert.equal(buildPaidGenerationBody(editInput).assetId, "asset-123");
  assert.equal("assetId" in buildPaidGenerationBody(videoInput), false);
});
