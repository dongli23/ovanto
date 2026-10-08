import { cookies } from "next/headers";
import { GenerationError, errorResponse } from "../../../../lib/generation/errors";
import { assertQuotaConfig, noStoreJson, publicJob } from "../../../../lib/generation/http";
import { getDailyIdentity } from "../../../../lib/generation/identity";
import { persistFailedPoll } from "../../../../lib/generation/poll-state";
import { pollGeneration, ProviderProtocolError, ProviderUnavailableError } from "../../../../lib/generation/provider";
import { providerEnvKey, providerFor } from "../../../../lib/generation/config";
import { getRedis } from "../../../../lib/generation/redis";
import { markStaleJobIfExpired } from "../../../../lib/generation/stale";
import { canReadJob, getJob, getQuotaSnapshot, updateJob } from "../../../../lib/generation/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!JOB_ID_RE.test(id)) throw new GenerationError("GENERATION_NOT_FOUND", 404, "Generation was not found.");
    assertQuotaConfig();
    const cookieStore = await cookies();
    const identity = getDailyIdentity(request, cookieStore);
    const redis = getRedis();
    const job = await getJob(redis, id);
    if (!job || !canReadJob(job, identity.ownerId, identity.ipHash)) {
      throw new GenerationError("GENERATION_NOT_FOUND", 404, "Generation was not found.");
    }
    const stale = await markStaleJobIfExpired(redis, job);
    if (stale.state === "missing") {
      throw new GenerationError("GENERATION_NOT_FOUND", 404, "Generation was not found.");
    }
    const currentJob = stale.job;
    if (currentJob.id !== id || !canReadJob(currentJob, identity.ownerId, identity.ipHash)) {
      throw new GenerationError("GENERATION_NOT_FOUND", 404, "Generation was not found.");
    }
    let snapshot = await getQuotaSnapshot(redis, identity.ipHash, currentJob.kind);
    if (currentJob.status === "succeeded" || currentJob.status === "failed" || stale.state === "staled") {
      return noStoreJson(publicJob(currentJob, snapshot.remaining));
    }
    if (!currentJob.providerRequestId) return noStoreJson(publicJob(currentJob, snapshot.remaining));

    const configuredProvider = providerFor(currentJob.kind, currentJob.tier);
    if (configuredProvider.provider !== currentJob.provider || configuredProvider.model !== currentJob.providerModel) {
      throw new GenerationError("PROVIDER_UNAVAILABLE", 502, "Generation status is temporarily unavailable.");
    }

    const providerKey = providerEnvKey(currentJob.kind, currentJob.tier);
    if (!process.env[providerKey]) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");

    let polled;
    try {
      polled = await pollGeneration(currentJob.provider, currentJob.providerRequestId, currentJob.kind, {
        statusUrl: currentJob.providerStatusUrl,
        responseUrl: currentJob.providerResponseUrl,
        model: currentJob.providerModel,
      });
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof ProviderProtocolError) {
        throw new GenerationError("PROVIDER_UNAVAILABLE", 502, "Generation status is temporarily unavailable.");
      }
      throw error;
    }

    if (polled.state === "processing") return noStoreJson(publicJob(currentJob, snapshot.remaining));
    if (polled.state === "failed") {
      const persisted = await persistFailedPoll(redis, currentJob, snapshot);
      return noStoreJson(publicJob(persisted.job, persisted.snapshot.remaining));
    }

    const succeeded = { ...currentJob, status: "succeeded" as const, result: polled.result };
    const persisted = await updateJob(redis, succeeded);
    if (persisted.status !== "succeeded") {
      snapshot = await getQuotaSnapshot(redis, identity.ipHash, persisted.kind);
    }
    return noStoreJson(publicJob(persisted, snapshot.remaining));
  } catch (error) {
    return errorResponse(error);
  }
}

