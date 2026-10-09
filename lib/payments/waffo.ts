import {
  Environment,
  WaffoPancake,
  verifyWebhook,
  type CreateCheckoutSessionParams,
  type WebhookEvent,
  type WebhookEventData,
} from "@waffo/pancake-ts";
import {
  WAFFO_PACK_CURRENCY,
  WAFFO_PACK_KEY,
  WAFFO_PACK_NAME,
  WAFFO_ENV_KEYS,
  checkoutReturnUrls,
  isWaffoEnvironmentConfigured,
  type CheckoutReturnPath,
} from "./config";
import { PaymentError } from "./errors";

let client: WaffoPancake | undefined;

/**
 * The Waffo Pancake SDK operates in `test` or `prod`. The owner's production
 * value is `WAFFO_ENVIRONMENT=prod`; accepted spellings are normalized here.
 */
export function waffoEnvironment(): Environment {
  const raw = process.env.WAFFO_ENVIRONMENT;
  if (raw === "prod" || raw === "production") return Environment.Prod;
  if (raw === "test" || raw === "sandbox") return Environment.Test;
  throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
}

export function assertWaffoConfiguration(): void {
  const missing = WAFFO_ENV_KEYS.filter((key) => !process.env[key]);
  if (missing.length > 0 || !isWaffoEnvironmentConfigured()) {
    throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
}

/**
 * Lazily construct and reuse the official Waffo Pancake SDK singleton.
 *
 * The Pancake credential model is merchant id + RSA merchant private key only
 * (the Dashboard "copy key" value, Base64 PKCS#8, is accepted by the SDK as-is).
 * Webhook verification uses the SDK built-in Test/Production public keys; an
 * optional `WAFFO_WEBHOOK_PUBLIC_KEY` override is read by the SDK itself and
 * never blocks production.
 */
export function getWaffo(): WaffoPancake {
  assertWaffoConfiguration();
  if (!client) {
    client = new WaffoPancake({
      merchantId: process.env.WAFFO_MERCHANT_ID as string,
      privateKey: process.env.WAFFO_PRIVATE_KEY as string,
      environment: waffoEnvironment(),
    });
  }
  return client;
}

export interface WaffoCheckoutInput {
  /** Local order id; becomes orderMerchantExternalId for webhook reconciliation. */
  orderId: string;
  returnPath: CheckoutReturnPath;
}

/**
 * Build the server-owned Pancake hosted checkout session request. Product,
 * currency, credits, provider/model and price all come from the locked
 * Waffo product version plus server-owned constants; the browser never
 * supplies them and no amount field exists on the request.
 */
export function buildWaffoCheckoutParams(input: WaffoCheckoutInput): CreateCheckoutSessionParams {
  const { successUrl } = checkoutReturnUrls(input.returnPath);
  return {
    productId: process.env.WAFFO_PRODUCT_ID as string,
    currency: WAFFO_PACK_CURRENCY,
    successUrl,
    // Stable merchant-side reference inherited by the order, its payment and
    // the webhook payload — the sole key used to reconcile deliveries.
    orderMerchantExternalId: input.orderId,
    metadata: { pack: WAFFO_PACK_KEY, packName: WAFFO_PACK_NAME },
  };
}

/**
 * Verify a Waffo Pancake webhook using the official SDK: RSA-SHA256 over
 * `t.rawBody` against the environment public key, with replay protection.
 * Returns the parsed event, or null when the signature cannot be verified.
 * This authenticates the payload only; the route decodes and reconciles it.
 */
export function parseWaffoWebhook(rawBody: string, signature: string | null): WebhookEvent<WebhookEventData> | null {
  try {
    return verifyWebhook<WebhookEventData>(rawBody, signature ?? undefined, { environment: waffoEnvironment() });
  } catch {
    return null;
  }
}

/**
 * Only Waffo's official Pancake hosted checkout host is allowed for redirects.
 * This is a strict allowlist (HTTPS, exact host, no credentials, no port),
 * never a suffix or wildcard rule.
 */
export const WAFFO_CHECKOUT_HOSTS = ["pancake.waffo.ai"] as const;

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
