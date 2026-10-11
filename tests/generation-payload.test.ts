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
import {
  buildGenerationAttemptSignature,
  clearGenerationWorkspaceState,
  generationWorkspaceStorageKey,
  readExplicitVideoTier,
  readGenerationWorkspaceState,
  writeExplicitVideoTier,
  writeGenerationWorkspaceState,
  type GenerationWorkspaceState,
} from "../lib/generation/workspace-state";

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

function createWorkspaceState(kind: "image" | "video" | "edit" = "image"): GenerationWorkspaceState {
  const paid = kind === "video";
  return {
    version: 1,
    kind,
    attemptSignature: buildGenerationAttemptSignature({ kind, paid, prompt: "a quiet scene", assetId: kind === "edit" ? "asset-123" : undefined }),
    idempotencyKey: "11111111-2222-4333-8444-555555555555",
    paid,
    pendingJob: { id: "22222222-3333-4444-8555-666666666666", paid },
    result: null,
    resultJob: null,
    uploadedAsset: kind === "edit" ? { assetId: "asset-123", url: "https://fal.media/assets/asset-123" } : null,
    uploadName: kind === "edit" ? "source.png" : null,
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

test("workspace state preserves a pending attempt and isolates tool kinds", () => {
  const storage = createPromptStorage();
  const imageState = createWorkspaceState("image");
  writeGenerationWorkspaceState(imageState, storage);

  assert.deepEqual(readGenerationWorkspaceState("image", storage), imageState);
  assert.equal(readGenerationWorkspaceState("video", storage), null);
  assert.equal(storage.values.has(generationWorkspaceStorageKey("video")), false);
});

test("workspace state restores a validated terminal result and edit upload", () => {
  const storage = createPromptStorage();
  const state = createWorkspaceState("edit");
  const completed: GenerationWorkspaceState = {
    ...state,
    pendingJob: null,
    result: { url: "https://fal.media/results/edit.webp", mediaType: "image" },
    resultJob: { id: "22222222-3333-4444-8555-666666666666", paid: false },
  };
  writeGenerationWorkspaceState(completed, storage);

  assert.deepEqual(readGenerationWorkspaceState("edit", storage), completed);
});

test("workspace state rejects malformed, cross-kind, and mismatched media data", () => {
  const storage = createPromptStorage();
  const imageKey = generationWorkspaceStorageKey("image");
  storage.setItem(imageKey, "{broken");
  assert.equal(readGenerationWorkspaceState("image", storage), null);
  assert.equal(storage.values.has(imageKey), false);

  storage.setItem(imageKey, JSON.stringify({ ...createWorkspaceState("video"), result: { url: "https://fal.media/results/video.mp4", mediaType: "image" }, pendingJob: null, resultJob: { id: "22222222-3333-4444-8555-666666666666", paid: true } }));
  assert.equal(readGenerationWorkspaceState("image", storage), null);
  assert.equal(storage.values.has(imageKey), false);
});

test("workspace persistence tolerates unavailable storage and clear is idempotent", () => {
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
    writeGenerationWorkspaceState(createWorkspaceState(), unavailable);
    assert.equal(readGenerationWorkspaceState("image", unavailable), null);
    clearGenerationWorkspaceState("image", unavailable);
    clearGenerationWorkspaceState("image", unavailable);
  });
});

test("explicit video tier selection round trips independently of generation state", () => {
  const storage = createPromptStorage();
  assert.equal(readExplicitVideoTier(storage), null);
  writeExplicitVideoTier("free", storage);
  assert.equal(readExplicitVideoTier(storage), "free");
  writeExplicitVideoTier("paid", storage);
  assert.equal(readExplicitVideoTier(storage), "paid");
});
