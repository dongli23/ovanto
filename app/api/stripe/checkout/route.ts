import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { getAccountDb, isUniqueViolation } from "../../../../lib/accounts/db";
import {
  CHECKOUT_CLAIM_COOKIE,
  MAX_CHECKOUT_BODY_BYTES,
  assertCheckoutReturnPath,
  checkoutUrls,
  hashSecret,
  isPaidProductKey,
  newClaimSecret,
  orderAmountCents,
  parseQuantity,
  productFor,
  retailPriceCents,
  ORDER_CURRENCY,
} from "../../../../lib/payments/config";
import { assertPaymentConfiguration, paymentResponse, noStore, PaymentError } from "../../../../lib/payments/errors";
import { assertPaymentOrigin, readJson } from "../../../../lib/payments/http";
import { getStripe } from "../../../../lib/payments/stripe";
import { buildCheckoutParams } from "../../../../lib/payments/checkout";
import {
  attachCheckoutSession,
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
    const allowed = new Set(["product", "quantity", "returnPath"]);
    for (const key of Object.keys(body)) if (!allowed.has(key)) throw new PaymentError("REQUEST_INVALID", 400);
    if (!isPaidProductKey(body.product)) throw new PaymentError("PRODUCT_INVALID", 400);
    const product = productFor(body.product);
    const quantity = parseQuantity(body.quantity);
    const returnPath = assertCheckoutReturnPath(body.returnPath ?? "/it/");
    const unitAmountCents = retailPriceCents(product.key);
    const amountCents = orderAmountCents(product.key, quantity);
    const idempotencyKey = idempotencyKeyFromRequest(request);
    const db = getAccountDb();
    const cookieStore = await cookies();
    const prior = await findOrderByIdempotency(db, idempotencyKey);
    if (prior) {
      if (prior.product !== product.key || prior.quantity !== quantity || prior.amountCents !== amountCents || prior.returnPath !== returnPath) {
        throw new PaymentError("CHECKOUT_IDEMPOTENCY_CONFLICT", 409);
      }
      const claim = cookieStore.get(CHECKOUT_CLAIM_COOKIE)?.value;
      if (!claimMatchesOrder(claim, prior)) throw new PaymentError("CHECKOUT_IN_PROGRESS", 409);
      if (prior.status === "paid") return noStore({ orderId: prior.id, status: prior.status }, 200);
      if (!prior.stripeCheckoutSessionId) throw new PaymentError("CHECKOUT_IN_PROGRESS", 409);
      const existing = await getStripe().checkout.sessions.retrieve(prior.stripeCheckoutSessionId);
      if (!existing.url) throw new PaymentError("CHECKOUT_UNAVAILABLE", 503);
      return noStore({ orderId: prior.id, url: existing.url }, 200);
    }

    const orderId = randomUUID();
    const claimSecret = newClaimSecret();
    let order: OrderRecord;
    try {
      order = await insertPendingOrder(db, {
        id: orderId,
        idempotencyKey,
        product: product.key,
        quantity,
        unitAmountCents,
        amountCents,
        currency: ORDER_CURRENCY,
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

    let session;
    try {
      const urls = checkoutUrls(returnPath);
      session = await getStripe().checkout.sessions.create(
        buildCheckoutParams({ orderId: order.id, product, quantity, unitAmountCents, amountCents, successUrl: urls.successUrl, cancelUrl: urls.cancelUrl }),
        { idempotencyKey },
      );
      if (!session.url) throw new PaymentError("CHECKOUT_UNAVAILABLE", 503);
    } catch (error) {
      await markCheckoutFailed(db, order.id);
      throw error;
    }
    await attachCheckoutSession(db, order.id, session.id);
    return noStore({ orderId: order.id, url: session.url }, 201);
  } catch (error) {
    return paymentResponse(error);
  }
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

