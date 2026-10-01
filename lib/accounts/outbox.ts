import { getAccountDb, type DbPool, withTransaction } from "./db";
import { decryptOutboxToken } from "./crypto";
import { activationEmail, loginCodeEmail, sendEmail } from "./email";

export interface OutboxFlushResult {
  attempted: number;
  sent: number;
  failed: number;
}

interface OutboxRow extends Record<string, unknown> {
  id: string;
  kind: "activation" | "login_code";
  recipient: string;
  encrypted_token: string;
  attempts: number;
}

/**
 * Optional worker entrypoint. Webhook/login transactions only enqueue rows;
 * this function sends after commit and leaves failures retryable.
 */
export async function flushEmailOutbox(limit = 10, db: DbPool = getAccountDb()): Promise<OutboxFlushResult> {
  const rows = await withTransaction(db, async (tx) => {
    const result = await tx.query<OutboxRow>(
      `SELECT id, kind, recipient, encrypted_token, attempts
         FROM ovanto_email_outbox
        WHERE sent_at IS NULL AND next_attempt_at <= now()
          AND ((kind = 'activation' AND created_at > now() - interval '7 days')
            OR (kind = 'login_code' AND created_at > now() - interval '10 minutes'))
        ORDER BY created_at
        LIMIT $1 FOR UPDATE SKIP LOCKED`,
      [Math.max(1, Math.min(50, Math.trunc(limit)))],
    );
    for (const row of result.rows) {
      // Reserve the row until the network call completes. The lock is
      // released at COMMIT, so the lease prevents another invocation from
      // selecting this row while this invocation is still sending it.
      await tx.query(
        "UPDATE ovanto_email_outbox SET attempts = attempts + 1, next_attempt_at = now() + interval '5 minutes' WHERE id = $1",
        [row.id],
      );
    }
    return result.rows;
  });

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const token = decryptOutboxToken(row.encrypted_token);
      const message = row.kind === "activation"
        ? activationEmail(row.recipient, token, `ovanto-outbox-${row.id}`)
        : loginCodeEmail(row.recipient, token, `ovanto-outbox-${row.id}`);
      await sendEmail(message);
      await db.query("UPDATE ovanto_email_outbox SET sent_at = now(), encrypted_token = '', last_error = NULL WHERE id = $1", [row.id]);
      sent += 1;
    } catch (error) {
      const safeError = error instanceof Error ? error.name : "delivery_error";
      const nextDelaySeconds = Math.min(24 * 60 * 60, 2 ** Math.min(12, Number(row.attempts) + 1) * 30);
      await db.query(
        "UPDATE ovanto_email_outbox SET next_attempt_at = now() + ($2 * interval '1 second'), last_error = $3 WHERE id = $1",
        [row.id, nextDelaySeconds, safeError],
      );
      failed += 1;
    }
  }
  return { attempted: rows.length, sent, failed };
}

