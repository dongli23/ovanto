import Stripe from "stripe";
import { PaymentError } from "./errors";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  if (!client) {
    // Let the installed Stripe SDK select its typed default API version. This
    // avoids pinning a version that the deployed SDK does not support.
    client = new Stripe(secret, { typescript: true });
  }
  return client;
}

export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new PaymentError("WEBHOOK_SIGNATURE_INVALID", 400);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  const stripe = getStripe();
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new PaymentError("WEBHOOK_SIGNATURE_INVALID", 400);
  }
}

export function resetStripeForTests(): void {
  client = undefined;
}

