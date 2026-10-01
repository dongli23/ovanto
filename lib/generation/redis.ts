import { Redis } from "@upstash/redis";
import { REDIS_REQUEST_TIMEOUT_MS } from "./config";
import { storageError } from "./errors";

export interface RedisLike {
  command<T = unknown>(command: string[]): Promise<T>;
  eval<T = unknown>(script: string, keys: string[], args: string[]): Promise<T>;
  get(key: string): Promise<string | null>;
}

class UpstashRedis implements RedisLike {
  private readonly client: Redis;

  constructor(url: string, token: string) {
    const parsedUrl = parseRedisUrl(url);
    this.client = new Redis({
      url: parsedUrl,
      token,
      automaticDeserialization: false,
      responseEncoding: false,
      retry: { retries: 0 },
      enableAutoPipelining: false,
      signal: () => AbortSignal.timeout(REDIS_REQUEST_TIMEOUT_MS),
    });
  }

  async command<T>(command: string[]): Promise<T> {
    if (command.length === 0 || !command[0]) throw storageError();
    try {
      const args: [string, ...(string | number | boolean)[]] = [command[0], ...command.slice(1)];
      return await this.client.exec<T>(args);
    } catch (error) {
      if (error instanceof Error && error.name === "GenerationError") throw error;
      throw storageError();
    }
  }

  async eval<T>(script: string, keys: string[], args: string[]): Promise<T> {
    try {
      return await this.client.eval<string[], T>(script, keys, args);
    } catch (error) {
      if (error instanceof Error && error.name === "GenerationError") throw error;
      throw storageError();
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get<string>(key);
      return value === null || value === undefined ? null : String(value);
    } catch (error) {
      if (error instanceof Error && error.name === "GenerationError") throw error;
      throw storageError();
    }
  }
}

function parseRedisUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("invalid redis url");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    // Never include the configured URL or token in the error surface.
    throw storageError();
  }
}

let testRedis: RedisLike | undefined;

/** Test-only injection. Production always uses the configured Upstash REST store. */
export function setRedisForTests(redis: RedisLike | undefined): void {
  if ((process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "development") || process.env.VERCEL === "1") {
    throw new Error("Test Redis is unavailable outside test/development.");
  }
  testRedis = redis;
}

export function getRedis(): RedisLike {
  const testEnvironment = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
  if (testRedis && testEnvironment && process.env.VERCEL !== "1") return testRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw storageError();
  return new UpstashRedis(url, token);
}

