import { after } from "next/server";
import { requestLoginCode } from "../../../../../lib/accounts/store";
import { assertAccountConfiguration, noStore, paymentResponse, PaymentError } from "../../../../../lib/payments/errors";
import { MAX_CHECKOUT_BODY_BYTES } from "../../../../../lib/payments/config";
import { assertPaymentOrigin, readJson } from "../../../../../lib/payments/http";
import { flushEmailOutbox } from "../../../../../lib/accounts/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAccountConfiguration();
    assertPaymentOrigin(request);
    const body = await readJson(request, MAX_CHECKOUT_BODY_BYTES);
    if (Object.keys(body).some((key) => key !== "email") || typeof body.email !== "string") throw new PaymentError("REQUEST_INVALID", 400);
    await requestLoginCode(body.email, request);
    after(async () => {
      try { await flushEmailOutbox(10); } catch { /* retry worker remains authoritative */ }
    });
    return noStore({ message: "If a paid account exists for this email, a login code has been sent." });
  } catch (error) {
    return paymentResponse(error);
  }
}

