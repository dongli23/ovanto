import { cookies } from "next/headers";
import { getPaidSession } from "../../../../lib/accounts/store";
import { getAccountDb } from "../../../../lib/accounts/db";
import { getOwnedValidatedAsset } from "../../../../lib/generation/asset";
import { GenerationError, errorResponse } from "../../../../lib/generation/errors";
import { assertSameSiteOrigin, getDailyIdentity } from "../../../../lib/generation/identity";
import { getRedis } from "../../../../lib/generation/redis";
import { assertSessionConfiguration, noStore, PaymentError, paymentResponse } from "../../../../lib/payments/errors";
import { balancesFor } from "../../../../lib/payments/store";
import { parsePaidGenerationInput } from "../../../../lib/paid-generation/input";
import { publicPaidJob, startPaidGeneration } from "../../../../lib/paid-generation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameSiteOrigin(request);
    assertSessionConfiguration();
    const session = await getPaidSession(request);
    if (!session) throw new PaymentError("PAID_SESSION_REQUIRED", 401);
    const input = await parsePaidGenerationInput(request);
    let sourceImageUrl: string | undefined;
    if (input.kind === "edit") {
      const identity = getDailyIdentity(request, await cookies());
      const asset = await getOwnedValidatedAsset(getRedis(), input.assetId!, identity.ownerId, identity.ipHash);
      sourceImageUrl = asset.url;
    }
    // Paid work deliberately skips free IP allowances, regions, and budget pools.
    const reservation = await startPaidGeneration(input, session, sourceImageUrl);
    const balances = await balancesFor(getAccountDb(), session.accountId, session.scopeOrderId);
    return noStore(publicPaidJob(reservation.job, balances[input.kind]), reservation.state === "new" ? 202 : 200);
  } catch (error) {
    return error instanceof GenerationError ? errorResponse(error) : paymentResponse(error);
  }
}
