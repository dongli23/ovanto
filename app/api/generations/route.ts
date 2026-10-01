import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { assertFreeRegion, assertSameSiteOrigin, getDailyIdentity } from "../../../lib/generation/identity";
import { GenerationError, errorResponse } from "../../../lib/generation/errors";
import { assertGenerationConfig, noStoreJson, publicJob } from "../../../lib/generation/http";
import { submitGeneration, ProviderRejectedError, ProviderUnavailableError, ProviderProtocolError } from "../../../lib/generation/provider";
import { providerFor } from "../../../lib/generation/config";
import { getRedis } from "../../../lib/generation/redis";
import { getOwnedValidatedAsset } from "../../../lib/generation/asset";
import { inputHash, recordGenerationAudit, releaseReservation, reserveGeneration, updateJob } from "../../../lib/generation/store";
import { parseGenerateInput } from "../../../lib/generation/validation";
import { verifyTurnstile } from "../../../lib/generation/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameSiteOrigin(request);
    const input = await parseGenerateInput(request);
    assertGenerationConfig(input.kind);
    const cookieStore = await cookies();
    const identity = getDailyIdentity(request, cookieStore);
    const redis = getRedis();
    // Turnstile is verified before the reservation and therefore before any
    // provider request. A replayed token can never create a second spend: the
    // idempotency key is consumed only by the atomic Redis script below.
    await verifyTurnstile(input.turnstileToken, identity.ip);
    assertFreeRegion(identity.country);
    const reservation = await reserveGeneration(redis, {
      id: randomUUID(),
      kind: input.kind,
      prompt: input.prompt,
      inputHash: inputHash(input.kind, input.prompt, input.assetId),
      idempotencyKey: input.idempotencyKey,
      ownerId: identity.ownerId,
      ipHash: identity.ipHash,
      provider: providerFor(input.kind).provider,
      ...(input.assetId ? { assetId: input.assetId } : {}),
    });

    if (reservation.state === "existing") {
      // Existing jobs are returned without resubmitting upstream. This also
      // makes concurrent retries safe while the first request is dispatching.
      return noStoreJson(publicJob(reservation.job, reservation.remaining), 200);
    }

    const job = reservation.job;
    let asset;
    try {
      asset = input.kind === "edit" && input.assetId
        ? await getOwnedValidatedAsset(redis, input.assetId, identity.ownerId, identity.ipHash)
        : undefined;
    } catch (error) {
      await releaseReservation(redis, job);
      await updateJob(redis, { ...job, prompt: "", status: "failed" });
      await recordGenerationAudit(redis, job, "rejected");
      throw error;
    }
    try {
      const submitted = await submitGeneration(input.kind, input.prompt, asset?.url);
      const processing = {
        ...job,
        prompt: "",
        status: "processing" as const,
        providerRequestId: submitted.requestId,
        providerStatusUrl: submitted.statusUrl,
        providerResponseUrl: submitted.responseUrl,
        providerModel: submitted.model,
      };
      await updateJob(redis, processing);
      await recordGenerationAudit(redis, processing, "accepted", submitted.requestId);
      return noStoreJson(publicJob(processing, reservation.remaining), 202);
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        // A 4xx response means no provider job was accepted. Release this
        // reservation exactly once; the Lua marker prevents double release.
        await releaseReservation(redis, job);
        await updateJob(redis, { ...job, prompt: "", status: "failed" });
        await recordGenerationAudit(redis, job, "rejected");
        throw new GenerationError("PROVIDER_REJECTED", 502, "Generation could not be started.");
      }
      if (error instanceof ProviderUnavailableError || error instanceof ProviderProtocolError) {
        // Timeouts, 5xx responses, and ambiguous provider replies retain the
        // reservation conservatively so a late accepted job cannot overrun the
        // daily pool. The job is terminal and can be inspected without retrying.
        await updateJob(redis, { ...job, prompt: "", status: "failed" });
        await recordGenerationAudit(redis, job, "uncertain");
        throw new GenerationError("PROVIDER_UNAVAILABLE", 502, "Generation is temporarily unavailable.");
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}

