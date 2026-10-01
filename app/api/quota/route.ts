import { cookies } from "next/headers";
import { assertFreeRegion, getDailyIdentity } from "../../../lib/generation/identity";
import { errorResponse } from "../../../lib/generation/errors";
import { assertGenerationConfig, noStoreJson } from "../../../lib/generation/http";
import { getRedis } from "../../../lib/generation/redis";
import { getQuotaSnapshot } from "../../../lib/generation/store";
import { parseQuotaKind } from "../../../lib/generation/validation";
import { FREE_LIMITS } from "../../../lib/generation/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const kind = parseQuotaKind(new URL(request.url).searchParams.get("kind"));
    assertGenerationConfig(kind);
    const cookieStore = await cookies();
    const identity = getDailyIdentity(request, cookieStore);
    if (identity.country === "IN" || identity.country === "RU") {
      return noStoreJson({ remaining: 0, limit: FREE_LIMITS[kind], available: false, code: "REGION_BLOCKED" });
    }
    assertFreeRegion(identity.country);
    const redis = getRedis();
    const snapshot = await getQuotaSnapshot(redis, identity.ipHash, kind);
    const body: { remaining: number; limit: number; available: boolean; code?: string } = {
      remaining: snapshot.remaining,
      limit: snapshot.limit,
      available: snapshot.available,
    };
    if (!snapshot.available) body.code = snapshot.remaining === 0 ? "FREE_LIMIT_REACHED" : "FREE_POOL_EXHAUSTED";
    return noStoreJson(body);
  } catch (error) {
    return errorResponse(error);
  }
}

