import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { getTrustedNetworkIdentity } from "../generation/identity";
import { getAccountDb, type DbPool, withTransaction } from "./db";
import { encryptOutboxToken, hashAccountToken, randomLoginCode, randomOpaqueToken } from "./crypto";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_TTL_SECONDS,
  normalizeEmail,
} from "../payments/config";
import { PaymentError } from "../payments/errors";
import { balancesFor, type PaidBalance, type PaidSession } from "../payments/store";

export interface LoginRequestResult {
  accepted: boolean;
}

export interface SessionResult {
  rawSession: string;
  accountId: string;
  balances: PaidBalance;
}

export async function getPaidSession(_request: Request, db: DbPool = getAccountDb()): Promise<PaidSession | null> {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
  if (!rawSession || rawSession.length < 32) return null;
  const result = await db.query<SessionRow>(
    `SELECT account_id, scope_order_id FROM ovanto_account_sessions
     WHERE token_hash = $1 AND expires_at > now()`,
    [hashAccountToken(rawSession)],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { accountId: row.account_id, scopeOrderId: row.scope_order_id ?? undefined, balances: await balancesFor(db, row.account_id, row.scope_order_id ?? undefined) };
}

export function accountSessionCookie(rawSession: string): { name: string; value: string; options: { httpOnly: true; sameSite: "lax"; secure: boolean; path: string; maxAge: number } } {
  return {
    name: ACCOUNT_SESSION_COOKIE,
    value: rawSession,
    options: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1", path: "/", maxAge: ACCOUNT_SESSION_TTL_SECONDS },
  };
}

/**
 * The response is intentionally identical for unknown and known email
 * addresses.  A code is only created for an existing paid account.
 */
export async function requestLoginCode(emailInput: string, request: Request, db: DbPool = getAccountDb()): Promise<LoginRequestResult> {
  const email = normalizeEmail(emailInput);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return { accepted: true };
  const ipHash = trustedLoginIpHash(request);
  return withTransaction(db, async (tx) => {
    const accountResult = await tx.query<AccountRow>("SELECT id FROM ovanto_accounts WHERE email = $1", [email]);
    const account = accountResult.rows[0];
    if (!account) return { accepted: true };

    const rate = await tx.query<RateRow>(
      `INSERT INTO ovanto_login_rate (account_id, ip_hash, window_started_at, send_count, last_sent_at)
       VALUES ($1,$2,now(),1,now())
       ON CONFLICT (account_id, ip_hash) DO UPDATE
       SET send_count = CASE WHEN ovanto_login_rate.window_started_at < now() - interval '1 hour' THEN 1 ELSE ovanto_login_rate.send_count + 1 END,
           window_started_at = CASE WHEN ovanto_login_rate.window_started_at < now() - interval '1 hour' THEN now() ELSE ovanto_login_rate.window_started_at END,
           last_sent_at = now()
       WHERE ovanto_login_rate.last_sent_at < now() - interval '60 seconds'
         AND (ovanto_login_rate.window_started_at < now() - interval '1 hour' OR ovanto_login_rate.send_count < 5)
       RETURNING send_count, last_sent_at`,
      [account.id, ipHash],
    );
    if (!rate.rows[0]) return { accepted: true };

    const code = randomLoginCode();
    const challengeId = hashAccountToken(`${account.id}:${code}:${Date.now()}`);
    await tx.query(
      `INSERT INTO ovanto_login_challenges
        (id, account_id, code_hash, expires_at, attempts)
       VALUES ($1,$2,$3,now() + interval '10 minutes',0)`,
      [challengeId, account.id, hashAccountToken(code)],
    );
    await tx.query(
      `INSERT INTO ovanto_email_outbox
        (id, account_id, kind, recipient, encrypted_token)
       VALUES ($1,$2,'login_code',$3,$4)`,
      [challengeId, account.id, email, encryptOutboxToken(code)],
    );
    return { accepted: true };
  });
}

export async function verifyLoginCode(emailInput: string, code: string, db: DbPool = getAccountDb()): Promise<SessionResult> {
  const email = normalizeEmail(emailInput);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{8}$/.test(code)) throw new PaymentError("LOGIN_CODE_INVALID", 401);
  const outcome = await withTransaction(db, async (tx): Promise<SessionResult | null> => {
    const accountResult = await tx.query<AccountRow>("SELECT id FROM ovanto_accounts WHERE email = $1", [email]);
    const account = accountResult.rows[0];
    if (!account) return null;
    const challengeResult = await tx.query<LoginChallengeRow>(
      `SELECT * FROM ovanto_login_challenges
       WHERE account_id = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [account.id],
    );
    const challenge = challengeResult.rows[0];
    if (!challenge) return null;
    const suppliedHash = hashAccountToken(code);
    await tx.query("UPDATE ovanto_login_challenges SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);
    if (suppliedHash !== challenge.code_hash) return null;
    await tx.query("UPDATE ovanto_login_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL", [challenge.id]);
    const rawSession = randomOpaqueToken();
    await tx.query(
      `INSERT INTO ovanto_account_sessions (token_hash, account_id, scope_order_id, expires_at)
       VALUES ($1,$2,NULL,now() + interval '30 days')`,
      [hashAccountToken(rawSession), account.id],
    );
    return { rawSession, accountId: account.id, balances: await balancesFor(tx, account.id) };
  });
  if (!outcome) throw new PaymentError("LOGIN_CODE_INVALID", 401);
  return outcome;
}

export async function consumeActivationToken(token: string, db: DbPool = getAccountDb()): Promise<SessionResult> {
  if (!token || token.length < 32 || token.length > 256) throw new PaymentError("ACTIVATION_TOKEN_INVALID", 401);
  return withTransaction(db, async (tx) => {
    const result = await tx.query<ActivationRow>(
      `SELECT * FROM ovanto_activation_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
      [hashAccountToken(token)],
    );
    const activation = result.rows[0];
    if (!activation) throw new PaymentError("ACTIVATION_TOKEN_INVALID", 401);
    const used = await tx.query("UPDATE ovanto_activation_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL RETURNING token_hash", [activation.token_hash]);
    if (used.rows.length !== 1) throw new PaymentError("ACTIVATION_TOKEN_INVALID", 401);
    const rawSession = randomOpaqueToken();
    await tx.query(
      `INSERT INTO ovanto_account_sessions (token_hash, account_id, scope_order_id, expires_at)
       VALUES ($1,$2,NULL,now() + interval '30 days')`,
      [hashAccountToken(rawSession), activation.account_id],
    );
    return { rawSession, accountId: activation.account_id, balances: await balancesFor(tx, activation.account_id) };
  });
}

function trustedLoginIpHash(request: Request): string {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  let network: { ip: string; country: string };
  try {
    network = getTrustedNetworkIdentity(request);
  } catch {
    throw new PaymentError("TRUSTED_IDENTITY_UNAVAILABLE", 503);
  }
  // Paid account access is intentionally independent from free-region policy;
  // country is read only to select a stable, trusted rate-limit identity.
  void network.country;
  return createHmac("sha256", secret).update(network.ip).digest("hex");
}

interface AccountRow extends Record<string, unknown> { id: string }
interface SessionRow extends Record<string, unknown> { account_id: string; scope_order_id: string | null }
interface RateRow extends Record<string, unknown> { send_count: number; last_sent_at: string }
interface LoginChallengeRow extends Record<string, unknown> { id: string; code_hash: string }
interface ActivationRow extends Record<string, unknown> { token_hash: string; account_id: string }

