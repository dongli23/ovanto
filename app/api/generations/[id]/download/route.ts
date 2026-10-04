import { cookies } from "next/headers";
import { GenerationError, errorResponse } from "../../../../../lib/generation/errors";
import { assertQuotaConfig } from "../../../../../lib/generation/http";
import { getDailyIdentity } from "../../../../../lib/generation/identity";
import { downloadSavedResult, getOwnedFreeDownloadSource, GENERATION_ID_RE } from "../../../../../lib/generation/download";
import { getRedis } from "../../../../../lib/generation/redis";
import { getJob } from "../../../../../lib/generation/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!GENERATION_ID_RE.test(id)) throw new GenerationError("GENERATION_NOT_FOUND", 404, "Generation was not found.");
    assertQuotaConfig();
    const identity = getDailyIdentity(request, await cookies());
    const job = await getJob(getRedis(), id);
    const source = getOwnedFreeDownloadSource(id, job, identity.ownerId, identity.ipHash);
    return await downloadSavedResult(source, { signal: request.signal });
  } catch (error) {
    return errorResponse(error);
  }
}
