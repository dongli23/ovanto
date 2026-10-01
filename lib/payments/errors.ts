import { NextResponse } from "next/server";
import { PaymentConfigError } from "./config";

export type PaymentErrorStatus = 400 | 401 | 402 | 403 | 404 | 409 | 413 | 429 | 500 | 502 | 503;

export class PaymentError extends Error {
  readonly code: string;
  readonly status: PaymentErrorStatus;
  readonly publicMessage?: string;

  constructor(code: string, status: PaymentErrorStatus, publicMessage?: string) {
    super(publicMessage ?? code);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export function paymentResponse(error: unknown): NextResponse {
  if (error instanceof PaymentConfigError) {
    return NextResponse.json(
      { error: { code: error.code, message: publicMessage(error.code) } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof PaymentError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.publicMessage ?? publicMessage(error.code) } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { error: { code: "PAYMENT_UNAVAILABLE", message: "Payment is temporarily unavailable." } },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function publicMessage(code: string): string {
  switch (code) {
    case "QUANTITY_INVALID":
    case "PRODUCT_INVALID":
    case "RETURN_PATH_INVALID":
      return "The payment request is invalid.";
    case "CHECKOUT_CLAIM_REQUIRED":
      return "This checkout can only be claimed from the browser that started it.";
    case "LOGIN_CODE_SENT":
      return "If a paid account exists for this email, a login code has been sent.";
    default:
      return "Payment is temporarily unavailable.";
  }
}

export function noStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function assertPaymentConfiguration(): void {
  const required = ["DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "ACCOUNT_TOKEN_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0 || process.env.PAID_CHECKOUT_ENABLED !== "true" || (process.env.ACCOUNT_TOKEN_SECRET?.length ?? 0) < 32) {
    throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
}

export function assertWebhookConfiguration(): void {
  const required = ["DATABASE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "ACCOUNT_TOKEN_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0 || (process.env.ACCOUNT_TOKEN_SECRET?.length ?? 0) < 32) {
    throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
}

export function assertAccountConfiguration(): void {
  const required = ["DATABASE_URL", "ACCOUNT_TOKEN_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "IP_HASH_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0 || (process.env.ACCOUNT_TOKEN_SECRET?.length ?? 0) < 32) {
    throw new PaymentError("ACCOUNT_CONFIGURATION_UNAVAILABLE", 503);
  }
}

export function assertSessionConfiguration(): void {
  if (!process.env.DATABASE_URL || (process.env.ACCOUNT_TOKEN_SECRET?.length ?? 0) < 32) {
    throw new PaymentError("ACCOUNT_CONFIGURATION_UNAVAILABLE", 503);
  }
}

