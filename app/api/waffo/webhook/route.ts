import { after, NextResponse } from "next/server";
import { WebhookEventType, type WebhookEvent, type WebhookEventData } from "@waffo/pancake-ts";
import { MAX_WEBHOOK_BODY_BYTES, WAFFO_PACK_NAME, WAFFO_PACK_PRICE_CENTS } from "../../../../lib/payments/config";
import { assertWebhookConfiguration, PaymentError, paymentResponse } from "../../../../lib/payments/errors";
import { readBoundedText } from "../../../../lib/payments/http";
import { parseWaffoWebhook } from "../../../../lib/payments/waffo";
import { fulfillWaffoEvent, type VerifiedWaffoPayment } from "../../../../lib/payments/store";
import { flushEmailOutbox } from "../../../../lib/accounts/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertWebhookConfiguration();
    const rawBody = await readBoundedText(request, MAX_WEBHOOK_BODY_BYTES);
    const signature = request.headers.get("x-waffo-signature");
    const event = parseWaffoWebhook(rawBody, signature);
    if (!event) {
      throw new PaymentError("WEBHOOK_SIGNATURE_INVALID", 400);
    }

    // Only the one-time order completion event can ever grant credits. Every
    // other verified event acknowledges without side effects.
    if (event.eventType !== WebhookEventType.OrderCompleted) {
      return waffoAck();
    }
    const verified = verifiedWaffoPayment(event);
    if (!verified) {
      // A verified completion that fails server reconciliation grants nothing.
      return waffoAck();
    }
    await fulfillWaffoEvent(verified);
    scheduleOutboxFlush();
    return waffoAck();
  } catch (error) {
    return paymentResponse(error);
  }
}

function scheduleOutboxFlush(): void {
  after(async () => {
    try { await flushEmailOutbox(10); } catch { /* retry worker remains authoritative */ }
  });
}

/**
 * Pancake webhooks need only a fast 2xx acknowledgement; the SDK signs
 * inbound deliveries, so no signed response is required.
 */
function waffoAck(): NextResponse {
  return new NextResponse(JSON.stringify({ received: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Decode a verified `order.completed` event into the server-reconciled shape.
 * Amount, currency, store, environment, product and the merchant external id
 * are validated again inside the fulfillment transaction.
 */
function verifiedWaffoPayment(event: WebhookEvent<WebhookEventData>): VerifiedWaffoPayment | null {
  const data = event.data;
  if (!data) return null;
  if (data.orderStatus !== "completed" || data.paymentStatus !== "succeeded") return null;
  const orderId = data.orderId;
  const externalOrderId = data.orderMerchantExternalId;
  const storeId = event.storeId;
  if (typeof orderId !== "string" || !orderId) return null;
  if (typeof externalOrderId !== "string" || !externalOrderId) return null;
  if (typeof storeId !== "string" || !storeId) return null;
  // Prefer the amount actually charged; fall back to the list price snapshot.
  const amountDisplay = data.chargedAmount ?? data.listPrice?.total ?? data.amount;
  const currency = data.currency;
  if (typeof amountDisplay !== "string" || typeof currency !== "string") return null;
  const amountCents = parseAmountCents(amountDisplay);
  if (amountCents === null || amountCents !== WAFFO_PACK_PRICE_CENTS) return null;
  if (typeof data.buyerEmail !== "string" || !data.buyerEmail) return null;
  if (typeof data.productName !== "string" || data.productName !== WAFFO_PACK_NAME) return null;
  return {
    eventId: event.id,
    orderId,
    externalOrderId,
    storeId,
    mode: event.mode,
    orderStatus: data.orderStatus,
    paymentStatus: data.paymentStatus,
    productName: data.productName,
    amountCents,
    currency,
    email: data.buyerEmail,
  };
}

function parseAmountCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + fraction;
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}
