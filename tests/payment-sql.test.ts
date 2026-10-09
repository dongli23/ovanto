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
  attachWaffoOrder,
  balancesFor,
  claimPaidOrder,
  finalizePaidCredit,
  fulfillWaffoEvent,
  getPaidJob,
  getPaidSessionByToken,
  insertPendingOrder,
  markCheckoutFailed,
  releasePaidCredit,
  reservePaidCredit,
  type PendingOrderInput,
  type VerifiedWaffoPayment,
} from "../lib/payments/store";
import { hashSecret, WAFFO_PACK_CREDITS } from "../lib/payments/config";
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

const migrationPaths = [
  resolve(process.cwd(), "scripts/sql/001_payments_accounts.sql"),
  resolve(process.cwd(), "scripts/sql/002_waffo_payment_cutover.sql"),
];
let database: PGlite | undefined;
let pool: PGlitePool | undefined;

test.beforeEach(async () => {
  process.env.ACCOUNT_TOKEN_SECRET = "sql-test-account-token-secret-32-bytes!!";
  process.env.WAFFO_STORE_ID = "STO_sqlteststore000000001";
  process.env.WAFFO_ENVIRONMENT = "prod";
  database = new PGlite();
  for (const path of migrationPaths) {
    await database.exec(await readFile(path, "utf8"));
  }
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
  const unitAmountCents = overrides.unitAmountCents ?? 499;
  const id = randomUUID();
  return {
    id,
    idempotencyKey: `sql-order-${randomUUID()}`,
    product: "video",
    quantity: 1,
    unitAmountCents,
    amountCents: unitAmountCents,
    currency: "usd",
    // Mirrors production: the merchant external id is the local order id.
    waffoPaymentRequestId: id,
    claimSecretHash: hashSecret("s".repeat(48)),
    returnPath: "/it/",
    ...overrides,
  };
}

async function createOrder(
  overrides: Partial<PendingOrderInput> = {},
  email = "buyer@example.com",
): Promise<{ order: Awaited<ReturnType<typeof insertPendingOrder>>; secret: string; acquiringOrderId: string; fulfillment: Awaited<ReturnType<typeof fulfillWaffoEvent>> }> {
  const secret = "s".repeat(48);
  const input = { ...orderInput(overrides), claimSecretHash: hashSecret(secret) };
  const order = await insertPendingOrder(db(), input);
  const acquiringOrderId = `wao_${randomUUID()}`;
  await attachWaffoOrder(db(), order.id, acquiringOrderId);
  const fulfillment = await fulfillWaffoEvent(checkoutFor(order, acquiringOrderId, email), db());
  return { order, secret, acquiringOrderId, fulfillment };
}

function checkoutFor(
  order: Awaited<ReturnType<typeof insertPendingOrder>>,
  acquiringOrderId: string,
  email = "buyer@example.com",
  overrides: Partial<Pick<VerifiedWaffoPayment, "amountCents" | "currency" | "externalOrderId" | "storeId" | "mode" | "productName">> = {},
): VerifiedWaffoPayment {
  return {
    eventId: randomUUID(),
    orderId: acquiringOrderId,
    externalOrderId: overrides.externalOrderId ?? order.waffoPaymentRequestId ?? "",
    storeId: overrides.storeId ?? "STO_sqlteststore000000001",
    mode: overrides.mode ?? "prod",
    orderStatus: "completed",
    paymentStatus: "succeeded",
    productName: overrides.productName ?? "Ovanto Pro Video Pack",
    amountCents: overrides.amountCents ?? order.amountCents,
    currency: overrides.currency ?? "usd",
    email,
  };
}

test("Waffo webhook fulfillment is idempotent for duplicate and repeated paid events", async () => {
  const input = orderInput();
  const secret = "s".repeat(48);
  const order = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret(secret) });
  const acquiringOrderId = `wao_${randomUUID()}`;
  await attachWaffoOrder(db(), order.id, acquiringOrderId);

  const first = await fulfillWaffoEvent(checkoutFor(order, acquiringOrderId, "same@example.com"), db());
  const duplicate = await fulfillWaffoEvent(checkoutFor(order, acquiringOrderId, "same@example.com"), db());
  const differentEvent = await fulfillWaffoEvent(checkoutFor(order, `wao_${randomUUID()}`, "same@example.com"), db());

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(differentEvent.duplicate, true);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_waffo_events")).rows[0].count, 2);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE entry_type = 'grant'")).rows[0].count, 1);
  assert.equal((await db().query("SELECT available_credits FROM ovanto_credit_balances WHERE order_id = $1", [order.id])).rows[0].available_credits, WAFFO_PACK_CREDITS);
});

test("mismatched paid amount rolls back event receipt and all fulfillment state", async () => {
  const { order, acquiringOrderId } = await (async () => {
    const input = orderInput();
    const secret = "s".repeat(48);
    const created = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret(secret) });
    const acquiring = `wao_${randomUUID()}`;
    await attachWaffoOrder(db(), created.id, acquiring);
    return { order: created, acquiringOrderId: acquiring };
  })();

  await assert.rejects(
    fulfillWaffoEvent(checkoutFor(order, acquiringOrderId, "rollback@example.com", { amountCents: order.amountCents + 1 }), db()),
    (error: unknown) => error instanceof PaymentError && error.code === "CHECKOUT_VALIDATION_FAILED",
  );
  assert.equal((await db().query("SELECT status FROM ovanto_orders WHERE id = $1", [order.id])).rows[0].status, "pending");
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_waffo_events")).rows[0].count, 0);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_accounts")).rows[0].count, 0);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger")).rows[0].count, 0);
});

test("mismatched currency, product name, store id, or external order id grants nothing", async () => {
  for (const overrides of [
    { currency: "eur" },
    { productName: "Fake Pack" },
    { storeId: "STO_foreignstore000000001" },
    { externalOrderId: randomUUID() },
  ]) {
    const input = orderInput();
    const order = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret("s".repeat(48)) });
    await attachWaffoOrder(db(), order.id, `wao_${randomUUID()}`);

    if ("externalOrderId" in overrides) {
      // An unknown external id matches no pending order at all.
      await assert.rejects(
        fulfillWaffoEvent(checkoutFor(order, `wao_${randomUUID()}`, "tamper@example.com", overrides), db()),
        (error: unknown) => error instanceof PaymentError && error.code === "ORDER_UNAVAILABLE",
      );
    } else {
      await assert.rejects(
        fulfillWaffoEvent(checkoutFor(order, `wao_${randomUUID()}`, "tamper@example.com", overrides), db()),
        (error: unknown) => error instanceof PaymentError && error.code === "CHECKOUT_VALIDATION_FAILED",
      );
    }
    assert.equal((await db().query("SELECT status FROM ovanto_orders WHERE id = $1", [order.id])).rows[0].status, "pending");
    assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE order_id = $1", [order.id])).rows[0].count, 0);
  }
});

test("a success redirect without a verified webhook grants no credits", async () => {
  const input = orderInput();
  const secret = "s".repeat(48);
  const order = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret(secret) });

  // The browser returns with ?payment=success, but the order is not paid and
  // the claim cookie cannot authorize anything.
  await assert.rejects(
    claimPaidOrder(order.id, secret, db()),
    (error: unknown) => error instanceof PaymentError && error.code === "CHECKOUT_CLAIM_REQUIRED",
  );
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_balances WHERE order_id = $1", [order.id])).rows[0].count, 0);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE order_id = $1", [order.id])).rows[0].count, 0);
});

test("a checkout failed before Waffo order creation cannot receive a later grant", async () => {
  const input = orderInput();
  const secret = "s".repeat(48);
  const order = await insertPendingOrder(db(), { ...input, claimSecretHash: hashSecret(secret) });
  const acquiringOrderId = `wao_failed_${randomUUID()}`;
  await attachWaffoOrder(db(), order.id, acquiringOrderId);
  await markCheckoutFailed(db(), order.id);

  await assert.rejects(
    fulfillWaffoEvent(checkoutFor(order, acquiringOrderId, "failed@example.com"), db()),
    (error: unknown) => error instanceof PaymentError && error.code === "ORDER_UNAVAILABLE",
  );
  assert.equal((await db().query("SELECT status FROM ovanto_orders WHERE id = $1", [order.id])).rows[0].status, "checkout_failed");
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_accounts")).rows[0].count, 0);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger")).rows[0].count, 0);
});

test("checkout orders for the same email stay scoped to their own video credits", async () => {
  const first = await createOrder({}, "same@example.com");
  const firstSession = await claimPaidOrder(first.order.id, first.secret, db());
  const firstPaidSession = await getPaidSessionByToken(firstSession.rawSession, db());
  assert.equal(firstPaidSession?.scopeOrderId, first.order.id);
  assert.deepEqual(firstPaidSession?.balances, { image: 0, edit: 0, video: WAFFO_PACK_CREDITS });

  const second = await createOrder({}, "same@example.com");
  const secondSession = await claimPaidOrder(second.order.id, second.secret, db(), firstSession.rawSession);
  const secondPaidSession = await getPaidSessionByToken(secondSession.rawSession, db());
  assert.equal(secondPaidSession?.scopeOrderId, second.order.id);
  assert.deepEqual(secondPaidSession?.balances, { image: 0, edit: 0, video: WAFFO_PACK_CREDITS });
  assert.deepEqual(await balancesFor(db(), second.fulfillment.accountId!, second.order.id), { image: 0, edit: 0, video: WAFFO_PACK_CREDITS });
  assert.deepEqual(await balancesFor(db(), second.fulfillment.accountId!, first.order.id), { image: 0, edit: 0, video: WAFFO_PACK_CREDITS });

  const reserved = await reservePaidCredit(
    second.fulfillment.accountId!,
    "video",
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
  const created = await createOrder();
  const accountId = created.fulfillment.accountId!;
  const session = await claimPaidOrder(created.order.id, created.secret, db());
  const scoped = await getPaidSessionByToken(session.rawSession, db());
  const scopeOrderId = scoped?.scopeOrderId;
  assert.equal(scopeOrderId, created.order.id);

  // A full account session may aggregate all of the account's orders. This
  // exercises the unscoped SELECT ... FOR UPDATE path used after activation
  // or OTP login.
  const fullSessionReservation = await reservePaidCredit(accountId, "video", "full-account-job", "e".repeat(64), randomUUID(), db());
  assert.equal(fullSessionReservation.state, "new");
  await releasePaidCredit(fullSessionReservation.jobId, db());

  const idempotencyKey = "same-paid-job";
  const inputHash = "c".repeat(64);
  const first = await reservePaidCredit(accountId, "video", idempotencyKey, inputHash, randomUUID(), scopeOrderId, db());
  const retry = await reservePaidCredit(accountId, "video", idempotencyKey, inputHash, randomUUID(), scopeOrderId, db());
  assert.equal(first.state, "new");
  assert.equal(retry.state, "existing");
  assert.equal(retry.jobId, first.jobId);
  let balance = (await db().query("SELECT available_credits, reserved_credits FROM ovanto_credit_balances WHERE order_id = $1", [created.order.id])).rows[0];
  assert.deepEqual(balance, { available_credits: WAFFO_PACK_CREDITS - 1, reserved_credits: 1 });

  await releasePaidCredit(first.jobId, db());
  await releasePaidCredit(first.jobId, db());
  balance = (await db().query("SELECT available_credits, reserved_credits FROM ovanto_credit_balances WHERE order_id = $1", [created.order.id])).rows[0];
  assert.deepEqual(balance, { available_credits: WAFFO_PACK_CREDITS, reserved_credits: 0 });
  // The full-account reservation above was intentionally released first;
  // this order contributes the second release entry.
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE entry_type = 'release'")).rows[0].count, 2);

  const final = await reservePaidCredit(accountId, "video", "final-paid-job", inputHash, randomUUID(), scopeOrderId, db());
  await finalizePaidCredit(final.jobId, db());
  await finalizePaidCredit(final.jobId, db());
  balance = (await db().query("SELECT available_credits, reserved_credits FROM ovanto_credit_balances WHERE order_id = $1", [created.order.id])).rows[0];
  assert.deepEqual(balance, { available_credits: WAFFO_PACK_CREDITS - 1, reserved_credits: 0 });
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_credit_ledger WHERE entry_type = 'consume'")).rows[0].count, 1);
});

test("same idempotency key remains one job when requests are serialized by the embedded engine", async () => {
  const created = await createOrder();
  const accountId = created.fulfillment.accountId!;
  const session = await claimPaidOrder(created.order.id, created.secret, db());
  const scoped = await getPaidSessionByToken(session.rawSession, db());
  const scopeOrderId = scoped?.scopeOrderId;
  const inputHash = "d".repeat(64);
  const [left, right] = await Promise.all([
    reservePaidCredit(accountId, "video", "serialized-concurrent-key", inputHash, randomUUID(), scopeOrderId, db()),
    reservePaidCredit(accountId, "video", "serialized-concurrent-key", inputHash, randomUUID(), scopeOrderId, db()),
  ]);
  assert.deepEqual([left.state, right.state].sort(), ["existing", "new"]);
  assert.equal(left.jobId, right.jobId);
  assert.equal((await db().query("SELECT count(*)::int AS count FROM ovanto_paid_jobs WHERE account_id = $1", [accountId])).rows[0].count, 1);
});

test("login challenges expire, stop after five attempts, and activation tokens are single use", async () => {
  const accountId = randomUUID();
  const order = await insertPendingOrder(db(), orderInput());
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
