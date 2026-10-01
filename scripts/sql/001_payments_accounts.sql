-- Ovanto paid checkout/account schema. Apply through the deployment migration
-- runner after a reviewed DATABASE_URL is configured; this file is source only.

CREATE TABLE IF NOT EXISTS ovanto_orders (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  product text NOT NULL CHECK (product IN ('image', 'edit', 'video')),
  provider text NOT NULL CHECK (provider IN ('replicate', 'fal')),
  model text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  unit_amount_cents integer NOT NULL CHECK (unit_amount_cents > 0),
  amount_cents integer NOT NULL CHECK (amount_cents = unit_amount_cents * quantity),
  currency char(3) NOT NULL CHECK (currency = 'usd'),
  claim_secret_hash char(64) NOT NULL,
  return_path text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'checkout_failed')),
  stripe_checkout_session_id text UNIQUE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS ovanto_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  session_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ovanto_accounts (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ovanto_credit_balances (
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  product text NOT NULL CHECK (product IN ('image', 'edit', 'video')),
  order_id uuid NOT NULL REFERENCES ovanto_orders(id) ON DELETE RESTRICT,
  available_credits integer NOT NULL CHECK (available_credits >= 0),
  reserved_credits integer NOT NULL CHECK (reserved_credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, product, order_id)
);

CREATE TABLE IF NOT EXISTS ovanto_credit_ledger (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES ovanto_orders(id) ON DELETE RESTRICT,
  product text NOT NULL CHECK (product IN ('image', 'edit', 'video')),
  entry_type text NOT NULL CHECK (entry_type IN ('grant', 'reserve', 'consume', 'release')),
  units integer NOT NULL,
  provider text NOT NULL CHECK (provider IN ('replicate', 'fal')),
  model text NOT NULL,
  expected_cost_micro_usd bigint NOT NULL CHECK (expected_cost_micro_usd > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ovanto_credit_grant_once
  ON ovanto_credit_ledger(order_id, product, entry_type)
  WHERE entry_type = 'grant';

CREATE TABLE IF NOT EXISTS ovanto_activation_tokens (
  token_hash char(64) PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES ovanto_orders(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS ovanto_email_outbox (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES ovanto_orders(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('activation', 'login_code')),
  recipient text NOT NULL,
  encrypted_token text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ovanto_activation_outbox_once
  ON ovanto_email_outbox(order_id, kind)
  WHERE order_id IS NOT NULL AND kind = 'activation';

CREATE TABLE IF NOT EXISTS ovanto_account_sessions (
  token_hash char(64) PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  scope_order_id uuid REFERENCES ovanto_orders(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ovanto_login_rate (
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  ip_hash char(64) NOT NULL,
  window_started_at timestamptz NOT NULL,
  send_count integer NOT NULL CHECK (send_count >= 0),
  last_sent_at timestamptz NOT NULL,
  PRIMARY KEY (account_id, ip_hash)
);

CREATE TABLE IF NOT EXISTS ovanto_login_challenges (
  id text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ovanto_paid_jobs (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES ovanto_accounts(id) ON DELETE CASCADE,
  product text NOT NULL CHECK (product IN ('image', 'edit', 'video')),
  order_id uuid NOT NULL REFERENCES ovanto_orders(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('replicate', 'fal')),
  model text NOT NULL,
  expected_cost_micro_usd bigint NOT NULL CHECK (expected_cost_micro_usd > 0),
  input_hash char(64) NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  credit_state text NOT NULL CHECK (credit_state IN ('reserved', 'consumed', 'released')),
  provider_request_id text,
  provider_status_url text,
  provider_response_url text,
  result_url text,
  result_media_type text CHECK (result_media_type IN ('image', 'video')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ovanto_paid_jobs_account_scope
  ON ovanto_paid_jobs(account_id, order_id, created_at DESC);

