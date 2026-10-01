import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { PaymentError } from "../payments/errors";

function secret(): Buffer {
  const raw = process.env.ACCOUNT_TOKEN_SECRET;
  if (!raw || raw.length < 32) throw new PaymentError("PAYMENT_CONFIGURATION_UNAVAILABLE", 503);
  return createHash("sha256").update(raw).digest();
}

export function hashAccountToken(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function tokensEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomLoginCode(): string {
  return randomInt(10_000_000, 100_000_000).toString();
}

/**
 * Outbox payloads contain a one-time activation/login token. The plaintext is
 * never stored in PostgreSQL; this envelope is decryptable only by the server
 * secret and is removed once the message is sent.
 */
export function encryptOutboxToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptOutboxToken(payload: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new PaymentError("EMAIL_OUTBOX_CORRUPT", 503);
  try {
    const decipher = createDecipheriv("aes-256-gcm", secret(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new PaymentError("EMAIL_OUTBOX_CORRUPT", 503);
  }
}

export function randomOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

