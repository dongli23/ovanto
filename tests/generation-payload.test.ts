import assert from "node:assert/strict";
import test from "node:test";
import { buildFreeGenerationBody, buildPaidGenerationBody } from "../lib/generation/request-body";
import {
  PROMPT_DRAFT_MAX_LENGTH,
  PROMPT_DRAFT_STORAGE_KEY,
  clearPromptDraft,
  readPromptDraft,
  writePromptDraft,
} from "../lib/generation/prompt-draft";

function createPromptStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    values,
  };
}

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

test("prompt draft round trips through the shared storage key", () => {
  const storage = createPromptStorage();
  writePromptDraft("a quiet mountain landscape", storage);
  assert.equal(storage.values.get(PROMPT_DRAFT_STORAGE_KEY), "a quiet mountain landscape");
  assert.equal(readPromptDraft(storage), "a quiet mountain landscape");
});

test("clearing a prompt draft removes the shared value", () => {
  const storage = createPromptStorage();
  writePromptDraft("draft", storage);
  writePromptDraft("", storage);
  assert.equal(readPromptDraft(storage), "");
  assert.equal(storage.values.has(PROMPT_DRAFT_STORAGE_KEY), false);

  writePromptDraft("draft", storage);
  clearPromptDraft(storage);
  assert.equal(readPromptDraft(storage), "");
});

test("prompt draft storage failures do not escape", () => {
  const unavailable = {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
    removeItem() {
      throw new Error("storage unavailable");
    },
  };

  assert.doesNotThrow(() => {
    assert.equal(readPromptDraft(unavailable), "");
    writePromptDraft("draft", unavailable);
    writePromptDraft("", unavailable);
    clearPromptDraft(unavailable);
  });
});

test("prompt drafts are capped on write and reject oversized stored values", () => {
  const storage = createPromptStorage();
  const oversized = "x".repeat(PROMPT_DRAFT_MAX_LENGTH + 1);
  writePromptDraft(oversized, storage);
  assert.equal(readPromptDraft(storage), "x".repeat(PROMPT_DRAFT_MAX_LENGTH));

  storage.setItem(PROMPT_DRAFT_STORAGE_KEY, oversized);
  assert.equal(readPromptDraft(storage), "");
});
