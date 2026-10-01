import { getPaidSession } from "../../../../lib/accounts/store";
import { assertSessionConfiguration, noStore, paymentResponse } from "../../../../lib/payments/errors";
import { ACCOUNT_SESSION_COOKIE } from "../../../../lib/payments/config";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value) return noStore({ authenticated: false, balances: null });
    assertSessionConfiguration();
    const session = await getPaidSession(request);
    if (!session) return noStore({ authenticated: false, balances: null });
    return noStore({ authenticated: true, balances: session.balances });
  } catch (error) {
    return paymentResponse(error);
  }
}

