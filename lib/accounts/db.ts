import { Pool, type PoolClient } from "pg";
import { PaymentError } from "../payments/errors";

export interface DbResult<T extends Record<string, unknown> = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export interface DbExecutor {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<DbResult<T>>;
}

export interface DbTransaction extends DbExecutor {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<DbResult<T>>;
  release(): void;
}

export interface DbPool extends DbExecutor {
  connect(): Promise<DbTransaction>;
}

let pool: DbPool | undefined;

export interface NormalizedDbConfig {
  /** Connection string with any sslmode parameter removed (in-memory copy). */
  connectionString: string;
  /** Explicit TLS config so a connection-string sslmode can never override it. */
  ssl?: { rejectUnauthorized: boolean };
}

const NEON_HOST_SUFFIX = ".neon.tech";
/** TLS modes that perform real certificate verification (CA + hostname). */
const VERifyingSslModes = new Set(["verify-full", "verify-ca"]);
/** TLS modes accepted for Neon hosts; normalized to full verification below. */
const NEON_ACCEPTED_SSL_MODES = new Set(["require", ...VERifyingSslModes]);

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

/**
 * Normalize DATABASE_URL for node-postgres without weakening production TLS.
 *
 * node-postgres gives a connection-string `sslmode` precedence over an
 * explicit `ssl` config object, so an accepted URL is rewritten in memory:
 * the sslmode parameter is stripped and certificate verification is forced
 * explicitly. Nothing is logged and the source environment variable is never
 * mutated.
 *
 * Production policy (fail closed):
 * - Neon (*.neon.tech) + sslmode=require|verify-full|verify-ca → accepted,
 *   normalized to explicit `rejectUnauthorized: true`.
 * - Any host + sslmode=verify-full|verify-ca → accepted, same normalization.
 * - Non-Neon host + only sslmode=require → rejected (no silent relaxation).
 * - Missing/empty/insecure sslmode (disable, allow, prefer, ...) → rejected.
 */
export function normalizeDatabaseUrl(raw: string, production = isProductionRuntime()): NormalizedDbConfig {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }
  if (production) {
    const sslmode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
    const isNeon = url.hostname.toLowerCase().endsWith(NEON_HOST_SUFFIX);
    const accepted = (isNeon && NEON_ACCEPTED_SSL_MODES.has(sslmode)) || VERifyingSslModes.has(sslmode);
    if (!accepted) {
      throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
    }
    url.searchParams.delete("sslmode");
    return { connectionString: url.toString(), ssl: { rejectUnauthorized: true } };
  }
  return { connectionString: raw };
}

export function getAccountDb(): DbPool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  const normalized = normalizeDatabaseUrl(connectionString);

  pool = new Pool({
    connectionString: normalized.connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    // Certificate verification is always explicit here; the sslmode marker
    // was validated (and removed) by normalizeDatabaseUrl above so it can
    // never override this object.
    ssl: normalized.ssl,
  }) as unknown as DbPool;
  return pool;
}

export async function withTransaction<T>(db: DbPool | DbExecutor, fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const connection = "connect" in db && typeof db.connect === "function" ? await db.connect() : undefined;
  if (!connection) {
    // Production callers always use a Pool. The fallback is useful for small
    // deterministic adapter tests and still preserves the SQL API shape.
    return fn(db as DbTransaction);
  }
  try {
    await connection.query("BEGIN");
    const value = await fn(connection);
    await connection.query("COMMIT");
    return value;
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch {
      // Preserve the original error; the pool will discard a broken client.
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Test-only dependency injection; production code never calls this. */
export function setAccountDbForTests(next: DbPool | undefined): void {
  if ((process.env.NODE_ENV === "production" || process.env.VERCEL === "1") && next) {
    throw new PaymentError("TEST_DATABASE_INJECTION_DISABLED", 503);
  }
  pool = next;
}

export function assertRows<T extends Record<string, unknown>>(result: DbResult<T>, code = "DATABASE_UNAVAILABLE"): T {
  const row = result.rows[0];
  if (!row) throw new PaymentError(code, 503);
  return row;
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}

export type PgClient = PoolClient;

