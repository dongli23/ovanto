import type Stripe from "stripe";
import { ORDER_CURRENCY, type PaidProductDefinition } from "./config";

export interface CheckoutParamsInput {
  orderId: string;
  product: PaidProductDefinition;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Build the server-owned Stripe request. Stripe treats price_data.unit_amount
 * as a unit price and multiplies it by line_items.quantity, so amount_cents
 * is carried in metadata for webhook reconciliation rather than used as the
 * line item unit amount.
 */
export function buildCheckoutParams(input: CheckoutParamsInput): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    payment_method_types: ["card"],
    customer_creation: "if_required",
    line_items: [
      {
        price_data: {
          currency: ORDER_CURRENCY,
          unit_amount: input.unitAmountCents,
          product_data: {
            name: input.product.label,
            metadata: { product: input.product.key, model: input.product.model },
          },
        },
        quantity: input.quantity,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.orderId,
    metadata: {
      order_id: input.orderId,
      product: input.product.key,
      model: input.product.model,
      quantity: String(input.quantity),
      amount_cents: String(input.amountCents),
    },
  };
}
