import { PaymentError } from "./errors";

export function assertPaymentOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new PaymentError("ORIGIN_MISMATCH", 403);
  }
  if (parsed.origin === "null") throw new PaymentError("ORIGIN_MISMATCH", 403);
  const allowed = new Set(["https://ovanto.ai"]);
  if (process.env.NODE_ENV !== "production" && process.env.DEV_ALLOW_LOCAL_REQUESTS === "true") {
    try { allowed.add(new URL(request.url).origin); } catch { /* request URL is a Fetch URL in production */ }
  }
  if (!allowed.has(parsed.origin)) throw new PaymentError("ORIGIN_MISMATCH", 403);
}

export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const advertised = request.headers.get("content-length");
  if (advertised && /^\d+$/.test(advertised) && Number(advertised) > maxBytes) throw new PaymentError("REQUEST_TOO_LARGE", 413);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PaymentError("REQUEST_TOO_LARGE", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const raw = await readBoundedText(request, maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PaymentError("JSON_INVALID", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PaymentError("JSON_INVALID", 400);
  return parsed as Record<string, unknown>;
}

export function assertExactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) if (!expected.has(key)) throw new PaymentError("REQUEST_INVALID", 400);
  for (const key of keys) if (!(key in value)) throw new PaymentError("REQUEST_INVALID", 400);
}

