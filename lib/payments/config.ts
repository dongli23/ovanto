import { createHash, randomBytes } from "node:crypto";
import { MODELS } from "../../src/lib/models";

export type PaidProductKey = "image" | "edit" | "video";
export type PaidProvider = "replicate" | "fal";

export interface PaidProductDefinition {
  readonly key: PaidProductKey;
  readonly provider: PaidProvider;
  readonly model: string;
  readonly expectedCostMicroUsd: number;
  readonly costMicroUsd: number;
}

/**
 * Provider and model names are deliberately server-owned. A browser may select
 * a product key, but it can never select a provider/model, a quantity, a
 * price, or the number of credits granted.
 */
export const PAID_PRODUCTS: Record<PaidProductKey, PaidProductDefinition> = {
  image: {
    key: "image",
    provider: MODELS["image.paid"].provider,
    model: MODELS["image.paid"].slug,
    expectedCostMicroUsd: Math.round(MODELS["image.paid"].cost * 1_000_000),
    costMicroUsd: Math.round(MODELS["image.paid"].cost * 1_000_000),
  },
  edit: {
    key: "edit",
    provider: MODELS["edit.paid"].provider,
    model: MODELS["edit.paid"].slug,
    expectedCostMicroUsd: Math.round(MODELS["edit.paid"].cost * 1_000_000),
    costMicroUsd: Math.round(MODELS["edit.paid"].cost * 1_000_000),
  },
  video: {
    key: "video",
    provider: MODELS["video.paid"].provider,
    model: MODELS["video.paid"].slug,
    expectedCostMicroUsd: Math.round(MODELS["video.paid"].cost * MODELS["video.paid"].fixedSeconds * 1_000_000),
    costMicroUsd: Math.round(MODELS["video.paid"].cost * MODELS["video.paid"].fixedSeconds * 1_000_000),
  },
};

/**
 * Waffo V1 sells exactly one SKU: the Ovanto Pro Video Pack.
 *
 *   1 successful pack => exactly 3 video credits
 *
 * Price, credits, currency, provider, model and duration are all server-owned
 * and locked. The browser may only choose the product key and return path.
 */
export const WAFFO_PACK_KEY: PaidProductKey = "video";
export const WAFFO_PACK_NAME = "Ovanto Pro Video Pack";
export const WAFFO_PACK_PRICE_CENTS = 499; // US$4.99
export const WAFFO_PACK_CREDITS = 3; // exactly 3 video credits
export const WAFFO_PACK_CURRENCY = "USD";

/**
 * Environment names the Waffo Pancake SDK client and webhook verification
 * both require. The current Pancake credential model is merchant id +
 * merchant private key only; WAFFO_API_KEY / WAFFO_PUBLIC_KEY are not part
 * of it and must never be hard requirements.
 */
export const WAFFO_ENV_KEYS = ["WAFFO_MERCHANT_ID", "WAFFO_PRIVATE_KEY", "WAFFO_STORE_ID", "WAFFO_PRODUCT_ID"] as const;

export const ORDER_CURRENCY = "usd" as const;
export const CHECKOUT_CLAIM_COOKIE = "ovanto_checkout_claim";
export const ACCOUNT_SESSION_COOKIE = "ovanto_account_session";
export const ACTIVATION_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const LOGIN_CODE_TTL_SECONDS = 10 * 60;
export const ACCOUNT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MAX_WEBHOOK_BODY_BYTES = 128 * 1024;
export const MAX_CHECKOUT_BODY_BYTES = 16 * 1024;

/**
 * All return paths are existing product pages.  This is an allowlist rather
 * than a client supplied URL, preventing Checkout from becoming an open
 * redirector or introducing a new success page.
 */
export const CHECKOUT_RETURN_PATHS = [
  "/",
  "/it/",
  "/fr/",
  "/fr/photo-ia-gratuit",
  "/fr/modifier-photo-ia",
  "/nl/",
  "/nl/afbeeldingen-maken-met-ai",
] as const;

export type CheckoutReturnPath = (typeof CHECKOUT_RETURN_PATHS)[number];

export function isPaidProductKey(value: unknown): value is PaidProductKey {
  return value === "image" || value === "edit" || value === "video";
}

export function productFor(value: unknown): PaidProductDefinition {
  if (!isPaidProductKey(value)) throw new PaymentConfigError("PRODUCT_INVALID", 400);
  return PAID_PRODUCTS[value];
}

export function assertCheckoutReturnPath(value: unknown): CheckoutReturnPath {
  if (typeof value !== "string" || !(CHECKOUT_RETURN_PATHS as readonly string[]).includes(value)) {
    throw new PaymentConfigError("RETURN_PATH_INVALID", 400);
  }
  return value as CheckoutReturnPath;
}

/**
 * The Waffo Pancake SDK operates in `test` or `prod`. The owner's production
 * value is `WAFFO_ENVIRONMENT=prod`; normalize the accepted spellings here
 * without guessing beyond the SDK contract.
 */
export function isWaffoEnvironmentConfigured(): boolean {
  const value = process.env.WAFFO_ENVIRONMENT;
  return value === "prod" || value === "production" || value === "test" || value === "sandbox";
}

export interface PaidCatalogEntry {
  key: PaidProductKey;
  model: string;
  packPriceCents: number;
  credits: number;
}

/** The Waffo catalog exposes exactly one purchasable product. */
export function waffoCatalog(): PaidCatalogEntry[] {
  const product = PAID_PRODUCTS[WAFFO_PACK_KEY];
  return [{ key: WAFFO_PACK_KEY, model: product.model, packPriceCents: WAFFO_PACK_PRICE_CENTS, credits: WAFFO_PACK_CREDITS }];
}

export function appBaseUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://ovanto.ai";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PaymentConfigError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new PaymentConfigError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new PaymentConfigError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
  return url;
}

/**
 * Waffo success redirect carries no session id and never grants credits. The
 * browser later calls /api/account/claim against its checkout claim cookie,
 * and the webhook is the sole authority that marks the order paid.
 */
export function checkoutReturnUrls(pathname: CheckoutReturnPath): { successUrl: string; cancelUrl: string } {
  const base = appBaseUrl();
  const path = pathname === "/" ? "/" : pathname;
  return {
    successUrl: new URL(`${path}${path.includes("?") ? "&" : "?"}payment=success`, base).toString(),
    cancelUrl: new URL(path, base).toString(),
  };
}

export function newClaimSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export class PaymentConfigError extends Error {
  readonly code: string;
  readonly status: 400 | 503;

  constructor(code: string, status: 400 | 503) {
    super(code);
    this.name = "PaymentConfigError";
    this.code = code;
    this.status = status;
  }
}
