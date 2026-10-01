import { getAccountDb } from "../../../../../lib/accounts/db";
import { getPaidSession } from "../../../../../lib/accounts/store";
import { assertSessionConfiguration, noStore, PaymentError, paymentResponse } from "../../../../../lib/payments/errors";
import { balancesFor } from "../../../../../lib/payments/store";
import { PAID_JOB_ID } from "../../../../../lib/paid-generation/input";
import { pollPaidGeneration, publicPaidJob } from "../../../../../lib/paid-generation/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSessionConfiguration();
    const session = await getPaidSession(request);
    if (!session) throw new PaymentError("PAID_SESSION_REQUIRED", 401);
    const { id } = await context.params;
    if (!PAID_JOB_ID.test(id)) throw new PaymentError("PAID_JOB_NOT_FOUND", 404);
    const job = await pollPaidGeneration(id, session);
    const balances = await balancesFor(getAccountDb(), session.accountId, session.scopeOrderId);
    return noStore(publicPaidJob(job, balances[job.product]));
  } catch (error) { return paymentResponse(error); }
}
