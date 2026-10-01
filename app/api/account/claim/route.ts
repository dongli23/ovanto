import { cookies } from "next/headers";
import { ACCOUNT_SESSION_COOKIE, CHECKOUT_CLAIM_COOKIE } from "../../../../lib/payments/config";
import { assertSessionConfiguration, noStore, paymentResponse, PaymentError } from "../../../../lib/payments/errors";
import { getAccountDb } from "../../../../lib/accounts/db";
import { accountSessionCookie } from "../../../../lib/accounts/store";
import { claimPaidOrder, findOrderById, parseCheckoutClaimCookie } from "../../../../lib/payments/store";
import { assertPaymentOrigin } from "../../../../lib/payments/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSessionConfiguration();
    assertPaymentOrigin(request);
    const cookieStore = await cookies();
    const claim = parseCheckoutClaimCookie(cookieStore.get(CHECKOUT_CLAIM_COOKIE)?.value);
    if (!claim) throw new PaymentError("CHECKOUT_CLAIM_REQUIRED", 403);
    const order = await findOrderById(getAccountDb(), claim.orderId).catch(() => null);
    // The adapter call above uses the configured database internally; keeping
    // the status check separate gives a useful pending response without
    // disclosing any email or account details.
    if (order?.status === "pending") throw new PaymentError("CHECKOUT_PENDING", 409);
    if (order?.status === "checkout_failed") throw new PaymentError("CHECKOUT_UNAVAILABLE", 503);
    const existingRawSession = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
    const session = await claimPaidOrder(claim.orderId, claim.secret, getAccountDb(), existingRawSession);
    const cookie = accountSessionCookie(session.rawSession);
    cookieStore.set(cookie.name, cookie.value, cookie.options);
    cookieStore.delete(CHECKOUT_CLAIM_COOKIE);
    return noStore({ authenticated: true, balances: session.balances });
  } catch (error) {
    return paymentResponse(error);
  }
}

