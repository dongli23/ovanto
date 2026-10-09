import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { test, afterEach } from "node:test";
import {
  WAFFO_PACK_CREDITS,
  WAFFO_PACK_CURRENCY,
  WAFFO_PACK_NAME,
  WAFFO_PACK_PRICE_CENTS,
  waffoCatalog,
} from "../lib/payments/config";
import {
  assertWaffoConfiguration,
  buildWaffoCheckoutParams,
  isWaffoCheckoutUrl,
  parseWaffoWebhook,
  resetWaffoForTests,
  waffoEnvironment,
} from "../lib/payments/waffo";
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

function configureWaffo(overrides: Record<string, string | undefined> = {}) {
  process.env.WAFFO_MERCHANT_ID = "MER_testmerchant0000000001";
  process.env.WAFFO_PRIVATE_KEY = "test-private-key";
  process.env.WAFFO_STORE_ID = "STO_teststore000000000001";
  process.env.WAFFO_PRODUCT_ID = "PROD_testproduct000000001";
  process.env.WAFFO_ENVIRONMENT = "prod";
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function generateTestKeys() {
  return generateKeyPairSync("rsa", { modulusLength: 2048 });
}

/** Sign a webhook body the way the Waffo Pancake platform does. */
function signWebhookBody(body: string, privateKey: string): string {
  const t = Date.now();
  const signer = createSign("RSA-SHA256");
  signer.update(`${t}.${body}`);
  const v1 = signer.sign(privateKey, "base64");
  return `t=${t},v1=${v1}`;
}

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
  assert.equal(WAFFO_PACK_CURRENCY, "USD");
});

test("checkout session params lock product and currency and expose no amount", () => {
  configureWaffo();
  const params = buildWaffoCheckoutParams({ orderId: "123e4567-e89b-12d3-a456-426614174000", returnPath: "/it/" });
  assert.equal(params.productId, "PROD_testproduct000000001");
  assert.equal(params.currency, "USD");
  assert.equal(params.orderMerchantExternalId, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(params.metadata?.pack, "video");
  assert.ok("amount" in params === false);
  assert.ok("priceSnapshot" in params === false);
  assert.ok(params.successUrl?.includes("payment=success"));
});

test("checkout claim cookie requires a UUID order and nontrivial browser secret", () => {
  assert.equal(parseCheckoutClaimCookie(undefined), null);
  assert.equal(parseCheckoutClaimCookie("known-session-id.only"), null);
  assert.equal(parseCheckoutClaimCookie("not-a-uuid." + "a".repeat(40)), null);
  const parsed = parseCheckoutClaimCookie("123e4567-e89b-12d3-a456-426614174000." + "a".repeat(40));
  assert.equal(parsed?.orderId, "123e4567-e89b-12d3-a456-426614174000");
});

test("Waffo checkout URL allowlist rejects non-Waffo hosts, insecure schemes, and credentials", () => {
  assert.equal(isWaffoCheckoutUrl("https://pancake.waffo.ai/store/slug/checkout/SES_123"), true);
  assert.equal(isWaffoCheckoutUrl("https://checkout.stripe.com/c/pay"), false);
  assert.equal(isWaffoCheckoutUrl("https://checkout.waffo.com/pay/abc"), false);
  assert.equal(isWaffoCheckoutUrl("https://cashier.waffo.com/pay/abc"), false);
  assert.equal(isWaffoCheckoutUrl("http://pancake.waffo.ai/store/slug"), false);
  assert.equal(isWaffoCheckoutUrl("https://evil.com/pay"), false);
  assert.equal(isWaffoCheckoutUrl("https://pancake.waffo.com.evil.com/pay"), false);
  assert.equal(isWaffoCheckoutUrl("https://user:pass@pancake.waffo.ai/store/slug"), false);
});

test("Waffo configuration requires merchant id and private key only, plus store/product/environment", () => {
  configureWaffo();
  delete process.env.WAFFO_API_KEY;
  delete process.env.WAFFO_PUBLIC_KEY;
  assertWaffoConfiguration();
  assert.equal(waffoEnvironment(), "prod");

  configureWaffo({ WAFFO_MERCHANT_ID: undefined });
  assert.throws(() => assertWaffoConfiguration(), (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE");

  configureWaffo({ WAFFO_PRIVATE_KEY: undefined });
  assert.throws(() => assertWaffoConfiguration(), (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE");

  configureWaffo({ WAFFO_STORE_ID: undefined });
  assert.throws(() => assertWaffoConfiguration(), (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE");

  configureWaffo({ WAFFO_PRODUCT_ID: undefined });
  assert.throws(() => assertWaffoConfiguration(), (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE");

  configureWaffo({ WAFFO_ENVIRONMENT: "staging" });
  assert.throws(() => assertWaffoConfiguration(), (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE");

  configureWaffo({ WAFFO_ENVIRONMENT: "sandbox" });
  assertWaffoConfiguration();
  assert.equal(waffoEnvironment(), "test");
});

test("Waffo webhook signature verification rejects tampering and accepts signed events", () => {
  const keys = generateTestKeys();
  const privateKey = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.WAFFO_WEBHOOK_PUBLIC_KEY = publicKey;
  process.env.WAFFO_ENVIRONMENT = "test";
  const body = JSON.stringify({
    id: "550e8400-e29b-41d4-a716-446655440000",
    timestamp: new Date().toISOString(),
    eventType: "order.completed",
    eventId: "PAY_5xK9mRtYvWnPqLsJ3hBfDe",
    storeId: "STO_teststore000000000001",
    storeName: "Ovanto",
    mode: "test",
    data: {
      orderId: "ORD_1234567890abcdefghijkl",
      orderStatus: "completed",
      buyerEmail: "buyer@example.com",
      orderMerchantExternalId: "123e4567-e89b-12d3-a456-426614174000",
      currency: "USD",
      chargedAmount: "4.99",
      productName: WAFFO_PACK_NAME,
      paymentStatus: "succeeded",
    },
  });
  const valid = signWebhookBody(body, privateKey);
  const event = parseWaffoWebhook(body, valid);
  assert.ok(event);
  assert.equal(event.eventType, "order.completed");
  assert.equal(event.data.orderMerchantExternalId, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(event.data.chargedAmount, "4.99");

  assert.equal(parseWaffoWebhook(body, "t=1,v1=invalid"), null);
  assert.equal(parseWaffoWebhook(body, null), null);
  // A body tampered after signing no longer verifies.
  assert.equal(parseWaffoWebhook(body.replace("4.99", "9.99"), valid), null);

  // A signature made for the other environment is rejected: pin the prod
  // public key to a different keypair so the test-signed body fails there.
  process.env.WAFFO_ENVIRONMENT = "prod";
  const otherKeys = generateTestKeys();
  process.env.WAFFO_WEBHOOK_PROD_PUBLIC_KEY = otherKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  assert.equal(parseWaffoWebhook(body, valid), null);
});

test("outbox token envelope is decryptable only with the server secret", () => {
  process.env.ACCOUNT_TOKEN_SECRET = "x".repeat(32);
  const encrypted = encryptOutboxToken("one-time-token");
  assert.equal(decryptOutboxToken(encrypted), "one-time-token");
  process.env.ACCOUNT_TOKEN_SECRET = "y".repeat(32);
  assert.throws(() => decryptOutboxToken(encrypted), (error: unknown) => error instanceof PaymentError && error.code === "EMAIL_OUTBOX_CORRUPT");
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
