import { after, NextResponse } from "next/server";
import type { PaymentNotification } from "@waffo/waffo-node";
import { MAX_WEBHOOK_BODY_BYTES } from "../../../../lib/payments/config";
import { assertWebhookConfiguration, PaymentError, paymentResponse } from "../../../../lib/payments/errors";
import { readBoundedText } from "../../../../lib/payments/http";
import { verifyWaffoWebhook, waffoWebhookAck } from "../../../../lib/payments/waffo";
import { fulfillWaffoEvent, type VerifiedWaffoPayment } from "../../../../lib/payments/store";
import { flushEmailOutbox } from "../../../../lib/accounts/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertWebhookConfiguration();
    const rawBody = await readBoundedText(request, MAX_WEBHOOK_BODY_BYTES);
    const signature = request.headers.get("x-signature");
    if (!verifyWaffoWebhook(rawBody, signature).verified) {
      throw new PaymentError("WEBHOOK_SIGNATURE_INVALID", 400);
    }

    let notification: PaymentNotification;
    try {
      notification = JSON.parse(rawBody) as PaymentNotification;
    } catch {
      throw new PaymentError("WEBHOOK_SIGNATURE_INVALID", 400);
    }
    if (notification?.eventType !== "PAYMENT_NOTIFICATION") {
      return waffoAck();
    }
    const verified = verifiedWaffoPayment(notification);
    if (!verified) {
      // A verified notification that is not a paid success grants nothing.
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

/** Echo the SDK-signed success acknowledgement so Waffo stops retrying. */
function waffoAck(): NextResponse {
  const ack = waffoWebhookAck();
  return new NextResponse(ack.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-SIGNATURE": ack.signature,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Decode a verified PAYMENT_NOTIFICATION into the server-reconciled shape.
 * Only PAY_SUCCESS is ever considered; every other status is ignored. Email,
 * amount and currency are validated again inside the fulfillment transaction.
 */
function verifiedWaffoPayment(notification: PaymentNotification): VerifiedWaffoPayment | null {
  const result = notification?.result;
  if (!result || result.orderStatus !== "PAY_SUCCESS") return null;
  const paymentRequestId = result.paymentRequestId;
  const acquiringOrderId = result.acquiringOrderId;
  const orderAmount = result.orderAmount;
  const currency = result.orderCurrency;
  if (typeof paymentRequestId !== "string" || !paymentRequestId) return null;
  if (typeof acquiringOrderId !== "string" || !acquiringOrderId) return null;
  if (typeof orderAmount !== "string" || typeof currency !== "string") return null;
  const amountCents = parseAmountCents(orderAmount);
  if (amountCents === null) return null;
  const userInfo = result.userInfo as { userEmail?: unknown } | undefined;
  const merchantInfo = result.merchantInfo as { merchantId?: unknown } | undefined;
  const goodsInfo = result.goodsInfo as { goodsId?: unknown } | undefined;
  return {
    eventType: "PAYMENT_NOTIFICATION",
    paymentRequestId,
    acquiringOrderId,
    orderStatus: "PAY_SUCCESS",
    amountCents,
    currency,
    email: typeof userInfo?.userEmail === "string" ? userInfo.userEmail : "",
    merchantId: typeof merchantInfo?.merchantId === "string" ? merchantInfo.merchantId : undefined,
    goodsId: typeof goodsInfo?.goodsId === "string" ? goodsInfo.goodsId : undefined,
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
