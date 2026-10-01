import assert from "node:assert/strict";
import { test } from "node:test";
import { inputHash } from "../lib/generation/store";
import { PaymentError } from "../lib/payments/errors";
import { paidInputHash, publicPaidJob } from "../lib/paid-generation/service";
import { parsePaidGenerationInput, type PaidGenerationInput } from "../lib/paid-generation/input";
import type { PaidJobRecord } from "../lib/payments/store";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ASSET_UUID = "550e8400-e29b-41d4-a716-446655440001";

function jsonRequest(value: unknown): Request {
  return new Request("https://ovanto.ai/api/paid/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}

async function rejectsWithCode(request: Request, code: string): Promise<void> {
  await assert.rejects(parsePaidGenerationInput(request), (error: unknown) => error instanceof PaymentError && error.code === code);
}

test("paid input rejects browser-controlled model, duration, and price fields", async () => {
  const base = { kind: "image", prompt: "a blue cat", idempotencyKey: UUID };
  await rejectsWithCode(jsonRequest({ ...base, model: "flux-dev" }), "REQUEST_INVALID");
  await rejectsWithCode(jsonRequest({ ...base, duration: 10 }), "REQUEST_INVALID");
  await rejectsWithCode(jsonRequest({ ...base, price: 0.01 }), "REQUEST_INVALID");
});

test("paid input rejects oversized bodies, missing edit assets, and malformed UUIDs", async () => {
  await rejectsWithCode(jsonRequest({ kind: "image", prompt: "x".repeat(17_000), idempotencyKey: UUID }), "REQUEST_TOO_LARGE");
  await rejectsWithCode(jsonRequest({ kind: "edit", prompt: "brighten it", idempotencyKey: UUID }), "REQUEST_INVALID");
  await rejectsWithCode(jsonRequest({ kind: "edit", prompt: "brighten it", idempotencyKey: "not-a-uuid", assetId: ASSET_UUID }), "REQUEST_INVALID");
  await rejectsWithCode(jsonRequest({ kind: "edit", prompt: "brighten it", idempotencyKey: UUID, assetId: "bad-asset" }), "REQUEST_INVALID");
});

test("paid input accepts the three server-owned product shapes", async () => {
  const image = await parsePaidGenerationInput(jsonRequest({ kind: "image", prompt: " a blue cat ", idempotencyKey: UUID }));
  const edit = await parsePaidGenerationInput(jsonRequest({ kind: "edit", prompt: " brighten it ", idempotencyKey: UUID, assetId: ASSET_UUID }));
  const video = await parsePaidGenerationInput(jsonRequest({ kind: "video", prompt: " a calm lake ", idempotencyKey: UUID }));
  assert.deepEqual(image, { kind: "image", prompt: "a blue cat", idempotencyKey: UUID });
  assert.deepEqual(edit, { kind: "edit", prompt: "brighten it", idempotencyKey: UUID, assetId: ASSET_UUID });
  assert.deepEqual(video, { kind: "video", prompt: "a calm lake", idempotencyKey: UUID });
});

test("paid input hashes are distinct from free hashes and bind the edit asset", () => {
  const paid: PaidGenerationInput = { kind: "edit", prompt: "brighten it", idempotencyKey: UUID, assetId: ASSET_UUID };
  const changedAsset: PaidGenerationInput = { ...paid, assetId: "550e8400-e29b-41d4-a716-446655440002" };
  assert.notEqual(paidInputHash(paid), inputHash(paid.kind, paid.prompt, paid.assetId));
  assert.notEqual(paidInputHash(paid), paidInputHash(changedAsset));
  assert.notEqual(paidInputHash({ ...paid, kind: "image", assetId: undefined }), paidInputHash({ ...paid, kind: "video", assetId: undefined }));
});

function job(overrides: Partial<PaidJobRecord> = {}): PaidJobRecord {
  return {
    id: UUID,
    accountId: "account-id",
    product: "image",
    provider: "replicate",
    model: "black-forest-labs/flux-dev",
    inputHash: "hash",
    idempotencyKey: UUID,
    expectedCostMicroUsd: 25_000,
    status: "pending",
    creditState: "reserved",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

test("public paid jobs redact provider metadata and mark uncertain pending submissions", () => {
  const uncertain = publicPaidJob(job({ providerRequestId: undefined }), 2);
  assert.deepEqual(uncertain, { id: UUID, status: "pending", remaining: 2, code: "SUBMISSION_UNCERTAIN" });
  assert.equal("provider" in uncertain, false);
  assert.equal("model" in uncertain, false);
  assert.equal("providerRequestId" in uncertain, false);

  const processing = publicPaidJob(job({ status: "processing", providerRequestId: "upstream-id" }), 1);
  assert.deepEqual(processing, { id: UUID, status: "processing", remaining: 1 });

  const succeeded = publicPaidJob(job({ status: "succeeded", creditState: "consumed", providerRequestId: "upstream-id", resultUrl: "https://replicate.delivery/result.webp", resultMediaType: "image" }), 0);
  assert.deepEqual(succeeded, { id: UUID, status: "succeeded", remaining: 0, result: { url: "https://replicate.delivery/result.webp", mediaType: "image" } });
});
