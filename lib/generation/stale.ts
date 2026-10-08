import {
  AUDIT_TTL_SECONDS,
  FREE_COST_MICRO_USD,
  FREE_GENERATION_STALE_TIMEOUT_MS,
  JOB_TTL_SECONDS,
  utcDayKey,
} from "./config";
import { storageError } from "./errors";
import type { RedisLike } from "./redis";
import { STALE_JOB_SCRIPT } from "./scripts";
import {
  keyForAuditStage,
  keyForBudget,
  keyForJob,
  keyForOverallBudget,
  keyForQuota,
  keyForReservation,
  parseJob,
  type JobRecord,
} from "./store";

export type StaleJobResult =
  | { state: "staled" | "unchanged"; job: JobRecord }
  | { state: "missing" };

/**
 * Atomically closes an expired free job and releases its active reservation.
 * The caller must authenticate the job before invoking this helper. The Lua
 * CAS repeats the identity and lifecycle checks against the current value so
 * a concurrent provider completion cannot be refunded or overwritten.
 */
export async function markStaleJobIfExpired(
  redis: RedisLike,
  job: JobRecord,
  now = new Date(),
  billingObserved?: boolean,
): Promise<StaleJobResult> {
  const createdAtMs = Date.parse(job.createdAt);
  const nowMs = now.getTime();
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return { state: "unchanged", job };
  if (job.tier !== "free" || (job.status !== "pending" && job.status !== "processing") || (job.result !== undefined && job.result !== null)) {
    return { state: "unchanged", job };
  }
  if (createdAtMs > nowMs - FREE_GENERATION_STALE_TIMEOUT_MS) return { state: "unchanged", job };

  const createdAt = new Date(createdAtMs);
  const cutoff = new Date(nowMs - FREE_GENERATION_STALE_TIMEOUT_MS);
  const day = utcDayKey(createdAt);
  const result = await redis.eval<string[]>(
    STALE_JOB_SCRIPT,
    [
      keyForJob(job.id),
      keyForReservation(job.id),
      keyForQuota(day, job.ipHash, job.kind),
      keyForBudget(day, job.kind),
      keyForOverallBudget(day),
      keyForAuditStage(job.id, "stale"),
    ],
    [
      job.id,
      job.createdAt,
      cutoff.toISOString(),
      job.kind,
      job.ipHash,
      String(JOB_TTL_SECONDS),
      String(JOB_TTL_SECONDS),
      String(FREE_COST_MICRO_USD[job.kind]),
      now.toISOString(),
      String(AUDIT_TTL_SECONDS),
      billingObserved === undefined ? "" : billingObserved ? "true" : "false",
    ],
  );

  if (!Array.isArray(result) || typeof result[0] !== "string") throw storageError();
  if (result[0] === "MISSING") return { state: "missing" };
  if (result[0] !== "STALED" && result[0] !== "NOT_STALE") throw storageError();

  const current = parseJob(result[1]);
  if (!current) throw storageError();
  return { state: result[0] === "STALED" ? "staled" : "unchanged", job: current };
}
