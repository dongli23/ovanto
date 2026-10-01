import { GenerationError } from "./errors";
import { TURNSTILE_REQUEST_TIMEOUT_MS } from "./config";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ALLOWED_HOSTNAMES = new Set(["www.ovanto.ai", "ovanto.vercel.app"]);

export async function verifyTurnstile(token: string, remoteIp: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  }
  if (!token) throw new GenerationError("TURNSTILE_REQUIRED", 400, "Human verification is required.");

  const form = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new GenerationError("TURNSTILE_UNAVAILABLE", 503, "Human verification is temporarily unavailable.");
    const bytes = await readResponseBytes(response, 32 * 1024);
    if (!bytes) throw new GenerationError("TURNSTILE_UNAVAILABLE", 503, "Human verification is temporarily unavailable.");

    let result: unknown;
    try {
      result = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new GenerationError("TURNSTILE_UNAVAILABLE", 503, "Human verification is temporarily unavailable.");
    }

    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new GenerationError("TURNSTILE_UNAVAILABLE", 503, "Human verification is temporarily unavailable.");
    }
    const payload = result as {
      success?: unknown;
      action?: unknown;
      hostname?: unknown;
    };
    if (payload.success !== true) throw new GenerationError("TURNSTILE_FAILED", 403, "Human verification failed.");
    if (payload.action !== "generate" || typeof payload.hostname !== "string" || !ALLOWED_HOSTNAMES.has(payload.hostname)) {
      throw new GenerationError("TURNSTILE_FAILED", 403, "Human verification failed.");
    }
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("TURNSTILE_UNAVAILABLE", 503, "Human verification is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const chunk = part.value;
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The caller maps all upstream body failures to a generic verification error.
    }
    return null;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

