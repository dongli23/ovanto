-- Ovanto Waffo payment cutover. Apply after 001_payments_accounts.sql.
--
-- Replaces the Stripe-named checkout linkage with Waffo identifiers:
--   - waffo_payment_request_id: merchant idempotency key (max 32 chars, unique)
--   - waffo_order_id:            Waffo acquiringOrderId (server order reference)
--   - ovanto_waffo_events:       webhook idempotency keyed by acquiringOrderId
--
-- The credit grant stays protected by the existing ovanto_credit_grant_once
-- unique index, and the webhook handler grants exactly 3 credits regardless
-- of any browser-supplied quantity/credits/price.

ALTER TABLE ovanto_orders
  ADD COLUMN IF NOT EXISTS waffo_payment_request_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS waffo_order_id text;

-- Legacy Stripe linkage is no longer used by the production runtime.
ALTER TABLE ovanto_orders DROP COLUMN IF EXISTS stripe_checkout_session_id;
DROP TABLE IF EXISTS ovanto_stripe_events;

CREATE TABLE IF NOT EXISTS ovanto_waffo_events (
  acquiring_order_id text PRIMARY KEY,
  event_type text NOT NULL,
  payment_request_id text,
  order_status text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
