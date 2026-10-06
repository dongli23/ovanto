import test from "node:test";
import assert from "node:assert/strict";
import { persistFailedPoll, shouldReleaseFailedReservation } from "../lib/generation/poll-state";
import { MODELS } from "../src/lib/models";
import { FREE_COST_MICRO_USD, type GenerationKind } from "../lib/generation/config";
import { keyForBudget, keyForOverallBudget, keyForQuota, type JobRecord, type QuotaSnapshot } from "../lib/generation/store";
import type { RedisLike } from "../lib/generation/redis";

const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

class PollRedis implements RedisLike {
  readonly operations: string[] = [];
  readonly updatedJobs: JobRecord[] = [];
  private readonly values = new Map<string, string>();

  constructor(day: string, kind: GenerationKind, ipHash: string) {
    this.values.set(keyForQuota(day, ipHash, kind), "1");
    this.values.set(keyForBudget(day, kind), String(FREE_COST_MICRO_USD[kind]));
    this.values.set(keyForOverallBudget(day), String(FREE_COST_MICRO_USD[kind]));
  }

  async command<T = unknown>(): Promise<T> {
    throw new Error("command not expected in polling test");
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async eval<T = unknown>(_script: string, keys: string[], args: string[]): Promise<T> {
    if (keys.length === 5) {
      this.operations.push("release");
      this.values.set(keys[1], "released");
      this.values.set(keys[2], String(Math.max(0, Number(this.values.get(keys[2]) ?? "0") - 1)));
      this.values.set(keys[3], "0");
      this.values.set(keys[4], "0");
      return ["RELEASED"] as T;
    }
    if (keys.length === 1) {
      this.operations.push("update");
      this.updatedJobs.push(JSON.parse(args[0]) as JobRecord);
      return ["UPDATED"] as T;
    }
    throw new Error("unexpected EVAL shape");
  }
}

function freeJob(provider: "fal" | "replicate", kind: "image" | "video" = provider === "fal" ? "video" : "image"): JobRecord {
  return {
    id: JOB_ID,
    kind,
    prompt: "poll test",
    inputHash: "a".repeat(64),
    ownerId: "owner",
    ipHash: "ip",
    createdAt: `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    status: "processing",
    provider,
    tier: "free",
    expectedCostMicroUsd: FREE_COST_MICRO_USD[kind],
    providerModel: provider === "fal" ? MODELS["video.free"].slug : MODELS["image.free"].slug,
    providerRequestId: "provider-request-id",
  };
}

function snapshot(kind: GenerationKind, remaining: number): QuotaSnapshot {
  return {
    remaining,
    limit: kind === "image" ? 3 : 1,
    budgetRemaining: FREE_COST_MICRO_USD[kind],
    overallBudgetRemaining: FREE_COST_MICRO_USD[kind],
    available: remaining > 0,
  };
}

test("FAL terminal failure releases reservation before persisting failed job and refreshes remaining", async () => {
  const job = freeJob("fal");
  const redis = new PollRedis(job.createdAt.slice(0, 10), job.kind, job.ipHash);
  const persisted = await persistFailedPoll(redis, job, snapshot(job.kind, 0));

  assert.deepEqual(redis.operations, ["release", "update"]);
  assert.equal(persisted.job.status, "failed");
  assert.equal(redis.updatedJobs[0]?.status, "failed");
  assert.equal(persisted.snapshot.remaining, 1);
  assert.equal(persisted.snapshot.limit, 1);
});

test("Replicate terminal failure keeps existing behavior and does not release", async () => {
  const job = freeJob("replicate");
  const redis = new PollRedis(job.createdAt.slice(0, 10), job.kind, job.ipHash);
  const originalSnapshot = snapshot(job.kind, 2);
  const persisted = await persistFailedPoll(redis, job, originalSnapshot);

  assert.deepEqual(redis.operations, ["update"]);
  assert.equal(persisted.job.status, "failed");
  assert.equal(persisted.snapshot, originalSnapshot);
});

test("only FAL terminal failures release a reservation", () => {
  assert.equal(shouldReleaseFailedReservation({ provider: "fal", tier: "free" }), true);
  assert.equal(shouldReleaseFailedReservation({ provider: "fal", tier: "paid" }), false);
  assert.equal(shouldReleaseFailedReservation({ provider: "replicate", tier: "free" }), false);
});
