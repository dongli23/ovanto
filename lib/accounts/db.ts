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

export function getAccountDb(): DbPool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    const secureMode = /(?:[?&])sslmode=verify-full(?:&|$)/i.test(connectionString);
    if (!secureMode) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    // Keep certificate verification enabled; production also requires the
    // explicit sslmode=verify-full marker in DATABASE_URL above.
    ssl: process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? { rejectUnauthorized: true } : undefined,
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

