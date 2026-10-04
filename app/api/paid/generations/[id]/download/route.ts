import { getPaidSession } from "../../../../../../lib/accounts/store";
import { downloadSavedResult, getSavedDownloadSource } from "../../../../../../lib/generation/download";
import { GenerationError, errorResponse } from "../../../../../../lib/generation/errors";
import { assertSessionConfiguration, PaymentError, paymentResponse } from "../../../../../../lib/payments/errors";
import { getPaidJob } from "../../../../../../lib/payments/store";
import { PAID_JOB_ID } from "../../../../../../lib/paid-generation/input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSessionConfiguration();
    const session = await getPaidSession(request);
    if (!session) throw new PaymentError("PAID_SESSION_REQUIRED", 401);
    const { id } = await context.params;
    if (!PAID_JOB_ID.test(id)) throw new PaymentError("PAID_JOB_NOT_FOUND", 404);
    const job = await getPaidJob(id, session.accountId, session.scopeOrderId);
    if (!job) throw new PaymentError("PAID_JOB_NOT_FOUND", 404);
    const source = getSavedDownloadSource(job.provider, job.status, job.resultUrl && job.resultMediaType ? {
      url: job.resultUrl,
      mediaType: job.resultMediaType,
    } : undefined);
    return await downloadSavedResult(source, { signal: request.signal });
  } catch (error) {
    return error instanceof GenerationError ? errorResponse(error) : paymentResponse(error);
  }
}
