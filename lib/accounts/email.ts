import { PaymentError } from "../payments/errors";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

export function assertEmailConfiguration(): { apiKey: string; from: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new PaymentError("EMAIL_CONFIGURATION_UNAVAILABLE", 503);
  return { apiKey, from };
}

/** Server-only Resend adapter. No browser code imports this module. */
export async function sendEmail(message: EmailMessage, signal?: AbortSignal): Promise<void> {
  const { apiKey, from } = assertEmailConfiguration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new PaymentError("EMAIL_DELIVERY_FAILED", 503);
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError("EMAIL_DELIVERY_FAILED", 503);
  } finally {
    clearTimeout(timeout);
  }
}

export function activationEmail(email: string, token: string, idempotencyKey?: string): EmailMessage {
  const url = new URL("/it/", process.env.NEXT_PUBLIC_APP_URL || "https://ovanto.ai");
  // Keep the one-time token in the fragment so mail scanners and server logs
  // never receive it as an HTTP query parameter. The browser posts it to the
  // explicit activation endpoint after the user clicks the UI action.
  url.hash = `activate=${encodeURIComponent(token)}`;
  return {
    to: email,
    subject: "Your Ovanto credits are ready",
    text: `Activate your Ovanto account: ${url.toString()}`,
    html: `<p>Your Ovanto credits are ready.</p><p><a href="${escapeHtml(url.toString())}">Activate your account</a></p>`,
    idempotencyKey,
  };
}

export function loginCodeEmail(email: string, code: string, idempotencyKey?: string): EmailMessage {
  return {
    to: email,
    subject: "Your Ovanto login code",
    text: `Your Ovanto login code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Ovanto login code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires in 10 minutes.</p>`,
    idempotencyKey,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

