import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { RsaUtils } from "@waffo/waffo-node";
import {
  WAFFO_PACK_AMOUNT,
  WAFFO_PACK_CREDITS,
  WAFFO_PACK_CURRENCY,
  WAFFO_PACK_NAME,
  WAFFO_PACK_PRICE_CENTS,
  waffoCatalog,
} from "../lib/payments/config";
import { buildWaffoOrderParams, isWaffoCheckoutUrl, resetWaffoForTests, verifyWaffoWebhook, waffoWebhookAck } from "../lib/payments/waffo";
import { parseCheckoutClaimCookie } from "../lib/payments/store";
import { decryptOutboxToken, encryptOutboxToken } from "../lib/accounts/crypto";
import { sendEmail } from "../lib/accounts/email";
import { PaymentError } from "../lib/payments/errors";

const savedEnv = { ...process.env };
const savedFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = savedFetch;
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  resetWaffoForTests();
});

test("the Waffo catalog exposes exactly one server-owned product", () => {
  const catalog = waffoCatalog();
  assert.equal(catalog.length, 1);
  assert.deepEqual(catalog[0], {
    key: "video",
    model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    packPriceCents: 499,
    credits: 3,
  });
  assert.equal(WAFFO_PACK_PRICE_CENTS, 499);
  assert.equal(WAFFO_PACK_CREDITS, 3);
  assert.equal(WAFFO_PACK_AMOUNT, "4.99");
  assert.equal(WAFFO_PACK_CURRENCY, "USD");
});

test("Waffo order params lock amount, currency, and product and expose no quantity", () => {
  const params = buildWaffoOrderParams({ paymentRequestId: "a".repeat(32), merchantOrderId: "order-1", returnPath: "/it/" });
  assert.equal(params.orderAmount, "4.99");
  assert.equal(params.orderCurrency, "USD");
  assert.equal(params.orderDescription, WAFFO_PACK_NAME);
  assert.equal(params.paymentInfo?.productName, "ONE_TIME_PAYMENT");
  assert.equal("quantity" in params, false);
  assert.ok(params.successRedirectUrl?.includes("payment=success"));
  assert.ok(params.notifyUrl?.endsWith("/api/waffo/webhook"));
});

test("checkout claim cookie requires a UUID order and nontrivial browser secret", () => {
  assert.equal(parseCheckoutClaimCookie(undefined), null);
  assert.equal(parseCheckoutClaimCookie("known-session-id.only"), null);
  assert.equal(parseCheckoutClaimCookie("not-a-uuid." + "a".repeat(40)), null);
  const parsed = parseCheckoutClaimCookie("123e4567-e89b-12d3-a456-426614174000." + "a".repeat(40));
  assert.equal(parsed?.orderId, "123e4567-e89b-12d3-a456-426614174000");
});

test("Waffo checkout URL allowlist rejects non-Waffo hosts, insecure schemes, and credentials", () => {
  assert.equal(isWaffoCheckoutUrl("https://checkout.waffo.com/pay/abc"), true);
  assert.equal(isWaffoCheckoutUrl("https://cashier.waffo.com/pay/abc"), true);
  assert.equal(isWaffoCheckoutUrl("https://checkout.stripe.com/c/pay"), false);
  assert.equal(isWaffoCheckoutUrl("http://checkout.waffo.com/pay"), false);
  assert.equal(isWaffoCheckoutUrl("https://evil.com/pay"), false);
  assert.equal(isWaffoCheckoutUrl("https://checkout.waffo.com.evil.com/pay"), false);
  assert.equal(isWaffoCheckoutUrl("https://user:pass@checkout.waffo.com/pay"), false);
});

test("outbox token envelope is decryptable only with the server secret", () => {
  process.env.ACCOUNT_TOKEN_SECRET = "x".repeat(32);
  const encrypted = encryptOutboxToken("one-time-token");
  assert.equal(decryptOutboxToken(encrypted), "one-time-token");
  process.env.ACCOUNT_TOKEN_SECRET = "y".repeat(32);
  assert.throws(() => decryptOutboxToken(encrypted), (error: unknown) => error instanceof PaymentError && error.code === "EMAIL_OUTBOX_CORRUPT");
});

test("Waffo webhook signature verification rejects tampering", () => {
  const keyPair = RsaUtils.generateKeyPair();
  process.env.WAFFO_API_KEY = "test-api-key";
  process.env.WAFFO_PRIVATE_KEY = keyPair.privateKey;
  process.env.WAFFO_PUBLIC_KEY = keyPair.publicKey;
  process.env.WAFFO_MERCHANT_ID = "test-merchant";
  process.env.WAFFO_ENVIRONMENT = "sandbox";
  const body = JSON.stringify({ eventType: "PAYMENT_NOTIFICATION" });
  const valid = RsaUtils.sign(body, keyPair.privateKey);
  assert.equal(verifyWaffoWebhook(body, valid).verified, true);
  assert.equal(verifyWaffoWebhook(body, "t=1,v1=invalid").verified, false);
  assert.equal(verifyWaffoWebhook(body, null).verified, false);
  const ack = waffoWebhookAck();
  assert.ok(ack.body.length > 0 && ack.signature.length > 0);
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
