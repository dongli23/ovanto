import { Environment, Waffo, type CreateOrderParams } from "@waffo/waffo-node";
import {
  WAFFO_PACK_AMOUNT,
  WAFFO_PACK_CURRENCY,
  WAFFO_PACK_KEY,
  WAFFO_PACK_NAME,
  WAFFO_ENV_KEYS,
  WAFFO_PACK_PRODUCT_NAME,
  checkoutReturnUrls,
  isWaffoEnvironmentConfigured,
  waffoNotifyUrl,
  type CheckoutReturnPath,
} from "./config";
import { PaymentError } from "./errors";

let client: Waffo | undefined;

/**
 * The Waffo SDK requires an explicit SANDBOX or PRODUCTION environment. The
 * owner's production value is `WAFFO_ENVIRONMENT=prod`, so the accepted
 * spellings are normalized here.
 */
function waffoEnvironment(): Environment {
  const raw = process.env.WAFFO_ENVIRONMENT;
  if (raw === "prod" || raw === "production") return Environment.PRODUCTION;
  if (raw === "sandbox") return Environment.SANDBOX;
  throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
}

export function assertWaffoConfiguration(): void {
  const missing = WAFFO_ENV_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0 || !isWaffoEnvironmentConfigured()) {
    throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
}

/** Lazily construct and reuse the official Waffo SDK singleton. */
export function getWaffo(): Waffo {
  assertWaffoConfiguration();
  if (!client) {
    client = new Waffo({
      apiKey: process.env.WAFFO_API_KEY as string,
      privateKey: process.env.WAFFO_PRIVATE_KEY as string,
      waffoPublicKey: process.env.WAFFO_PUBLIC_KEY as string,
      environment: waffoEnvironment(),
      merchantId: process.env.WAFFO_MERCHANT_ID as string,
    });
  }
  return client;
}

export interface WaffoOrderInput {
  /** Idempotency key sent to Waffo; equals the local order id without dashes (max 32 chars). */
  paymentRequestId: string;
  /** Stable, unique merchant-side order reference. */
  merchantOrderId: string;
  returnPath: CheckoutReturnPath;
}

/**
 * Build the server-owned Waffo order request. Amount, currency, product,
 * provider/model and credits are all fixed server-side; the browser never
 * supplies them.
 */
export function buildWaffoOrderParams(input: WaffoOrderInput): CreateOrderParams {
  const { successUrl, cancelUrl } = checkoutReturnUrls(input.returnPath);
  const goodsInfo = process.env.WAFFO_PRODUCT_ID
    ? { goodsId: process.env.WAFFO_PRODUCT_ID, goodsName: WAFFO_PACK_NAME }
    : { goodsId: WAFFO_PACK_KEY, goodsName: WAFFO_PACK_NAME };
  return {
    paymentRequestId: input.paymentRequestId,
    merchantOrderId: input.merchantOrderId,
    orderCurrency: WAFFO_PACK_CURRENCY,
    orderAmount: WAFFO_PACK_AMOUNT,
    orderDescription: WAFFO_PACK_NAME,
    notifyUrl: waffoNotifyUrl(),
    // The buyer email is captured by Waffo's hosted cashier and returned in the
    // verified webhook; the browser is never trusted to prove ownership.
    userInfo: { userId: input.paymentRequestId, userEmail: "", userTerminal: "WEB" },
    paymentInfo: { productName: WAFFO_PACK_PRODUCT_NAME },
    goodsInfo,
    successRedirectUrl: successUrl,
    cancelRedirectUrl: cancelUrl,
  };
}

export interface VerifiedWaffoWebhook {
  /** true when the SDK verified the X-SIGNATURE against the Waffo public key. */
  verified: boolean;
}

/**
 * Verify a Waffo webhook using the official SDK (RSA signature against the
 * Waffo public key). This authenticates the payload only; the route decodes
 * the JSON and decides whether to grant credits.
 */
export function verifyWaffoWebhook(rawBody: string, signature: string | null): VerifiedWaffoWebhook {
  return { verified: getWaffo().webhook().verifySignature(rawBody, signature ?? "") };
}

/**
 * Signed success acknowledgement echoed back to Waffo so it stops retrying.
 * The response body is signed with the merchant private key via the SDK.
 */
export function waffoWebhookAck(): { body: string; signature: string } {
  const ack = getWaffo().webhook().buildSuccessResponse();
  return { body: ack.body, signature: ack.signature };
}

/**
 * Only Waffo's official hosted checkout host is allowed for redirects.
 * This is a strict allowlist (HTTPS, exact host, no credentials, no port),
 * never a suffix or wildcard rule.
 */
export const WAFFO_CHECKOUT_HOSTS = ["checkout.waffo.com", "cashier.waffo.com"] as const;

export function isWaffoCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
  const host = parsed.hostname.toLowerCase();
  return (WAFFO_CHECKOUT_HOSTS as readonly string[]).includes(host);
}

export function resetWaffoForTests(): void {
  client = undefined;
}
