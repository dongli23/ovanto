import { REDIS_REQUEST_TIMEOUT_MS } from "./config";
import { storageError } from "./errors";

export interface RedisLike {
  command<T = unknown>(command: string[]): Promise<T>;
  eval<T = unknown>(script: string, keys: string[], args: string[]): Promise<T>;
  get(key: string): Promise<string | null>;
}

class UpstashRedis implements RedisLike {
  private readonly url: string;
  private readonly token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }

  async command<T>(command: string[]): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REDIS_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        // Do not include the response body: Upstash errors may contain request
        // metadata and should never reach an API client.
        throw storageError();
      }
      const bytes = await readResponseBytes(response, 256 * 1024);
      if (!bytes) throw storageError();
      const payload = JSON.parse(new TextDecoder().decode(bytes)) as { result?: T; error?: unknown };
      if (payload.error !== undefined || !("result" in payload)) throw storageError();
      return payload.result as T;
    } catch (error) {
      if (error instanceof Error && error.name === "GenerationError") throw error;
      throw storageError();
    } finally {
      clearTimeout(timeout);
    }
  }

  eval<T>(script: string, keys: string[], args: string[]): Promise<T> {
    return this.command<T>(["EVAL", script, String(keys.length), ...keys, ...args]);
  }

  async get(key: string): Promise<string | null> {
    const value = await this.command<unknown>(["GET", key]);
    return value === null || value === undefined ? null : String(value);
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
      // The caller maps all upstream body failures to a generic storage error.
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

let testRedis: RedisLike | undefined;

/** Test-only injection. Production always uses the configured Upstash REST store. */
export function setRedisForTests(redis: RedisLike | undefined): void {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") throw new Error("Test Redis is unavailable in production.");
  testRedis = redis;
}

export function getRedis(): RedisLike {
  if (testRedis) return testRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw storageError();
  return new UpstashRedis(url, token);
}

