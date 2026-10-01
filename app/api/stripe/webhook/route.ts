import type Stripe from "stripe";
import { after } from "next/server";
import { MAX_WEBHOOK_BODY_BYTES } from "../../../../lib/payments/config";
import { paymentResponse, noStore, assertWebhookConfiguration, PaymentError } from "../../../../lib/payments/errors";
import { readBoundedText } from "../../../../lib/payments/http";
import { constructStripeEvent } from "../../../../lib/payments/stripe";
import { fulfillCheckoutEvent } from "../../../../lib/payments/store";
import { flushEmailOutbox } from "../../../../lib/accounts/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertWebhookConfiguration();
    const rawBody = await readBoundedText(request, MAX_WEBHOOK_BODY_BYTES);
    const event = constructStripeEvent(rawBody, request.headers.get("stripe-signature"));
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      return noStore({ received: true, ignored: true });
    }
    const session = event.data.object as Stripe.Checkout.Session;
    const verified = verifiedCheckout(event, session);
    const result = await fulfillCheckoutEvent(verified);
    scheduleOutboxFlush();
    return noStore({ received: true, duplicate: result.duplicate });
  } catch (error) {
    return paymentResponse(error);
  }
}

function scheduleOutboxFlush(): void {
  after(async () => {
    try { await flushEmailOutbox(10); } catch { /* retry worker remains authoritative */ }
  });
}

function verifiedCheckout(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") throw new PaymentError("CHECKOUT_NOT_PAID", 400);
  const metadata = session.metadata;
  const email = session.customer_details?.email || session.customer_email;
  if (!metadata || !metadata.order_id || !metadata.product || !metadata.model || !metadata.quantity || !metadata.amount_cents || !email || session.client_reference_id !== metadata.order_id) {
    throw new PaymentError("CHECKOUT_VALIDATION_FAILED", 400);
  }
  const amountTotal = session.amount_total;
  if (amountTotal === null || !Number.isSafeInteger(amountTotal) || amountTotal <= 0 || session.currency?.toLowerCase() !== "usd") {
    throw new PaymentError("CHECKOUT_VALIDATION_FAILED", 400);
  }
  return {
    eventId: event.id,
    eventType: event.type as "checkout.session.completed" | "checkout.session.async_payment_succeeded",
    sessionId: session.id,
    paymentStatus: "paid" as const,
    amountTotal,
    currency: session.currency,
    clientReferenceId: session.client_reference_id,
    metadata: {
      orderId: metadata.order_id,
      product: metadata.product,
      model: metadata.model,
      quantity: metadata.quantity,
      amountCents: metadata.amount_cents,
    },
    email,
  };
}

