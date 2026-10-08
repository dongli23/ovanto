import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_COST_MICRO_USD,
  FREE_GENERATION_STALE_TIMEOUT_MS,
  type GenerationKind,
} from "../lib/generation/config";
import { STALE_JOB_SCRIPT, UPDATE_JOB_SCRIPT } from "../lib/generation/scripts";
import { markStaleJobIfExpired } from "../lib/generation/stale";
import {
  keyForAuditStage,
  keyForBudget,
  keyForJob,
  keyForOverallBudget,
  keyForQuota,
  keyForReservation,
  updateJob,
  type JobRecord,
} from "../lib/generation/store";
import type { RedisLike } from "../lib/generation/redis";

const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";
const IP_HASH = "ip-hash";
const NOW = new Date("2026-10-08T00:00:00.000Z");

class StaleRedis implements RedisLike {
  readonly values = new Map<string, string>();
  readonly evalScripts: string[] = [];

  async command<T = unknown>(): Promise<T> {
    throw new Error("command not expected in stale-job test");
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async eval<T = unknown>(script: string, keys: string[], args: string[]): Promise<T> {
    this.evalScripts.push(script);
    if (script === UPDATE_JOB_SCRIPT) {
      throw new Error("update script is tested with a dedicated race fixture");
    }
    assert.equal(script, STALE_JOB_SCRIPT);
    const raw = this.values.get(keys[0]);
    if (!raw) return ["MISSING"] as T;
    const current = JSON.parse(raw) as JobRecord;
    if (current.id !== args[0] || current.createdAt !== args[1]) return ["NOT_STALE", raw] as T;
    if (current.createdAt > args[2]) return ["NOT_STALE", raw] as T;
    if (current.status !== "pending" && current.status !== "processing") return ["NOT_STALE", raw] as T;
    if (current.tier !== "free") return ["NOT_STALE", raw] as T;
    if (current.result !== undefined && current.result !== null) return ["NOT_STALE", raw] as T;
    if (current.kind !== args[3] || current.ipHash !== args[4]) return ["NOT_STALE", raw] as T;

    current.status = "failed";
    current.failure_reason = "stale_provider_job";
    const updated = JSON.stringify(current);
    this.values.set(keys[0], updated);

    let released = "0";
    if (this.values.get(keys[1]) === "active") {
      const cost = Number(args[7]);
      const used = Number(this.values.get(keys[2]));
      const spent = Number(this.values.get(keys[3]));
      const overall = Number(this.values.get(keys[4]));
      if (Number.isFinite(used) && used > 0) this.values.set(keys[2], String(used - 1));
      if (Number.isFinite(spent) && spent >= cost) this.values.set(keys[3], String(spent - cost));
      if (Number.isFinite(overall) && overall >= cost) this.values.set(keys[4], String(overall - cost));
      this.values.set(keys[1], "released");
      released = "1";
    }

    if (!this.values.has(keys[5])) {
      this.values.set(keys[5], JSON.stringify({
        jobId: current.id,
        kind: current.kind,
        tier: current.tier,
        expectedCostMicroUsd: current.expectedCostMicroUsd,
        provider: current.provider,
        providerModel: current.providerModel,
        ...(current.providerRequestId ? { providerRequestId: current.providerRequestId } : {}),
        status: "failed",
        disposition: "stale",
        failure_reason: "stale_provider_job",
        recordedAt: args[8],
        estimated: true,
        ...(args[10] === "true" ? { billing_observed: true } : args[10] === "false" ? { billing_observed: false } : {}),
      }));
    }
    return ["STALED", updated, released] as T;
  }
}

class TerminalRaceRedis implements RedisLike {
  readonly attempted: string[] = [];

  async command<T = unknown>(): Promise<T> {
    throw new Error("command not expected in terminal-race test");
  }

  async get(): Promise<string | null> {
    return null;
  }

  async eval<T = unknown>(script: string, _keys: string[], _args: string[]): Promise<T> {
    this.attempted.push(script);
    assert.equal(script, UPDATE_JOB_SCRIPT);
    return ["TERMINAL", JSON.stringify(freeJob({ status: "failed", failure_reason: "stale_provider_job" }))] as T;
  }
}

function freeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: JOB_ID,
    kind: "image",
    prompt: "stale test",
    inputHash: "a".repeat(64),
    ownerId: "owner",
    ipHash: IP_HASH,
    createdAt: new Date(NOW.getTime() - FREE_GENERATION_STALE_TIMEOUT_MS).toISOString(),
    status: "processing",
    provider: "replicate",
    tier: "free",
    expectedCostMicroUsd: FREE_COST_MICRO_USD.image,
    providerModel: "black-forest-labs/flux-schnell",
    providerRequestId: "prediction-id",
    ...overrides,
  };
}

function reservationKeys(job: JobRecord) {
  const day = job.createdAt.slice(0, 10);
  return {
    job: keyForJob(job.id),
    marker: keyForReservation(job.id),
    quota: keyForQuota(day, job.ipHash, job.kind),
    budget: keyForBudget(day, job.kind),
    overall: keyForOverallBudget(day),
    audit: keyForAuditStage(job.id, "stale"),
  };
}

test("stales exactly at the one-hour boundary and refunds only an active reservation", async () => {
  const job = freeJob();
  const keys = reservationKeys(job);
  const redis = new StaleRedis();
  redis.values.set(keys.job, JSON.stringify(job));
  redis.values.set(keys.marker, "active");
  redis.values.set(keys.quota, "1");
  redis.values.set(keys.budget, String(FREE_COST_MICRO_USD.image));
  redis.values.set(keys.overall, String(FREE_COST_MICRO_USD.image));

  const result = await markStaleJobIfExpired(redis, job, NOW);
  assert.equal(result.state, "staled");
  if (result.state !== "staled") return;
  assert.equal(result.job.status, "failed");
  assert.equal(result.job.failure_reason, "stale_provider_job");
  assert.equal(redis.values.get(keys.marker), "released");
  assert.equal(redis.values.get(keys.quota), "0");
  assert.equal(redis.values.get(keys.budget), "0");
  assert.equal(redis.values.get(keys.overall), "0");
  const audit = JSON.parse(redis.values.get(keys.audit) ?? "{}");
  assert.equal(audit.failure_reason, "stale_provider_job");
  assert.equal(audit.status, "failed");
  assert.equal("billing_observed" in audit, false);
  assert.equal(audit.estimated, true);
  assert.equal(audit.providerRequestId, job.providerRequestId);
});

test("does not stale a job newer than the one-hour boundary", async () => {
  const job = freeJob({ createdAt: new Date(NOW.getTime() - FREE_GENERATION_STALE_TIMEOUT_MS + 1).toISOString() });
  const redis = new StaleRedis();
  const keys = reservationKeys(job);
  redis.values.set(keys.job, JSON.stringify(job));
  redis.values.set(keys.marker, "active");
  redis.values.set(keys.quota, "1");
  const result = await markStaleJobIfExpired(redis, job, NOW);
  assert.equal(result.state, "unchanged");
  assert.equal(redis.values.get(keys.marker), "active");
  assert.equal(redis.values.get(keys.quota), "1");
  assert.equal(redis.values.has(keys.audit), false);
});

test("does not release or create counters when the marker is absent", async () => {
  const job = freeJob();
  const redis = new StaleRedis();
  const keys = reservationKeys(job);
  redis.values.set(keys.job, JSON.stringify(job));
  const result = await markStaleJobIfExpired(redis, job, NOW);
  assert.equal(result.state, "staled");
  assert.equal(redis.values.has(keys.marker), false);
  assert.equal(redis.values.has(keys.quota), false);
  assert.equal(redis.values.has(keys.budget), false);
  assert.equal(redis.values.has(keys.overall), false);
});

test("protects terminal and result-bearing jobs and reports missing jobs without mutation", async () => {
  const terminal = freeJob({ status: "succeeded", result: { url: "https://replicate.delivery/result.webp", mediaType: "image" } });
  const terminalRedis = new StaleRedis();
  const terminalKeys = reservationKeys(terminal);
  terminalRedis.values.set(terminalKeys.job, JSON.stringify(terminal));
  const terminalResult = await markStaleJobIfExpired(terminalRedis, terminal, NOW);
  assert.equal(terminalResult.state, "unchanged");
  assert.equal(terminalRedis.values.get(terminalKeys.job), JSON.stringify(terminal));

  const missingRedis = new StaleRedis();
  const missingResult = await markStaleJobIfExpired(missingRedis, freeJob(), NOW);
  assert.deepEqual(missingResult, { state: "missing" });
  assert.equal(missingRedis.values.size, 0);
});

test("uses the job creation UTC day for refund keys and does not double-release", async () => {
  const job = freeJob({ createdAt: "2026-10-07T23:00:00.000Z" });
  const redis = new StaleRedis();
  const keys = reservationKeys(job);
  redis.values.set(keys.job, JSON.stringify(job));
  redis.values.set(keys.marker, "active");
  redis.values.set(keys.quota, "1");
  redis.values.set(keys.budget, String(FREE_COST_MICRO_USD.image));
  redis.values.set(keys.overall, String(FREE_COST_MICRO_USD.image));

  const first = await markStaleJobIfExpired(redis, job, NOW);
  assert.equal(first.state, "staled");
  assert.equal(redis.values.get(keyForQuota("2026-10-07", job.ipHash, job.kind)), "0");
  assert.equal(redis.values.get(keyForQuota("2026-10-08", job.ipHash, job.kind)), undefined);

  const current = JSON.parse(redis.values.get(keys.job) ?? "{}") as JobRecord;
  const second = await markStaleJobIfExpired(redis, current, NOW);
  assert.equal(second.state, "unchanged");
  assert.equal(redis.values.get(keys.quota), "0");
});

test("terminal-safe update preserves a concurrent stale failure", async () => {
  const redis = new TerminalRaceRedis();
  const current = await updateJob(redis, { ...freeJob(), status: "succeeded", result: { url: "https://replicate.delivery/late.webp", mediaType: "image" } });
  assert.equal(current.status, "failed");
  assert.equal(current.failure_reason, "stale_provider_job");
  assert.equal(redis.attempted.length, 1);
});

test("stale script contains the atomic identity, lifecycle, and audit guards", () => {
  assert.match(STALE_JOB_SCRIPT, /current\.id ~= ARGV\[1\]/);
  assert.match(STALE_JOB_SCRIPT, /current\.createdAt ~= ARGV\[2\]/);
  assert.match(STALE_JOB_SCRIPT, /current\.status ~= 'pending'/);
  assert.match(STALE_JOB_SCRIPT, /current\.tier ~= 'free'/);
  assert.match(STALE_JOB_SCRIPT, /current\.failure_reason = 'stale_provider_job'/);
  assert.match(STALE_JOB_SCRIPT, /failure_reason = 'stale_provider_job'/);
  assert.match(STALE_JOB_SCRIPT, /marker == 'active'/);
  assert.match(STALE_JOB_SCRIPT, /ARGV\[11\] == 'false'/);
});
