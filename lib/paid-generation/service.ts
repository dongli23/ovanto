import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { providerFor } from "../generation/config";
import { ProviderRejectedError, pollGeneration, submitPaidGeneration } from "../generation/provider";
import { PaymentError } from "../payments/errors";
import { finalizePaidCredit, getPaidJob, releasePaidCredit, reservePaidCredit, updatePaidJobProvider, type PaidJobRecord, type PaidSession } from "../payments/store";
import type { PaidGenerationInput } from "./input";

export function paidInputHash(input: PaidGenerationInput): string {
  return createHash("sha256").update(JSON.stringify({ kind: input.kind, prompt: input.prompt, assetId: input.assetId ?? null, tier: "paid" })).digest("hex");
}

export function publicPaidJob(job: PaidJobRecord, remaining: number) {
  return {
    id: job.id,
    status: job.status,
    remaining,
    ...(job.status === "pending" && !job.providerRequestId ? { code: "SUBMISSION_UNCERTAIN" } : {}),
    ...(job.status === "succeeded" && job.resultUrl && job.resultMediaType ? { result: { url: job.resultUrl, mediaType: job.resultMediaType } } : {}),
  };
}

export async function startPaidGeneration(input: PaidGenerationInput, session: PaidSession, sourceImageUrl?: string) {
  const provider = providerFor(input.kind, "paid");
  if (!process.env[provider.provider === "replicate" ? "REPLICATE_API_TOKEN" : "FAL_KEY"]) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  const reserved = await reservePaidCredit(session.accountId, input.kind, input.idempotencyKey, paidInputHash(input), randomUUID(), session.scopeOrderId);
  if (reserved.state === "existing") return reserved;
  const job = reserved.job;
  if (job.provider !== provider.provider || job.model !== provider.model) {
    await releasePaidCredit(job.id);
    throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
  // A pending job exists transactionally with the credit debit before dispatch.
  // Retrying an uncertain submission returns that job and never calls upstream twice.
  let submitted;
  try {
    submitted = await submitPaidGeneration(input.kind, input.prompt, sourceImageUrl);
  } catch (error) {
    if (error instanceof ProviderRejectedError) {
      await releasePaidCredit(job.id);
      const failed = await updatePaidJobProvider(job.id, session.accountId, { status: "failed" }, session.scopeOrderId);
      return { state: "new" as const, job: failed };
    }
    // A timeout may still have created billable work. Preserve the pending job
    // and its idempotency key instead of offering a terminal retry that charges again.
    return { state: "new" as const, job };
  }
  const accepted = await updatePaidJobProvider(job.id, session.accountId, {
    status: "processing",
    providerRequestId: submitted.requestId,
    providerStatusUrl: submitted.statusUrl,
    providerResponseUrl: submitted.responseUrl,
  }, session.scopeOrderId);
  await finalizePaidCredit(job.id);
  return { state: "new" as const, job: accepted };
}

export async function pollPaidGeneration(id: string, session: PaidSession): Promise<PaidJobRecord> {
  const job = await getPaidJob(id, session.accountId, session.scopeOrderId);
  if (!job) throw new PaymentError("PAID_JOB_NOT_FOUND", 404);
  if (job.status === "failed") return releasePaidCredit(job.id);
  if (job.status === "succeeded") return job;
  if (job.providerRequestId && job.creditState === "reserved") await finalizePaidCredit(job.id);
  if (!job.providerRequestId) return job;
  const expected = providerFor(job.product, "paid");
  if (job.provider !== expected.provider || job.model !== expected.model) throw new PaymentError("PAID_JOB_STATE_INVALID", 409);
  const result = await pollGeneration(job.provider, job.providerRequestId, job.product, {
    statusUrl: job.providerStatusUrl, responseUrl: job.providerResponseUrl, model: job.model,
  });
  if (result.state === "processing") return job;
  if (result.state === "failed") return releasePaidCredit(job.id);
  return updatePaidJobProvider(job.id, session.accountId, {
    status: "succeeded", resultUrl: result.result.url, resultMediaType: result.result.mediaType,
  }, session.scopeOrderId);
}
