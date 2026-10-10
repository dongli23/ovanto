import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { getAccountDb, normalizeDatabaseUrl, setAccountDbForTests } from "../lib/accounts/db";
import { PaymentError } from "../lib/payments/errors";

const savedEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  setAccountDbForTests(undefined);
});

const NEON_POOLED_URL = "postgres://user:secretpw123@ep-cool-123456.ap-southeast-1.aws.neon-tech.neon.tech/ovanto?sslmode=require&channel_binding=require";
const NEON_VERIFY_FULL_URL = "postgres://user:secretpw123@ep-cool-123456-pooler.ap-southeast-1.aws.neon.tech/ovanto?sslmode=verify-full";
const NON_NEON_REQUIRE_URL = "postgres://user:secretpw123@db.example.com/ovanto?sslmode=require";
const NON_NEON_VERIFY_FULL_URL = "postgres://user:secretpw123@db.example.com/ovanto?sslmode=verify-full";
const NO_SSLMODE_URL = "postgres://user:secretpw123@db.example.com/ovanto";

test("Neon pooled URL with sslmode=require is accepted and normalized", () => {
  const normalized = normalizeDatabaseUrl(NEON_POOLED_URL, true);
  assert.ok(normalized.ssl);
  assert.equal(normalized.ssl.rejectUnauthorized, true);
  // The sslmode parameter is stripped in memory so node-postgres cannot let
  // it override the explicit ssl object.
  assert.ok(!/sslmode/.test(normalized.connectionString));
  // Everything else (credentials, host, db, other params) is preserved.
  assert.ok(normalized.connectionString.includes("ep-cool-123456.ap-southeast-1.aws.neon-tech.neon.tech"));
  assert.ok(normalized.connectionString.includes("/ovanto"));
  assert.ok(normalized.connectionString.includes("channel_binding=require"));
});

test("Neon URL with sslmode=verify-full is accepted and normalized the same way", () => {
  const normalized = normalizeDatabaseUrl(NEON_VERIFY_FULL_URL, true);
  assert.equal(normalized.ssl?.rejectUnauthorized, true);
  assert.ok(!/sslmode/.test(normalized.connectionString));
});

test("non-Neon sslmode=require is rejected in production", () => {
  assert.throws(
    () => normalizeDatabaseUrl(NON_NEON_REQUIRE_URL, true),
    (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE",
  );
});

test("non-Neon sslmode=verify-full is accepted in production", () => {
  const normalized = normalizeDatabaseUrl(NON_NEON_VERIFY_FULL_URL, true);
  assert.equal(normalized.ssl?.rejectUnauthorized, true);
  assert.ok(!/sslmode/.test(normalized.connectionString));
});

test("missing or insecure TLS parameters fail closed in production", () => {
  for (const url of [NO_SSLMODE_URL, `${NO_SSLMODE_URL}?sslmode=disable`, `${NO_SSLMODE_URL}?sslmode=prefer`, `${NO_SSLMODE_URL}?sslmode=allow`, "not-a-url"]) {
    assert.throws(
      () => normalizeDatabaseUrl(url, true),
      (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE",
    );
  }
});

test("non-production keeps the connection string untouched", () => {
  const normalized = normalizeDatabaseUrl(NEON_POOLED_URL, false);
  assert.equal(normalized.connectionString, NEON_POOLED_URL);
  assert.equal(normalized.ssl, undefined);
});

test("missing DATABASE_URL fails closed with 503", () => {
  delete process.env.DATABASE_URL;
  process.env.VERCEL = "1";
  assert.throws(
    () => getAccountDb(),
    (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_CONFIGURATION_UNAVAILABLE",
  );
});

test("production accepts Neon sslmode=require when the pool is built", () => {
  // The old gate rejected require outright; the new layer must accept it.
  process.env.VERCEL = "1";
  process.env.DATABASE_URL = NEON_POOLED_URL;
  const db = getAccountDb();
  assert.ok(db);
  setAccountDbForTests(undefined);
});

test("rejected URLs never leak credentials or connection strings in errors", () => {
  for (const url of [NON_NEON_REQUIRE_URL, NO_SSLMODE_URL, "postgres://user:supersecretpw@host/db?sslmode=disable"]) {
    try {
      normalizeDatabaseUrl(url, true);
      assert.fail("expected rejection");
    } catch (error) {
      assert.ok(error instanceof PaymentError);
      assert.equal(error.code, "PAYMENT_CONFIGURATION_UNAVAILABLE");
      assert.ok(!String(error.message).includes("secretpw"));
      assert.ok(!String(error.message).includes("supersecretpw"));
      assert.ok(!String(error.message).includes("@"));
    }
  }
});
