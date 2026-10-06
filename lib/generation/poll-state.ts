import { getQuotaSnapshot, releaseReservation, updateJob, type JobRecord, type QuotaSnapshot } from "./store";
import type { RedisLike } from "./redis";

/** Persist a terminal provider failure and refund only the free FAL reservation. */
export async function persistFailedPoll(redis: RedisLike, job: JobRecord, snapshot: QuotaSnapshot): Promise<{ job: JobRecord; snapshot: QuotaSnapshot }> {
  const failed = { ...job, status: "failed" as const };
  if (shouldReleaseFailedReservation(job)) {
    await releaseReservation(redis, job);
    await updateJob(redis, failed);
    return { job: failed, snapshot: await getQuotaSnapshot(redis, job.ipHash, job.kind) };
  }
  await updateJob(redis, failed);
  return { job: failed, snapshot };
}

export function shouldReleaseFailedReservation(job: Pick<JobRecord, "provider" | "tier">): boolean {
  return job.provider === "fal" && job.tier === "free";
}
