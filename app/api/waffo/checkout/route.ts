import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { WaffoPancakeError } from "@waffo/pancake-ts";
import { getAccountDb, isUniqueViolation } from "../../../../lib/accounts/db";
import {
  CHECKOUT_CLAIM_COOKIE,
  MAX_CHECKOUT_BODY_BYTES,
  ORDER_CURRENCY,
  WAFFO_PACK_KEY,
  WAFFO_PACK_PRICE_CENTS,
  assertCheckoutReturnPath,
  hashSecret,
  newClaimSecret,
  productFor,
  type CheckoutReturnPath,
} from "../../../../lib/payments/config";
import { assertPaymentConfiguration, noStore, PaymentError, paymentResponse } from "../../../../lib/payments/errors";
import { assertPaymentOrigin, readJson } from "../../../../lib/payments/http";
import { buildWaffoCheckoutParams, getWaffo, isWaffoCheckoutUrl } from "../../../../lib/payments/waffo";
import {
  findOrderByIdempotency,
  insertPendingOrder,
  markCheckoutFailed,
  type OrderRecord,
} from "../../../../lib/payments/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertPaymentConfiguration();
    assertPaymentOrigin(request);
    const body = await readJson(request, MAX_CHECKOUT_BODY_BYTES);
    // The browser may only name the pack and its return path. Amount, credits,
    // currency, provider and model are all server-owned and locked.
    for (const key of Object.keys(body)) if (key !== "product" && key !== "returnPath") throw new PaymentError("REQUEST_INVALID", 400);
    if (body.product !== undefined && body.product !== "video" && body.product !== "video_pack") {
      throw new PaymentError("PRODUCT_INVALID", 400);
    }
    const product = productFor(WAFFO_PACK_KEY);
    const returnPath = assertCheckoutReturnPath(body.returnPath ?? "/it/");
    const idempotencyKey = idempotencyKeyFromRequest(request);
    const db = getAccountDb();
    const cookieStore = await cookies();

    const prior = await findOrderByIdempotency(db, idempotencyKey);
    if (prior && prior.status !== "checkout_failed") {
      if (prior.product !== product.key || prior.amountCents !== WAFFO_PACK_PRICE_CENTS || prior.returnPath !== returnPath) {
        throw new PaymentError("CHECKOUT_IDEMPOTENCY_CONFLICT", 409);
      }
      const claim = cookieStore.get(CHECKOUT_CLAIM_COOKIE)?.value;
      if (!claimMatchesOrder(claim, prior)) throw new PaymentError("CHECKOUT_IN_PROGRESS", 409);
      if (prior.status === "paid") return noStore({ orderId: prior.id, status: prior.status }, 200);
      // The same local order is reused; the create-session idempotency key
      // (the order id) replays the platform's cached session for 24 hours.
      return noStore({ orderId: prior.id, url: await createCheckoutSession(prior.id, returnPath, prior.id.replace(/-/g, "")) }, 200);
    }

    const orderId = randomUUID();
    // The create-session idempotency key is at most 256 chars; the local order
    // id without dashes is a stable, unique 32-char key.
    const paymentRequestId = orderId.replace(/-/g, "");
    const claimSecret = newClaimSecret();
    let order: OrderRecord;
    try {
      order = await insertPendingOrder(db, {
        id: orderId,
        idempotencyKey,
        product: product.key,
        quantity: 1,
        unitAmountCents: WAFFO_PACK_PRICE_CENTS,
        amountCents: WAFFO_PACK_PRICE_CENTS,
        currency: ORDER_CURRENCY,
        // The merchant external id reconciles webhook deliveries to this order.
        waffoPaymentRequestId: orderId,
        claimSecretHash: hashSecret(claimSecret),
        returnPath,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new PaymentError("CHECKOUT_IN_PROGRESS", 409);
      throw error;
    }
    cookieStore.set(CHECKOUT_CLAIM_COOKIE, `${order.id}.${claimSecret}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
      path: "/",
      maxAge: 2 * 24 * 60 * 60,
    });

    try {
      const url = await createCheckoutSession(order.id, returnPath, paymentRequestId);
      return noStore({ orderId: order.id, url }, 201);
    } catch (error) {
      await markCheckoutFailed(db, order.id);
      throw error;
    }
  } catch (error) {
    return paymentResponse(error);
  }
}

/**
 * Create a Pancake hosted checkout session for the Pro Video Pack. Price,
 * product, currency, model and credits are locked to the Waffo product
 * version plus server-owned constants; the browser controls none of them.
 */
async function createCheckoutSession(orderId: string, returnPath: CheckoutReturnPath, paymentRequestId?: string): Promise<string> {
  let session;
  try {
    session = await getWaffo().checkout.createSession(
      buildWaffoCheckoutParams({ orderId, returnPath }),
      paymentRequestId ? { idempotencyKey: paymentRequestId } : undefined,
    );
  } catch (error) {
    if (error instanceof WaffoPancakeError) throw new PaymentError("CHECKOUT_UNAVAILABLE", 503);
    throw error;
  }
  if (!session?.checkoutUrl || !isWaffoCheckoutUrl(session.checkoutUrl)) {
    throw new PaymentError("CHECKOUT_UNAVAILABLE", 503);
  }
  return session.checkoutUrl;
}

function idempotencyKeyFromRequest(request: Request): string {
  const value = request.headers.get("idempotency-key")?.trim() || randomUUID();
  if (value.length < 8 || value.length > 255 || !/^[A-Za-z0-9._:-]+$/.test(value)) throw new PaymentError("IDEMPOTENCY_KEY_INVALID", 400);
  return value;
}

function claimMatchesOrder(cookieValue: string | undefined, order: OrderRecord): boolean {
  if (!cookieValue) return false;
  const separator = cookieValue.indexOf(".");
  if (separator <= 0 || cookieValue.slice(0, separator) !== order.id) return false;
  return hashSecret(cookieValue.slice(separator + 1)) === order.claimSecretHash;
}
