import { cookies } from "next/headers";
import { consumeActivationToken, accountSessionCookie } from "../../../../lib/accounts/store";
import { assertSessionConfiguration, noStore, paymentResponse, PaymentError } from "../../../../lib/payments/errors";
import { MAX_CHECKOUT_BODY_BYTES } from "../../../../lib/payments/config";
import { assertPaymentOrigin, readJson } from "../../../../lib/payments/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSessionConfiguration();
    assertPaymentOrigin(request);
    const body = await readJson(request, MAX_CHECKOUT_BODY_BYTES);
    if (Object.keys(body).some((key) => key !== "token") || typeof body.token !== "string") throw new PaymentError("REQUEST_INVALID", 400);
    const session = await consumeActivationToken(body.token);
    const cookieStore = await cookies();
    const cookie = accountSessionCookie(session.rawSession);
    cookieStore.set(cookie.name, cookie.value, cookie.options);
    return noStore({ authenticated: true, balances: session.balances });
  } catch (error) {
    return paymentResponse(error);
  }
}

