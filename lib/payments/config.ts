import { createHash, randomBytes } from "node:crypto";
import { MODELS } from "../../src/lib/models";

export type PaidProductKey = "image" | "edit" | "video";
export type PaidProvider = "replicate" | "fal";

export interface PaidProductDefinition {
  readonly key: PaidProductKey;
  readonly provider: PaidProvider;
  readonly model: string;
  readonly label: string;
  readonly priceEnv: string;
  readonly expectedCostMicroUsd: number;
  readonly costMicroUsd: number;
}

/**
 * The model names are deliberately server-owned.  A browser may select a
 * product key, but it can never select a provider/model or a quantity of
 * provider-side work.
 */
export const PAID_PRODUCTS: Record<PaidProductKey, PaidProductDefinition> = {
  image: {
    key: "image",
    provider: MODELS["image.paid"].provider,
    model: MODELS["image.paid"].slug,
    label: "AI image generation",
    priceEnv: "PAID_IMAGE_PRICE_CENTS",
    expectedCostMicroUsd: Math.round(MODELS["image.paid"].cost * 1_000_000),
    costMicroUsd: Math.round(MODELS["image.paid"].cost * 1_000_000),
  },
  edit: {
    key: "edit",
    provider: MODELS["edit.paid"].provider,
    model: MODELS["edit.paid"].slug,
    label: "AI photo editing",
    priceEnv: "PAID_EDIT_PRICE_CENTS",
    expectedCostMicroUsd: Math.round(MODELS["edit.paid"].cost * 1_000_000),
    costMicroUsd: Math.round(MODELS["edit.paid"].cost * 1_000_000),
  },
  video: {
    key: "video",
    provider: MODELS["video.paid"].provider,
    model: MODELS["video.paid"].slug,
    label: "AI video generation (5 seconds)",
    priceEnv: "PAID_VIDEO_PRICE_CENTS",
    expectedCostMicroUsd: Math.round(MODELS["video.paid"].cost * MODELS["video.paid"].fixedSeconds * 1_000_000),
    costMicroUsd: Math.round(MODELS["video.paid"].cost * MODELS["video.paid"].fixedSeconds * 1_000_000),
  },
};

export const MAX_PAID_QUANTITY = 20;
export const MIN_PAID_QUANTITY = 1;
export const MIN_STRIPE_AMOUNT_CENTS = 50;
export const MAX_STRIPE_AMOUNT_CENTS = 99_999_999;
export const MAX_STRIPE_UNIT_AMOUNT_CENTS = Math.floor(MAX_STRIPE_AMOUNT_CENTS / MAX_PAID_QUANTITY);
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

export function parseQuantity(value: unknown): number {
  const quantity = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(quantity) || quantity < MIN_PAID_QUANTITY || quantity > MAX_PAID_QUANTITY) {
    throw new PaymentConfigError("QUANTITY_INVALID", 400);
  }
  return quantity;
}

export function retailPriceCents(product: PaidProductKey): number {
  const definition = PAID_PRODUCTS[product];
  const raw = process.env[definition.priceEnv];
  if (!raw || !/^\d+$/.test(raw)) throw new PaymentConfigError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  const cents = Number(raw);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_STRIPE_UNIT_AMOUNT_CENTS) throw new PaymentConfigError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  if (product === "video" && (cents < 99 || cents > 149)) {
    throw new PaymentConfigError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
  return cents;
}

export function orderAmountCents(product: PaidProductKey, quantity: number): number {
  const unit = retailPriceCents(product);
  const amount = unit * quantity;
  if (!Number.isSafeInteger(amount) || amount < MIN_STRIPE_AMOUNT_CENTS || amount > MAX_STRIPE_AMOUNT_CENTS) throw new PaymentConfigError("PAYMENT_AMOUNT_INVALID", 400);
  return amount;
}

export function minimumQuantity(product: PaidProductKey): number {
  const unit = retailPriceCents(product);
  return Math.max(MIN_PAID_QUANTITY, Math.ceil(MIN_STRIPE_AMOUNT_CENTS / unit));
}

export interface PaidCatalogEntry {
  key: PaidProductKey;
  provider: PaidProvider;
  model: string;
  unitAmountCents: number | null;
  minQuantity: number | null;
  maxQuantity: number;
  enabled: boolean;
}

export function paidCatalog(): PaidCatalogEntry[] {
  return (Object.keys(PAID_PRODUCTS) as PaidProductKey[]).map((key) => {
    const product = PAID_PRODUCTS[key];
    try {
      const unitAmountCents = retailPriceCents(key);
      const minQuantity = minimumQuantity(key);
      return { key, provider: product.provider, model: product.model, unitAmountCents, minQuantity, maxQuantity: MAX_PAID_QUANTITY, enabled: minQuantity <= MAX_PAID_QUANTITY };
    } catch {
      return { key, provider: product.provider, model: product.model, unitAmountCents: null, minQuantity: null, maxQuantity: MAX_PAID_QUANTITY, enabled: false };
    }
  });
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

export function checkoutUrls(pathname: CheckoutReturnPath): { successUrl: string; cancelUrl: string } {
  const base = appBaseUrl();
  const path = pathname === "/" ? "/" : pathname;
  return {
    successUrl: new URL(`${path}${path.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`, base).toString(),
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

