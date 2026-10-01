import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  setAccountDbForTests,
  type DbPool,
  type DbResult,
  type DbTransaction,
} from "../lib/accounts/db";
import { consumeActivationToken, verifyLoginCode } from "../lib/accounts/store";
import { hashAccountToken } from "../lib/accounts/crypto";
import {
  attachCheckoutSession,
  balancesFor,
  claimPaidOrder,
  finalizePaidCredit,
  fulfillCheckoutEvent,
  getPaidJob,
  getPaidSessionByToken,
  insertPendingOrder,
  markCheckoutFailed,
  releasePaidCredit,
  reservePaidCredit,
  type PendingOrderInput,
  type VerifiedCheckout,
} from "../lib/payments/store";
import { PAID_PRODUCTS, hashSecret } from "../lib/payments/config";
import { PaymentError } from "../lib/payments/errors";

/**
 * PGlite is an embedded PostgreSQL engine used here to exercise the actual
 * migration and SQL transaction paths. It serializes one connection because
 * PGlite's embedded engine is single-connection; this validates transaction
 * ordering and idempotency, while production concurrency is provided by pg.
 */
class PGlitePool implements DbPool {
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(private readonly database: PGlite) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<DbResult<T>> {
    const result = await this.database.query<T>(text, values as unknown[]);
    const commandResult = result as typeof result & { affectedRows?: number };
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? commandResult.affectedRows ?? result.rows.length,
    };
  }

  async connect(): Promise<DbTransaction> {
    let releaseLock!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolveLock) => { releaseLock = resolveLock; });
    await previous;
    return {
      query: this.query.bind(this),
      release: releaseLock,
    };
  }
}

const migrationPath = resolve(process.cwd(), "scripts/sql/001_payments_accounts.sql");
let database: PGlite | undefined;
let pool: PGlitePool | undefined;

test.beforeEach(async () => {
  process.env.ACCOUNT_TOKEN_SECRET = "sql-test-account-token-secret-32-bytes!!";
  database = new PGlite();
  await database.exec(await readFile(migrationPath, "utf8"));
  pool = new PGlitePool(database);
  setAccountDbForTests(pool);
});

test.afterEach(async () => {
  setAccountDbForTests(undefined);
  await database?.close();
  database = undefined;
  pool = undefined;
});

function db(): PGlitePool {
  if (!pool) throw new Error("SQL test database is not initialized");
  return pool;
}

function orderInput(overrides: Partial<PendingOrderInput> = {}): PendingOrderInput {
  const quantity = overrides.quantity ?? 3;
  const unitAmountCents = overrides.unitAmountCents ?? 100;
  return {
    id: randomUUID(),
    idempotencyKey: `sql-order-${randomUUID()}`,
    product: "image",
    quantity,
    unitAmountCents,
    amountCents: unitAmountCents * quantity,
    currency: "usd",
    claimSecretHash: hashSecret("s".repeat(48)),
    returnPath: "/it/",
    ...overrides,
  };
}

async function createOrder(
  overrides: Partial<PendingOrderInput> = {},
  email = "buyer@example.com",
): Promise<{ order: Awaited<ReturnType<typeof insertPendingOrder>>; secret: string; sessionId: string; fulfillment: Awaited<ReturnType<typeof fulfillCheckoutEvent>> }> {
  const secret = "s".repeat(48);
  const input = { ...orderInput(overrides), claimSecretHash: hashSecret(secret) };
  const order = await insertPendingOrder(db(), input);
  const sessionId = `cs_sql_${randomUUID()}`;
  await attachCheckoutSession(db(), order.id, sessionId);
  const fulfillment = await fulfillCheckoutEvent(checkoutFor(order, sessionId, email), db());
  return { order, secret, sessionId, fulfillment };
}

function checkoutFor(
  order: Awaited<ReturnType<typeof insertPendingOrder>>,
  sessionId: string,
  email = "buyer@example.com",
  overrides: Partial<Pick<VerifiedCheckout, "eventId" | "eventType" | "amountTotal" | "currency">> = {},
): VerifiedCheckout {
  return {
    eventId: overrides.eventId ?? `evt_sql_${randomUUID()}`,
    eventType: overrides.eventType ?? "checkout.session.completed",
    sessionId,
    paymentStatus: "paid",
    amountTotal: overrides.amountTotal ?? order.amountCents,
    currency: overrides.currency ?? "usd",
    clientReferenceId: order.id,
    metadata: {
      orderId: order.id,
      product: order.product,
      model: PAID_PRODUCTS[order.product].model,
      quantity: String(order.quantity),
      amountCents: String(order.amountCents),
    },
    email,
  };
}

test("webhook fulfillment is idempotent for duplicate events and different events on one session", async () => {
  const input = orderInput({ quantity: 3 });
  const secret = "s".repeat(48);
  const order = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret(secret) });
  const sessionId = `cs_sql_${randomUUID()}`;
  await attachCheckoutSession(db(), order.id, sessionId);

  const first = await fulfillCheckoutEvent(checkoutFor(order, sessionId, "same@example.com", { eventId: "evt_same" }), db());
  const duplicate = await fulfillCheckoutEvent(checkoutFor(order, sessionId, "same@example.com", { eventId: "evt_same" }), db());
  const differentEvent = await fulfillCheckoutEvent(checkoutFor(order, sessionId, "same@example.com", { eventId: "evt_different" }), db());

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(differentEvent.duplicate, true);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_stripe_events")).rows[0].count, 2);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE entry_type = 'grant'")).rows[0].count, 1);
  assert.equal((await db().query("SELECT available_credits FROM ovanto_credit_balances WHERE order_id = $1", [order.id])).rows[0].available_credits, 3);
});

test("mismatched paid amount rolls back event receipt and all fulfillment state", async () => {
  const { order, sessionId } = await (async () => {
    const input = orderInput({ quantity: 2 });
    const secret = "s".repeat(48);
    const created = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret(secret) });
    const session = `cs_sql_${randomUUID()}`;
    await attachCheckoutSession(db(), created.id, session);
    return { order: created, sessionId: session };
  })();

  await assert.rejects(
    fulfillCheckoutEvent(checkoutFor(order, sessionId, "rollback@example.com", { amountTotal: order.amountCents + 1 }), db()),
    (error: unknown) => error instanceof PaymentError && error.code === "CHECKOUT_VALIDATION_FAILED",
  );
  assert.equal((await db().query("SELECT status FROM ovanto_orders WHERE id = $1", [order.id])).rows[0].status, "pending");
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_stripe_events")).rows[0].count, 0);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_accounts")).rows[0].count, 0);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger")).rows[0].count, 0);
});

test("a checkout failed before Stripe session creation cannot receive a later grant", async () => {
  const input = orderInput({ quantity: 2 });
  const secret = "s".repeat(48);
  const order = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret(secret) });
  const sessionId = `cs_failed_${randomUUID()}`;
  await attachCheckoutSession(db(), order.id, sessionId);
  await markCheckoutFailed(db(), order.id);

  await assert.rejects(
    fulfillCheckoutEvent(checkoutFor(order, sessionId, "failed@example.com"), db()),
    (error: unknown) => error instanceof PaymentError && error.code === "ORDER_UNAVAILABLE",
  );
  assert.equal((await db().query("SELECT status FROM ovanto_orders WHERE id = $1", [order.id])).rows[0].status, "checkout_failed");
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_accounts")).rows[0].count, 0);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger")).rows[0].count, 0);
});

test("checkout sessions for the same email stay scoped to their own order credits", async () => {
  const first = await createOrder({ quantity: 2 }, "same@example.com");
  const firstSession = await claimPaidOrder(first.order.id, first.secret, db());
  const firstPaidSession = await getPaidSessionByToken(firstSession.rawSession, db());
  assert.equal(firstPaidSession?.scopeOrderId, first.order.id);
  assert.deepEqual(firstPaidSession?.balances, { image: 2, edit: 0, video: 0 });

  const second = await createOrder({ quantity: 3 }, "same@example.com");
  const secondSession = await claimPaidOrder(second.order.id, second.secret, db(), firstSession.rawSession);
  const secondPaidSession = await getPaidSessionByToken(secondSession.rawSession, db());
  assert.equal(secondPaidSession?.scopeOrderId, second.order.id);
  assert.deepEqual(secondPaidSession?.balances, { image: 3, edit: 0, video: 0 });
  assert.deepEqual(await balancesFor(db(), second.fulfillment.accountId!, second.order.id), { image: 3, edit: 0, video: 0 });
  assert.deepEqual(await balancesFor(db(), second.fulfillment.accountId!, first.order.id), { image: 2, edit: 0, video: 0 });

  const reserved = await reservePaidCredit(
    second.fulfillment.accountId!,
    "image",
    "scope-order-2-job",
    "b".repeat(64),
    randomUUID(),
    second.order.id,
    db(),
  );
  assert.equal(reserved.job.creditSourceOrderId, second.order.id);
  assert.equal(await getPaidJob(reserved.jobId, second.fulfillment.accountId!, first.order.id, db()), null);
});

test("paid credit reservation is idempotent and release/finalize transitions happen once", async () => {
  const created = await createOrder({ quantity: 3 });
  const accountId = created.fulfillment.accountId!;
  const session = await claimPaidOrder(created.order.id, created.secret, db());
  const scoped = await getPaidSessionByToken(session.rawSession, db());
  const scopeOrderId = scoped?.scopeOrderId;
  assert.equal(scopeOrderId, created.order.id);

  // A full account session may aggregate all of the account's orders. This
  // exercises the unscoped SELECT ... FOR UPDATE path used after activation
  // or OTP login.
  const fullSessionReservation = await reservePaidCredit(accountId, "image", "full-account-job", "e".repeat(64), randomUUID(), db());
  assert.equal(fullSessionReservation.state, "new");
  await releasePaidCredit(fullSessionReservation.jobId, db());

  const idempotencyKey = "same-paid-job";
  const inputHash = "c".repeat(64);
  const first = await reservePaidCredit(accountId, "image", idempotencyKey, inputHash, randomUUID(), scopeOrderId, db());
  const retry = await reservePaidCredit(accountId, "image", idempotencyKey, inputHash, randomUUID(), scopeOrderId, db());
  assert.equal(first.state, "new");
  assert.equal(retry.state, "existing");
  assert.equal(retry.jobId, first.jobId);
  let balance = (await db().query("SELECT available_credits, reserved_credits FROM ovanto_credit_balances WHERE order_id = $1", [created.order.id])).rows[0];
  assert.deepEqual(balance, { available_credits: 2, reserved_credits: 1 });

  await releasePaidCredit(first.jobId, db());
  await releasePaidCredit(first.jobId, db());
  balance = (await db().query("SELECT available_credits, reserved_credits FROM ovanto_credit_balances WHERE order_id = $1", [created.order.id])).rows[0];
  assert.deepEqual(balance, { available_credits: 3, reserved_credits: 0 });
  // The full-account reservation above was intentionally released first;
  // this order contributes the second release entry.
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE entry_type = 'release'")).rows[0].count, 2);

  const final = await reservePaidCredit(accountId, "image", "final-paid-job", inputHash, randomUUID(), scopeOrderId, db());
  await finalizePaidCredit(final.jobId, db());
  await finalizePaidCredit(final.jobId, db());
  balance = (await db().query("SELECT available_credits, reserved_credits FROM ovanto_credit_balances WHERE order_id = $1", [created.order.id])).rows[0];
  assert.deepEqual(balance, { available_credits: 2, reserved_credits: 0 });
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE entry_type = 'consume'")).rows[0].count, 1);
});

test("same idempotency key remains one job when requests are serialized by the embedded engine", async () => {
  const created = await createOrder({ quantity: 2 });
  const accountId = created.fulfillment.accountId!;
  const session = await claimPaidOrder(created.order.id, created.secret, db());
  const scoped = await getPaidSessionByToken(session.rawSession, db());
  const scopeOrderId = scoped?.scopeOrderId;
  const inputHash = "d".repeat(64);
  const [left, right] = await Promise.all([
    reservePaidCredit(accountId, "image", "serialized-concurrent-key", inputHash, randomUUID(), scopeOrderId, db()),
    reservePaidCredit(accountId, "image", "serialized-concurrent-key", inputHash, randomUUID(), scopeOrderId, db()),
  ]);
  assert.deepEqual([left.state, right.state].sort(), ["existing", "new"]);
  assert.equal(left.jobId, right.jobId);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_paid_jobs WHERE account_id = $1", [accountId])).rows[0].count, 1);
});

test("login challenges expire, stop after five attempts, and activation tokens are single use", async () => {
  const accountId = randomUUID();
  const order = await insertPendingOrder(db(), orderInput({ quantity: 1 }));
  await db().query("INSERT INTO ovanto_accounts (id, email) VALUES ($1,$2)", [accountId, "otp@example.com"]);
  await db().query(
    "INSERT INTO ovanto_activation_tokens (token_hash, account_id, order_id, expires_at) VALUES ($1,$2,$3,now() + interval '1 hour')",
    [hashAccountToken("a".repeat(48)), accountId, order.id],
  );
  const activated = await consumeActivationToken("a".repeat(48), db());
  assert.equal(activated.accountId, accountId);
  await assert.rejects(consumeActivationToken("a".repeat(48), db()), (error: unknown) => error instanceof PaymentError && error.code === "ACTIVATION_TOKEN_INVALID");

  const expiredId = hashAccountToken("expired-challenge");
  await db().query(
    "INSERT INTO ovanto_login_challenges (id, account_id, code_hash, expires_at) VALUES ($1,$2,$3,now() - interval '1 second')",
    [expiredId, accountId, hashAccountToken("12345678")],
  );
  await assert.rejects(verifyLoginCode("otp@example.com", "12345678", db()), (error: unknown) => error instanceof PaymentError && error.code === "LOGIN_CODE_INVALID");

  const challengeId = hashAccountToken("valid-challenge");
  await db().query(
    "INSERT INTO ovanto_login_challenges (id, account_id, code_hash, expires_at) VALUES ($1,$2,$3,now() + interval '10 minutes')",
    [challengeId, accountId, hashAccountToken("12345678")],
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(verifyLoginCode("otp@example.com", "00000000", db()), (error: unknown) => error instanceof PaymentError && error.code === "LOGIN_CODE_INVALID");
  }
  assert.equal((await db().query("SELECT attempts FROM ovanto_login_challenges WHERE id = $1", [challengeId])).rows[0].attempts, 5);
  await assert.rejects(verifyLoginCode("otp@example.com", "12345678", db()), (error: unknown) => error instanceof PaymentError && error.code === "LOGIN_CODE_INVALID");

  const successId = hashAccountToken("success-challenge");
  await db().query(
    "INSERT INTO ovanto_login_challenges (id, account_id, code_hash, expires_at) VALUES ($1,$2,$3,now() + interval '10 minutes')",
    [successId, accountId, hashAccountToken("87654321")],
  );
  const session = await verifyLoginCode("otp@example.com", "87654321", db());
  assert.equal(session.accountId, accountId);
  await assert.rejects(verifyLoginCode("otp@example.com", "87654321", db()), (error: unknown) => error instanceof PaymentError && error.code === "LOGIN_CODE_INVALID");
});
