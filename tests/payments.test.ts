import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import {
  MIN_STRIPE_AMOUNT_CENTS,
  PAID_PRODUCTS,
  paidCatalog,
  minimumQuantity,
  orderAmountCents,
  retailPriceCents,
} from "../lib/payments/config";
import { constructStripeEvent, resetStripeForTests } from "../lib/payments/stripe";
import { parseCheckoutClaimCookie } from "../lib/payments/store";
import { PaymentError } from "../lib/payments/errors";
import { decryptOutboxToken, encryptOutboxToken } from "../lib/accounts/crypto";
import { sendEmail } from "../lib/accounts/email";
import { buildCheckoutParams } from "../lib/payments/checkout";

const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  resetStripeForTests();
});

test("retail prices are server configuration and video stays within the approved range", () => {
  process.env.PAID_IMAGE_PRICE_CENTS = "99";
  process.env.PAID_EDIT_PRICE_CENTS = "199";
  process.env.PAID_VIDEO_PRICE_CENTS = "149";
  assert.equal(retailPriceCents("image"), 99);
  assert.equal(retailPriceCents("video"), 149);
  assert.equal(minimumQuantity("image"), 1);
  assert.equal(orderAmountCents("image", 3), 297);
  assert.equal(PAID_PRODUCTS.video.expectedCostMicroUsd, 350_000);
  assert.equal(MIN_STRIPE_AMOUNT_CENTS, 50);
});

test("catalog fails closed when a retail price is missing", () => {
  delete process.env.PAID_IMAGE_PRICE_CENTS;
  delete process.env.PAID_EDIT_PRICE_CENTS;
  delete process.env.PAID_VIDEO_PRICE_CENTS;
  const catalog = paidCatalog();
  assert.equal(catalog.length, 3);
  assert.ok(catalog.every((item) => item.enabled === false && item.unitAmountCents === null));
});

test("checkout claim cookie requires a UUID order and nontrivial browser secret", () => {
  assert.equal(parseCheckoutClaimCookie(undefined), null);
  assert.equal(parseCheckoutClaimCookie("known-session-id.only"), null);
  assert.equal(parseCheckoutClaimCookie("not-a-uuid." + "a".repeat(40)), null);
  const parsed = parseCheckoutClaimCookie("123e4567-e89b-12d3-a456-426614174000." + "a".repeat(40));
  assert.equal(parsed?.orderId, "123e4567-e89b-12d3-a456-426614174000");
});

test("outbox token envelope is decryptable only with the server secret", () => {
  process.env.ACCOUNT_TOKEN_SECRET = "x".repeat(32);
  const encrypted = encryptOutboxToken("one-time-token");
  assert.equal(decryptOutboxToken(encrypted), "one-time-token");
  process.env.ACCOUNT_TOKEN_SECRET = "y".repeat(32);
  assert.throws(() => decryptOutboxToken(encrypted), (error: unknown) => error instanceof PaymentError && error.code === "EMAIL_OUTBOX_CORRUPT");
});

test("Stripe webhook signature tampering fails before event handling", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  assert.throws(() => constructStripeEvent("{}", "t=1,v1=not-valid"), (error: unknown) => error instanceof PaymentError && error.code === "WEBHOOK_SIGNATURE_INVALID");
});

test("checkout request uses the unit price once and reconciles quantity three metadata", () => {
  const params = buildCheckoutParams({
    orderId: "123e4567-e89b-12d3-a456-426614174000",
    product: PAID_PRODUCTS.image,
    quantity: 3,
    unitAmountCents: 100,
    amountCents: 300,
    successUrl: "https://ovanto.ai/it/?session_id={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://ovanto.ai/it/",
  });
  const line = params.line_items?.[0];
  assert.equal(line?.price_data?.unit_amount, 100);
  assert.equal(line?.quantity, 3);
  assert.equal((line?.price_data?.unit_amount ?? 0) * Number(line?.quantity), Number(params.metadata?.amount_cents));
  assert.equal(params.payment_method_types?.[0], "card");
  assert.equal(params.customer_creation, "if_required");
});

test("Resend adapter rejects redirects, disables caching, and sends stable retry idempotency", async () => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "no-reply@ovanto.ai";
  let request: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    request = init;
    return new Response("{}", { status: 200 });
  };
  await sendEmail({ to: "buyer@example.com", subject: "test", html: "<p>test</p>", text: "test", idempotencyKey: "ovanto-outbox-test" });
  assert.equal(request?.redirect, "error");
  assert.equal(request?.cache, "no-store");
  assert.equal((request?.headers as Record<string, string>)?.["Idempotency-Key"], "ovanto-outbox-test");
});

