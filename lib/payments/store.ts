import { randomUUID } from "node:crypto";
import { hashAccountToken, encryptOutboxToken, randomOpaqueToken, randomLoginCode } from "../accounts/crypto";
import { getAccountDb, isUniqueViolation, type DbExecutor, type DbPool, withTransaction } from "../accounts/db";
import {
  ACCOUNT_SESSION_TTL_SECONDS,
  ACTIVATION_TOKEN_TTL_SECONDS,
  CHECKOUT_CLAIM_COOKIE,
  PAID_PRODUCTS,
  WAFFO_PACK_CREDITS,
  type PaidProductKey,
  hashSecret,
  normalizeEmail,
} from "./config";
import { PaymentError } from "./errors";

export type OrderStatus = "pending" | "paid" | "checkout_failed";

export interface PendingOrderInput {
  id: string;
  idempotencyKey: string;
  product: PaidProductKey;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  currency: string;
  /** Waffo paymentRequestId (idempotency key), persisted at insert for webhook lookup. */
  waffoPaymentRequestId: string;
  claimSecretHash: string;
  returnPath: string;
}

export interface OrderRecord {
  id: string;
  idempotencyKey: string;
  product: PaidProductKey;
  provider: "replicate" | "fal";
  model: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  currency: string;
  status: OrderStatus;
  waffoPaymentRequestId?: string;
  waffoOrderId?: string;
  email?: string;
  claimSecretHash: string;
  returnPath: string;
  createdAt: string;
  paidAt?: string;
}

/**
 * A Waffo payment notification after signature verification and server-side
 * reconciliation. The acquiringOrderId is the natural idempotency key: one
 * paid Waffo order grants credits exactly once.
 */
export interface VerifiedWaffoPayment {
  eventType: "PAYMENT_NOTIFICATION";
  paymentRequestId: string;
  acquiringOrderId: string;
  orderStatus: "PAY_SUCCESS";
  amountCents: number;
  currency: string;
  email: string;
  merchantId?: string;
  goodsId?: string;
}

export interface FulfillmentResult {
  duplicate: boolean;
  orderId?: string;
  accountId?: string;
}

export interface PaidBalance {
  image: number;
  edit: number;
  video: number;
}

export interface PaidSession {
  accountId: string;
  /** Present for a post-checkout browser claim; absent only after email OTP. */
  scopeOrderId?: string;
  balances: PaidBalance;
}

export interface PaidJobRecord {
  id: string;
  accountId: string;
  product: PaidProductKey;
  provider: "replicate" | "fal";
  model: string;
  inputHash: string;
  idempotencyKey: string;
  scopeOrderId?: string;
  creditSourceOrderId?: string;
  expectedCostMicroUsd: number;
  status: "pending" | "processing" | "succeeded" | "failed";
  creditState: "reserved" | "consumed" | "released";
  providerRequestId?: string;
  providerStatusUrl?: string;
  providerResponseUrl?: string;
  resultUrl?: string;
  resultMediaType?: "image" | "video";
  createdAt: string;
  updatedAt: string;
}

export interface ReservePaidResult {
  state: "new" | "existing";
  jobId: string;
  job: PaidJobRecord;
}

export async function insertPendingOrder(db: DbPool | DbExecutor, input: PendingOrderInput): Promise<OrderRecord> {
  const definition = PAID_PRODUCTS[input.product];
  const result = await db.query<OrderRow>(
    `INSERT INTO ovanto_orders
      (id, idempotency_key, product, provider, model, quantity, unit_amount_cents,
       amount_cents, currency, claim_secret_hash, return_path, waffo_payment_request_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
     RETURNING *`,
    [input.id, input.idempotencyKey, input.product, definition.provider, definition.model, input.quantity, input.unitAmountCents, input.amountCents, input.currency, input.claimSecretHash, input.returnPath, input.waffoPaymentRequestId],
  );
  return orderFromRow(result.rows[0]);
}

export async function findOrderByIdempotency(db: DbPool | DbExecutor, idempotencyKey: string): Promise<OrderRecord | null> {
  const result = await db.query<OrderRow>("SELECT * FROM ovanto_orders WHERE idempotency_key = $1", [idempotencyKey]);
  return result.rows[0] ? orderFromRow(result.rows[0]) : null;
}

export async function findOrderById(db: DbPool | DbExecutor, id: string): Promise<OrderRecord | null> {
  const result = await db.query<OrderRow>("SELECT * FROM ovanto_orders WHERE id = $1", [id]);
  return result.rows[0] ? orderFromRow(result.rows[0]) : null;
}

export async function findOrderByWaffoPaymentRequest(db: DbPool | DbExecutor, paymentRequestId: string): Promise<OrderRecord | null> {
  const result = await db.query<OrderRow>("SELECT * FROM ovanto_orders WHERE waffo_payment_request_id = $1", [paymentRequestId]);
  return result.rows[0] ? orderFromRow(result.rows[0]) : null;
}

export async function attachWaffoOrder(db: DbPool | DbExecutor, orderId: string, acquiringOrderId: string): Promise<OrderRecord> {
  const result = await db.query<OrderRow>(
    `UPDATE ovanto_orders
        SET waffo_order_id = $2
      WHERE id = $1 AND (waffo_order_id IS NULL OR waffo_order_id = $2)
      RETURNING *`,
    [orderId, acquiringOrderId],
  );
  if (!result.rows[0]) throw new PaymentError("ORDER_UNAVAILABLE", 503);
  return orderFromRow(result.rows[0]);
}

export async function markCheckoutFailed(db: DbPool | DbExecutor, orderId: string): Promise<void> {
  await db.query("UPDATE ovanto_orders SET status = 'checkout_failed' WHERE id = $1 AND status = 'pending'", [orderId]);
}

export async function fulfillWaffoEvent(payment: VerifiedWaffoPayment, db: DbPool = getAccountDb()): Promise<FulfillmentResult> {
  return withTransaction(db, async (tx) => {
    const dedupe = await tx.query<{ acquiring_order_id: string }>(
      `INSERT INTO ovanto_waffo_events (acquiring_order_id, event_type, payment_request_id, order_status)
       VALUES ($1,$2,$3,$4) ON CONFLICT (acquiring_order_id) DO NOTHING RETURNING acquiring_order_id`,
      [payment.acquiringOrderId, payment.eventType, payment.paymentRequestId, payment.orderStatus],
    );
    if (dedupe.rows.length === 0) return { duplicate: true };

    const orderResult = await tx.query<OrderRow>("SELECT * FROM ovanto_orders WHERE waffo_payment_request_id = $1 FOR UPDATE", [payment.paymentRequestId]);
    const order = orderResult.rows[0];
    if (!order) throw new PaymentError("ORDER_UNAVAILABLE", 503);
    validateWaffoAgainstOrder(payment, orderFromRow(order));
    if (order.status === "paid") return { duplicate: true, orderId: order.id };
    if (order.status !== "pending") throw new PaymentError("ORDER_UNAVAILABLE", 409);

    const email = normalizeEmail(payment.email);
    const accountResult = await tx.query<AccountRow>(
      `INSERT INTO ovanto_accounts (id, email)
       VALUES ($1,$2) ON CONFLICT (email) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [randomUUID(), email],
    );
    const account = accountResult.rows[0];
    if (!account) throw new PaymentError("ACCOUNT_UNAVAILABLE", 503);

    // Exactly 3 video credits per successful pack. Any browser-supplied
    // quantity/credits/price are ignored: the grant is server-owned.
    await tx.query(
      `INSERT INTO ovanto_credit_balances (account_id, product, order_id, available_credits, reserved_credits)
       VALUES ($1,$2,$3,$4,0)
       ON CONFLICT (account_id, product, order_id) DO UPDATE
          SET available_credits = ovanto_credit_balances.available_credits + EXCLUDED.available_credits,
              updated_at = now()`,
      [account.id, order.product, order.id, WAFFO_PACK_CREDITS],
    );
    await tx.query(
      `INSERT INTO ovanto_credit_ledger
        (id, account_id, order_id, product, entry_type, units, provider, model, expected_cost_micro_usd, metadata)
       VALUES ($1,$2,$3,$4,'grant',$5,$6,$7,$8,$9::jsonb)`,
      [randomUUID(), account.id, order.id, order.product, WAFFO_PACK_CREDITS, order.provider, order.model, PAID_PRODUCTS[order.product].expectedCostMicroUsd, JSON.stringify({ source: "waffo", acquiring_order_id: payment.acquiringOrderId })],
    );

    const rawActivationToken = randomOpaqueToken();
    await tx.query(
      `INSERT INTO ovanto_activation_tokens
        (token_hash, account_id, order_id, expires_at)
       VALUES ($1,$2,$3,now() + interval '7 days')`,
      [hashAccountToken(rawActivationToken), account.id, order.id],
    );
    await tx.query(
      `INSERT INTO ovanto_email_outbox
        (id, account_id, order_id, kind, recipient, encrypted_token)
       VALUES ($1,$2,$3,'activation',$4,$5)`,
      [randomUUID(), account.id, order.id, email, encryptOutboxToken(rawActivationToken)],
    );
    const paidUpdate = await tx.query<{ id: string }>(
      `UPDATE ovanto_orders
          SET status = 'paid', email = $2, paid_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING id`,
      [order.id, email],
    );
    if (paidUpdate.rows.length !== 1) throw new PaymentError("ORDER_UNAVAILABLE", 409);
    return { duplicate: false, orderId: order.id, accountId: account.id };
  });
}

export async function claimPaidOrder(orderId: string, claimSecret: string, db: DbPool = getAccountDb(), existingRawSession?: string): Promise<{ rawSession: string; accountId: string; balances: PaidBalance }> {
  return withTransaction(db, async (tx) => {
    const result = await tx.query<OrderRow>("SELECT * FROM ovanto_orders WHERE id = $1 FOR UPDATE", [orderId]);
    const order = result.rows[0];
    if (!order || order.status !== "paid" || !order.email || !claimSecret || hashSecret(claimSecret) !== order.claim_secret_hash) {
      throw new PaymentError("CHECKOUT_CLAIM_REQUIRED", 403);
    }
    const accountResult = await tx.query<AccountRow>("SELECT * FROM ovanto_accounts WHERE email = $1", [order.email]);
    const account = accountResult.rows[0];
    if (!account) throw new PaymentError("ACCOUNT_UNAVAILABLE", 503);
    if (existingRawSession) {
      const existingSession = await tx.query<ExistingSessionRow>(
        `SELECT s.account_id, s.scope_order_id, a.email
           FROM ovanto_account_sessions s JOIN ovanto_accounts a ON a.id = s.account_id
          WHERE s.token_hash = $1 AND s.expires_at > now() AND s.scope_order_id IS NULL`,
        [hashAccountToken(existingRawSession)],
      );
      const sessionRow = existingSession.rows[0];
      if (sessionRow && sessionRow.account_id === account.id && sessionRow.email === order.email) {
        return { rawSession: existingRawSession, accountId: account.id, balances: await balancesFor(tx, account.id) };
      }
    }
    const rawSession = randomOpaqueToken();
    await tx.query(
      `INSERT INTO ovanto_account_sessions (token_hash, account_id, scope_order_id, expires_at)
       VALUES ($1,$2,$3,now() + interval '30 days')`,
      [hashAccountToken(rawSession), account.id, order.id],
    );
    return { rawSession, accountId: account.id, scopeOrderId: order.id, balances: await balancesFor(tx, account.id, order.id) };
  });
}

export async function getPaidSessionByToken(rawSession: string, db: DbPool = getAccountDb()): Promise<PaidSession | null> {
  if (!rawSession) return null;
  const result = await db.query<SessionRow>(
    `SELECT s.account_id, s.scope_order_id, s.expires_at FROM ovanto_account_sessions s
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashAccountToken(rawSession)],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { accountId: row.account_id, scopeOrderId: row.scope_order_id ?? undefined, balances: await balancesFor(db, row.account_id, row.scope_order_id ?? undefined) };
}

/**
 * Paid generation contract. The debit and job row are one SQL transaction, so
 * a provider request can never be made without an owned credit reservation.
 */
export async function reservePaidCredit(
  accountId: string,
  product: PaidProductKey,
  idempotencyKey: string,
  inputHash: string,
  jobUUID: string,
  scopeOrderIdOrDb?: string | DbPool,
  dbOverride?: DbPool,
): Promise<ReservePaidResult> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId) || !/^[0-9a-f-]{36}$/i.test(jobUUID)) throw new PaymentError("PAID_REQUEST_INVALID", 400);
  const scopeOrderId = typeof scopeOrderIdOrDb === "string" ? scopeOrderIdOrDb : undefined;
  const db = dbOverride ?? (typeof scopeOrderIdOrDb === "string" ? undefined : scopeOrderIdOrDb) ?? getAccountDb();
  return withTransaction(db, async (tx) => {
    const existing = await tx.query<PaidJobRow>(
      scopeOrderId
        ? "SELECT * FROM ovanto_paid_jobs WHERE account_id = $1 AND idempotency_key = $2 AND order_id = $3 FOR UPDATE"
        : "SELECT * FROM ovanto_paid_jobs WHERE account_id = $1 AND idempotency_key = $2 FOR UPDATE",
      scopeOrderId ? [accountId, idempotencyKey, scopeOrderId] : [accountId, idempotencyKey],
    );
    if (existing.rows[0]) {
      const job = paidJobFromRow(existing.rows[0]);
      if (job.inputHash !== inputHash || job.product !== product) throw new PaymentError("PAID_IDEMPOTENCY_CONFLICT", 409);
      return { state: "existing", jobId: job.id, job };
    }
    const definition = PAID_PRODUCTS[product];
    const balance = await tx.query<BalanceRow>(
      scopeOrderId
        ? "SELECT * FROM ovanto_credit_balances WHERE account_id = $1 AND product = $2 AND order_id = $3 FOR UPDATE"
        : "SELECT * FROM ovanto_credit_balances WHERE account_id = $1 AND product = $2 AND available_credits >= 1 ORDER BY created_at FOR UPDATE LIMIT 1",
      scopeOrderId ? [accountId, product, scopeOrderId] : [accountId, product],
    );
    // A concurrent request with the same idempotency key may have committed
    // while this transaction waited for the balance row. Recheck after the
    // lock so it observes and returns that job instead of reporting a credit
    // shortage or attempting a second provider dispatch.
    const committedRetry = await tx.query<PaidJobRow>(
      scopeOrderId
        ? "SELECT * FROM ovanto_paid_jobs WHERE account_id = $1 AND idempotency_key = $2 AND order_id = $3 FOR UPDATE"
        : "SELECT * FROM ovanto_paid_jobs WHERE account_id = $1 AND idempotency_key = $2 FOR UPDATE",
      scopeOrderId ? [accountId, idempotencyKey, scopeOrderId] : [accountId, idempotencyKey],
    );
    if (committedRetry.rows[0]) {
      const job = paidJobFromRow(committedRetry.rows[0]);
      if (job.inputHash !== inputHash || job.product !== product) throw new PaymentError("PAID_IDEMPOTENCY_CONFLICT", 409);
      return { state: "existing", jobId: job.id, job };
    }
    const available = Number(balance.rows[0]?.available_credits ?? 0);
    if (!Number.isSafeInteger(available) || available < 1) throw new PaymentError("PAID_CREDIT_REQUIRED", 402);
    const sourceOrderId = balance.rows[0]?.order_id ?? null;
    if (!sourceOrderId) throw new PaymentError("PAID_CREDIT_REQUIRED", 402);
    await tx.query(
      `UPDATE ovanto_credit_balances
          SET available_credits = available_credits - 1,
              reserved_credits = reserved_credits + 1,
              updated_at = now()
        WHERE account_id = $1 AND product = $2 AND order_id = $3 AND available_credits >= 1`,
      [accountId, product, sourceOrderId],
    );
    const ledgerMetadata = JSON.stringify({ input_hash: inputHash, job_id: jobUUID });
    await tx.query(
      `INSERT INTO ovanto_credit_ledger
        (id, account_id, order_id, product, entry_type, units, provider, model, expected_cost_micro_usd, metadata)
       VALUES ($1,$2,$3,$4,'reserve',-1,$5,$6,$7,$8::jsonb)`,
      [randomUUID(), accountId, sourceOrderId, product, definition.provider, definition.model, definition.expectedCostMicroUsd, ledgerMetadata],
    );
    let result;
    try {
      result = await tx.query<PaidJobRow>(
        `INSERT INTO ovanto_paid_jobs
          (id, account_id, product, order_id, provider, model, expected_cost_micro_usd, input_hash, idempotency_key, status, credit_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','reserved') RETURNING *`,
        [jobUUID, accountId, product, sourceOrderId, definition.provider, definition.model, definition.expectedCostMicroUsd, inputHash, idempotencyKey],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new PaymentError("PAID_IDEMPOTENCY_CONFLICT", 409);
      throw error;
    }
    const job = paidJobFromRow(result.rows[0]);
    return { state: "new", jobId: job.id, job };
  });
}

export async function releasePaidCredit(jobUUID: string, db: DbPool = getAccountDb()): Promise<void> {
  await withTransaction(db, async (tx) => {
    const result = await tx.query<PaidJobRow>("SELECT * FROM ovanto_paid_jobs WHERE id = $1 FOR UPDATE", [jobUUID]);
    const job = result.rows[0];
    if (!job) throw new PaymentError("PAID_JOB_NOT_FOUND", 404);
    if (job.credit_state !== "reserved") return;
    await tx.query(
      `UPDATE ovanto_credit_balances
          SET available_credits = available_credits + 1,
              reserved_credits = GREATEST(0, reserved_credits - 1), updated_at = now()
        WHERE account_id = $1 AND product = $2 AND order_id = $3`,
      [job.account_id, job.product, job.order_id],
    );
    await tx.query(
      `INSERT INTO ovanto_credit_ledger
        (id, account_id, order_id, product, entry_type, units, provider, model, expected_cost_micro_usd, metadata)
       VALUES ($1,$2,$3,$4,'release',1,$5,$6,$7,$8::jsonb)`,
      [randomUUID(), job.account_id, job.order_id, job.product, job.provider, job.model, job.expected_cost_micro_usd, JSON.stringify({ job_id: job.id })],
    );
    await tx.query("UPDATE ovanto_paid_jobs SET credit_state = 'released', status = 'failed', updated_at = now() WHERE id = $1", [job.id]);
  });
}

export async function finalizePaidCredit(jobUUID: string, db: DbPool = getAccountDb()): Promise<void> {
  await withTransaction(db, async (tx) => {
    const result = await tx.query<PaidJobRow>("SELECT * FROM ovanto_paid_jobs WHERE id = $1 FOR UPDATE", [jobUUID]);
    const job = result.rows[0];
    if (!job) throw new PaymentError("PAID_JOB_NOT_FOUND", 404);
    if (job.credit_state === "consumed") return;
    if (job.credit_state !== "reserved") throw new PaymentError("PAID_JOB_STATE_INVALID", 409);
    await tx.query(
      "UPDATE ovanto_credit_balances SET reserved_credits = GREATEST(0, reserved_credits - 1), updated_at = now() WHERE account_id = $1 AND product = $2 AND order_id = $3",
      [job.account_id, job.product, job.order_id],
    );
    await tx.query(
      `INSERT INTO ovanto_credit_ledger
        (id, account_id, order_id, product, entry_type, units, provider, model, expected_cost_micro_usd, metadata)
       VALUES ($1,$2,$3,$4,'consume',0,$5,$6,$7,$8::jsonb)`,
      [randomUUID(), job.account_id, job.order_id, job.product, job.provider, job.model, job.expected_cost_micro_usd, JSON.stringify({ job_id: job.id })],
    );
    await tx.query("UPDATE ovanto_paid_jobs SET credit_state = 'consumed', updated_at = now() WHERE id = $1", [job.id]);
  });
}

export async function getPaidJob(jobId: string, accountId: string, scopeOrderIdOrDb?: string | DbPool, dbOverride?: DbPool): Promise<PaidJobRecord | null> {
  const scopeOrderId = typeof scopeOrderIdOrDb === "string" ? scopeOrderIdOrDb : undefined;
  const db = dbOverride ?? (typeof scopeOrderIdOrDb === "string" ? undefined : scopeOrderIdOrDb) ?? getAccountDb();
  const result = await db.query<PaidJobRow>(
    scopeOrderId
      ? "SELECT * FROM ovanto_paid_jobs WHERE id = $1 AND account_id = $2 AND order_id = $3"
      : "SELECT * FROM ovanto_paid_jobs WHERE id = $1 AND account_id = $2",
    scopeOrderId ? [jobId, accountId, scopeOrderId] : [jobId, accountId],
  );
  return result.rows[0] ? paidJobFromRow(result.rows[0]) : null;
}

export async function updatePaidJobProvider(
  jobId: string,
  accountId: string,
  update: { status?: PaidJobRecord["status"]; providerRequestId?: string; providerStatusUrl?: string; providerResponseUrl?: string; resultUrl?: string; resultMediaType?: "image" | "video" },
  scopeOrderIdOrDb?: string | DbPool,
  dbOverride?: DbPool,
): Promise<PaidJobRecord> {
  const scopeOrderId = typeof scopeOrderIdOrDb === "string" ? scopeOrderIdOrDb : undefined;
  const db = dbOverride ?? (typeof scopeOrderIdOrDb === "string" ? undefined : scopeOrderIdOrDb) ?? getAccountDb();
  const result = await db.query<PaidJobRow>(
    `UPDATE ovanto_paid_jobs SET
      status = COALESCE($3,status), provider_request_id = COALESCE($4,provider_request_id),
      provider_status_url = COALESCE($5,provider_status_url), provider_response_url = COALESCE($6,provider_response_url),
      result_url = COALESCE($7,result_url), result_media_type = COALESCE($8,result_media_type), updated_at = now()
      WHERE id = $1 AND account_id = $2 AND ($9::uuid IS NULL OR order_id = $9) RETURNING *`,
    [jobId, accountId, update.status ?? null, update.providerRequestId ?? null, update.providerStatusUrl ?? null, update.providerResponseUrl ?? null, update.resultUrl ?? null, update.resultMediaType ?? null, scopeOrderId ?? null],
  );
  if (!result.rows[0]) throw new PaymentError("PAID_JOB_NOT_FOUND", 404);
  return paidJobFromRow(result.rows[0]);
}

export async function balancesFor(db: DbExecutor, accountId: string, scopeOrderId?: string): Promise<PaidBalance> {
  const result = await db.query<BalanceRow>(
    scopeOrderId
      ? "SELECT product, available_credits FROM ovanto_credit_balances WHERE account_id = $1 AND order_id = $2"
      : "SELECT product, SUM(available_credits)::int AS available_credits FROM ovanto_credit_balances WHERE account_id = $1 GROUP BY product",
    scopeOrderId ? [accountId, scopeOrderId] : [accountId],
  );
  const balances: PaidBalance = { image: 0, edit: 0, video: 0 };
  for (const row of result.rows) if (row.product === "image" || row.product === "edit" || row.product === "video") balances[row.product] = Number(row.available_credits);
  return balances;
}

export function parseCheckoutClaimCookie(value: string | undefined): { orderId: string; secret: string } | null {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator <= 0) return null;
  const orderId = value.slice(0, separator);
  const secret = value.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || secret.length < 32) return null;
  return { orderId, secret };
}

export const CHECKOUT_CLAIM_COOKIE_NAME = CHECKOUT_CLAIM_COOKIE;
export const ACCOUNT_SESSION_COOKIE_NAME = "ovanto_account_session";
export const ACCOUNT_SESSION_MAX_AGE = ACCOUNT_SESSION_TTL_SECONDS;

function validateWaffoAgainstOrder(payment: VerifiedWaffoPayment, order: OrderRecord): void {
  if (payment.paymentRequestId !== order.waffoPaymentRequestId || payment.amountCents !== order.amountCents || payment.currency.toLowerCase() !== order.currency.toLowerCase()) throw new PaymentError("CHECKOUT_VALIDATION_FAILED", 400);
  if (order.product !== "video") throw new PaymentError("CHECKOUT_VALIDATION_FAILED", 400);
  if (payment.merchantId && process.env.WAFFO_MERCHANT_ID && payment.merchantId !== process.env.WAFFO_MERCHANT_ID) throw new PaymentError("CHECKOUT_VALIDATION_FAILED", 400);
  if (!payment.email || payment.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payment.email)) throw new PaymentError("CHECKOUT_EMAIL_MISSING", 400);
}

interface OrderRow extends Record<string, unknown> {
  id: string; idempotency_key: string; product: PaidProductKey; provider: "replicate" | "fal"; model: string; quantity: number; unit_amount_cents: number; amount_cents: number; currency: string; status: OrderStatus; waffo_payment_request_id: string | null; waffo_order_id: string | null; email: string | null; claim_secret_hash: string; return_path: string; created_at: string; paid_at: string | null;
}
interface AccountRow extends Record<string, unknown> { id: string; email: string }
interface ExistingSessionRow extends Record<string, unknown> { account_id: string; scope_order_id: string | null; email: string }
interface SessionRow extends Record<string, unknown> { account_id: string; scope_order_id: string | null; expires_at: string }
interface BalanceRow extends Record<string, unknown> { product: string; order_id: string; available_credits: number }
interface PaidJobRow extends Record<string, unknown> { id: string; account_id: string; product: PaidProductKey; order_id: string; provider: "replicate" | "fal"; model: string; expected_cost_micro_usd: number; input_hash: string; idempotency_key: string; status: PaidJobRecord["status"]; credit_state: PaidJobRecord["creditState"]; provider_request_id: string | null; provider_status_url: string | null; provider_response_url: string | null; result_url: string | null; result_media_type: "image" | "video" | null; created_at: string; updated_at: string }

function orderFromRow(row: OrderRow | undefined): OrderRecord {
  if (!row) throw new PaymentError("ORDER_UNAVAILABLE", 503);
  return {
    id: row.id, idempotencyKey: row.idempotency_key, product: row.product, provider: row.provider, model: row.model,
    quantity: Number(row.quantity), unitAmountCents: Number(row.unit_amount_cents), amountCents: Number(row.amount_cents), currency: row.currency,
    status: row.status, waffoPaymentRequestId: row.waffo_payment_request_id ?? undefined, waffoOrderId: row.waffo_order_id ?? undefined, email: row.email ?? undefined,
    claimSecretHash: row.claim_secret_hash, returnPath: row.return_path, createdAt: new Date(row.created_at).toISOString(), paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : undefined,
  };
}

function paidJobFromRow(row: PaidJobRow | undefined): PaidJobRecord {
  if (!row) throw new PaymentError("PAID_JOB_UNAVAILABLE", 503);
  return {
    id: row.id, accountId: row.account_id, product: row.product, provider: row.provider, model: row.model, inputHash: row.input_hash, idempotencyKey: row.idempotency_key,
    status: row.status, creditState: row.credit_state, scopeOrderId: row.order_id, creditSourceOrderId: row.order_id, expectedCostMicroUsd: Number(row.expected_cost_micro_usd), providerRequestId: row.provider_request_id ?? undefined, providerStatusUrl: row.provider_status_url ?? undefined,
    providerResponseUrl: row.provider_response_url ?? undefined, resultUrl: row.result_url ?? undefined, resultMediaType: row.result_media_type ?? undefined,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
  };
}

