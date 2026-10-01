import { createHash } from "node:crypto";
import {
  DAILY_TTL_SECONDS,
  FREE_COST_MICRO_USD,
  FREE_DAILY_BUDGET_MICRO_USD,
  FREE_OVERALL_DAILY_BUDGET_MICRO_USD,
  FREE_LIMITS,
  JOB_TTL_SECONDS,
  AUDIT_TTL_SECONDS,
  providerFor,
  type GenerationKind,
  type GenerationStatus,
  type MediaType,
  utcDayKey,
} from "./config";
import { GenerationError, storageError } from "./errors";
import { RESERVE_SCRIPT, RELEASE_SCRIPT, UPDATE_JOB_SCRIPT } from "./scripts";
import type { RedisLike } from "./redis";

export interface JobResult {
  url: string;
  mediaType: MediaType;
}

export interface JobRecord {
  id: string;
  kind: GenerationKind;
  prompt: string;
  inputHash: string;
  ownerId: string;
  ipHash: string;
  createdAt: string;
  status: GenerationStatus;
  provider: "replicate" | "fal";
  tier: "free" | "paid";
  expectedCostMicroUsd: number;
  providerModel: string;
  assetId?: string;
  providerStatusUrl?: string;
  providerResponseUrl?: string;
  providerRequestId?: string;
  result?: JobResult;
}

export interface Reservation {
  state: "reserved" | "existing";
  job: JobRecord;
  remaining: number;
}

export interface QuotaSnapshot {
  remaining: number;
  limit: number;
  budgetRemaining: number;
  overallBudgetRemaining: number;
  available: boolean;
}

export interface GenerationAuditRecord {
  jobId: string;
  kind: GenerationKind;
  tier: "free" | "paid";
  expectedCostMicroUsd: number;
  provider: "replicate" | "fal";
  providerModel: string;
  providerRequestId?: string;
  status: GenerationStatus;
  disposition: "reserved" | "accepted" | "rejected" | "uncertain";
  recordedAt: string;
  estimated: true;
}

export function inputHash(kind: GenerationKind, prompt: string, assetId?: string): string {
  return createHash("sha256").update(`${kind}\n${prompt}\n${assetId ?? ""}`).digest("hex");
}

export function keyForQuota(day: string, ipHash: string, kind: GenerationKind): string {
  return `ovanto:quota:${day}:${ipHash}:${kind}`;
}

export function keyForBudget(day: string, kind: GenerationKind): string {
  return `ovanto:budget:${day}:${kind}`;
}

export function keyForOverallBudget(day: string): string {
  return `ovanto:budget:${day}:overall`;
}

export function keyForJob(id: string): string {
  return `ovanto:job:${id}`;
}

export function keyForIdempotency(ownerId: string, idempotencyKey: string): string {
  const ownerHash = createHash("sha256").update(ownerId).digest("hex");
  return `ovanto:idem:${ownerHash}:${idempotencyKey}`;
}

export function keyForReservation(id: string): string {
  return `ovanto:reservation:${id}`;
}

export function keyForAuditStage(id: string, disposition: GenerationAuditRecord["disposition"]): string {
  return `ovanto:audit:${id}:${disposition}`;
}

export async function reserveGeneration(
  redis: RedisLike,
  input: {
    id: string;
    kind: GenerationKind;
    prompt: string;
    inputHash: string;
    idempotencyKey: string;
    ownerId: string;
    ipHash: string;
    provider: "replicate" | "fal";
    assetId?: string;
    now?: Date;
  },
): Promise<Reservation> {
  const day = utcDayKey(input.now);
  const job: JobRecord = {
    id: input.id,
    kind: input.kind,
    prompt: input.prompt,
    inputHash: input.inputHash,
    ownerId: input.ownerId,
    ipHash: input.ipHash,
    createdAt: (input.now ?? new Date()).toISOString(),
    status: "pending",
    provider: input.provider,
    tier: "free",
    expectedCostMicroUsd: FREE_COST_MICRO_USD[input.kind],
    providerModel: providerFor(input.kind).model,
    ...(input.assetId ? { assetId: input.assetId } : {}),
  };
  const result = await redis.eval<string[]>(RESERVE_SCRIPT, [
    keyForQuota(day, input.ipHash, input.kind),
    keyForBudget(day, input.kind),
    keyForOverallBudget(day),
    keyForIdempotency(input.ownerId, input.idempotencyKey),
    keyForJob(input.id),
    keyForReservation(input.id),
    keyForAuditStage(input.id, "reserved"),
  ], [
    String(FREE_LIMITS[input.kind]),
    String(FREE_COST_MICRO_USD[input.kind]),
    String(FREE_DAILY_BUDGET_MICRO_USD[input.kind]),
    String(FREE_OVERALL_DAILY_BUDGET_MICRO_USD),
    JSON.stringify(job),
    input.id,
    input.inputHash,
    String(DAILY_TTL_SECONDS),
    String(JOB_TTL_SECONDS),
    "ovanto:job:",
    JSON.stringify(auditRecord(job, "reserved")),
    String(AUDIT_TTL_SECONDS),
  ]);

  if (!Array.isArray(result) || typeof result[0] !== "string") throw storageError();
  if (result[0] === "LIMIT") throw new GenerationError("FREE_LIMIT_REACHED", 429, "Daily free limit reached.");
  if (result[0] === "BUDGET" || result[0] === "OVERALL_BUDGET") throw new GenerationError("FREE_POOL_EXHAUSTED", 429, "Free generation is temporarily unavailable.");
  if (result[0] === "CONFLICT") throw new GenerationError("IDEMPOTENCY_CONFLICT", 409, "Idempotency key was already used with different input.");
  if (result[0] === "STALE_IDEMPOTENCY") throw new GenerationError("IDEMPOTENCY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");

  if (result[0] === "EXISTING") {
    const existing = parseJob(result[1]);
    if (!existing) throw storageError();
    return { state: "existing", job: existing, remaining: await remainingFor(redis, day, input.ipHash, input.kind) };
  }
  if (result[0] !== "RESERVED") throw storageError();
  const reserved = parseJob(result[1]);
  if (!reserved) throw storageError();
  const remaining = Number(result[2]);
  if (!Number.isSafeInteger(remaining) || remaining < 0) throw storageError();
  return { state: "reserved", job: reserved, remaining };
}

export async function releaseReservation(redis: RedisLike, job: JobRecord): Promise<void> {
  const day = job.createdAt.slice(0, 10);
  const result = await redis.eval<string[]>(RELEASE_SCRIPT, [
    keyForJob(job.id),
    keyForReservation(job.id),
    keyForQuota(day, job.ipHash, job.kind),
    keyForBudget(day, job.kind),
    keyForOverallBudget(day),
  ], [String(FREE_COST_MICRO_USD[job.kind]), String(JOB_TTL_SECONDS)]);
  if (!Array.isArray(result) || !["RELEASED", "ALREADY_RELEASED"].includes(result[0])) throw storageError();
}

export async function updateJob(redis: RedisLike, job: JobRecord): Promise<void> {
  const result = await redis.eval<string[]>(UPDATE_JOB_SCRIPT, [keyForJob(job.id)], [JSON.stringify(job), String(JOB_TTL_SECONDS)]);
  if (!Array.isArray(result) || result[0] === "NOT_FOUND") throw storageError();
  if (result[0] !== "UPDATED") throw storageError();
}

/**
 * Write-only reconciliation metadata. Each stage has an immutable key; a
 * reconciler deduplicates by jobId and uses the latest stage, so expected cost
 * is counted once rather than once per lifecycle event.
 */
export async function recordGenerationAudit(redis: RedisLike, job: JobRecord, disposition: GenerationAuditRecord["disposition"], providerRequestId?: string): Promise<void> {
  const record = auditRecord(job, disposition, providerRequestId);
  await redis.command(["SET", keyForAuditStage(job.id, disposition), JSON.stringify(record), "EX", String(AUDIT_TTL_SECONDS), "NX"]);
}

function auditRecord(job: JobRecord, disposition: GenerationAuditRecord["disposition"], providerRequestId?: string): GenerationAuditRecord {
  return {
    jobId: job.id,
    kind: job.kind,
    tier: job.tier,
    expectedCostMicroUsd: job.expectedCostMicroUsd,
    provider: job.provider,
    providerModel: job.providerModel,
    ...(providerRequestId ? { providerRequestId } : {}),
    status: disposition === "reserved" ? "pending" : disposition === "accepted" ? "processing" : "failed",
    disposition,
    recordedAt: new Date().toISOString(),
    estimated: true,
  };
}

export async function getJob(redis: RedisLike, id: string): Promise<JobRecord | null> {
  const raw = await redis.get(keyForJob(id));
  if (raw === null) return null;
  const job = parseJob(raw);
  if (!job) throw storageError();
  return job;
}

export function canReadJob(job: JobRecord, ownerId: string, ipHash: string): boolean {
  return job.ownerId === ownerId && job.ipHash === ipHash;
}

export async function getQuotaSnapshot(
  redis: RedisLike,
  ipHash: string,
  kind: GenerationKind,
  now = new Date(),
): Promise<QuotaSnapshot> {
  const day = utcDayKey(now);
  const [usedRaw, spentRaw] = await Promise.all([
    redis.get(keyForQuota(day, ipHash, kind)),
    redis.get(keyForBudget(day, kind)),
  ]);
  const overallSpentRaw = await redis.get(keyForOverallBudget(day));
  const used = parseCounter(usedRaw);
  const spent = parseCounter(spentRaw);
  const limit = FREE_LIMITS[kind];
  const cost = FREE_COST_MICRO_USD[kind];
  const budget = FREE_DAILY_BUDGET_MICRO_USD[kind];
  const remaining = Math.max(0, limit - used);
  const budgetRemaining = Math.max(0, budget - spent);
  const overallBudgetRemaining = Math.max(0, FREE_OVERALL_DAILY_BUDGET_MICRO_USD - parseCounter(overallSpentRaw));
  return { remaining, limit, budgetRemaining, overallBudgetRemaining, available: remaining > 0 && budgetRemaining >= cost && overallBudgetRemaining >= cost };
}

export async function remainingFor(redis: RedisLike, day: string, ipHash: string, kind: GenerationKind): Promise<number> {
  const used = parseCounter(await redis.get(keyForQuota(day, ipHash, kind)));
  return Math.max(0, FREE_LIMITS[kind] - used);
}

function parseCounter(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw storageError();
  return parsed;
}

function parseJob(value: unknown): JobRecord | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as Partial<JobRecord>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.kind || !parsed.inputHash || !parsed.ownerId || !parsed.ipHash || !parsed.createdAt || !parsed.status || !parsed.provider || !parsed.tier || !parsed.providerModel) return null;
    if (!/^[0-9a-f-]{36}$/i.test(parsed.id)) return null;
    if (parsed.kind !== "image" && parsed.kind !== "edit" && parsed.kind !== "video") return null;
    if (!["pending", "processing", "succeeded", "failed"].includes(parsed.status)) return null;
    if (parsed.provider !== "replicate" && parsed.provider !== "fal") return null;
    if (parsed.tier !== "free" && parsed.tier !== "paid") return null;
    const expectedCost = parsed.expectedCostMicroUsd;
    if (typeof expectedCost !== "number" || !Number.isSafeInteger(expectedCost) || expectedCost <= 0) return null;
    if (typeof parsed.providerModel !== "string" || !parsed.providerModel || parsed.providerModel.length > 200) return null;
    if (parsed.result && (typeof parsed.result.url !== "string" || (parsed.result.mediaType !== "image" && parsed.result.mediaType !== "video"))) return null;
    return parsed as JobRecord;
  } catch {
    return null;
  }
}

