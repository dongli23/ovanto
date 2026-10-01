import { cookies } from "next/headers";
import { GenerationError, errorResponse } from "../../../../lib/generation/errors";
import { assertQuotaConfig, noStoreJson, publicJob } from "../../../../lib/generation/http";
import { getDailyIdentity } from "../../../../lib/generation/identity";
import { pollGeneration, ProviderProtocolError, ProviderUnavailableError } from "../../../../lib/generation/provider";
import { providerEnvKey, providerFor } from "../../../../lib/generation/config";
import { getRedis } from "../../../../lib/generation/redis";
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
    const snapshot = await getQuotaSnapshot(redis, identity.ipHash, job.kind);
    if (job.status === "succeeded" || job.status === "failed") return noStoreJson(publicJob(job, snapshot.remaining));
    if (!job.providerRequestId) return noStoreJson(publicJob(job, snapshot.remaining));

    const configuredProvider = providerFor(job.kind, job.tier);
    if (configuredProvider.provider !== job.provider || configuredProvider.model !== job.providerModel) {
      throw new GenerationError("PROVIDER_UNAVAILABLE", 502, "Generation status is temporarily unavailable.");
    }

    const providerKey = providerEnvKey(job.kind, job.tier);
    if (!process.env[providerKey]) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");

    let polled;
    try {
      polled = await pollGeneration(job.provider, job.providerRequestId, job.kind, {
        statusUrl: job.providerStatusUrl,
        responseUrl: job.providerResponseUrl,
        model: job.providerModel,
      });
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof ProviderProtocolError) {
        throw new GenerationError("PROVIDER_UNAVAILABLE", 502, "Generation status is temporarily unavailable.");
      }
      throw error;
    }

    if (polled.state === "processing") return noStoreJson(publicJob(job, snapshot.remaining));
    if (polled.state === "failed") {
      const failed = { ...job, status: "failed" as const };
      await updateJob(redis, failed);
      return noStoreJson(publicJob(failed, snapshot.remaining));
    }

    const succeeded = { ...job, status: "succeeded" as const, result: polled.result };
    await updateJob(redis, succeeded);
    return noStoreJson(publicJob(succeeded, snapshot.remaining));
  } catch (error) {
    return errorResponse(error);
  }
}

