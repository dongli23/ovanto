import test from "node:test";
import assert from "node:assert/strict";
import { getRedis, setRedisForTests, type RedisLike } from "../lib/generation/redis";
import { GenerationError } from "../lib/generation/errors";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const originalAbortSignalTimeout = AbortSignal.timeout;

type CapturedRequest = {
  input: string;
  init?: RequestInit;
};

function setEnv(name: string, value: string): void {
  process.env[name] = value;
}

function useSdkEnv(): void {
  setEnv("NODE_ENV", "test");
  delete process.env.VERCEL;
  setEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  setEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
}

function response(result: unknown, status = 200): Response {
  return new Response(JSON.stringify({ result }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function bodyOf(request: CapturedRequest): unknown {
  return JSON.parse(String(request.init?.body));
}

function isStorageError(error: unknown): boolean {
  return error instanceof GenerationError && error.code === "STORAGE_UNAVAILABLE";
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(AbortSignal, "timeout", { value: originalAbortSignalTimeout, configurable: true, writable: true });
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") setRedisForTests(undefined);
});

test("SDK keeps RedisLike command, GET strings, SET TTL/NX, and EVAL keys/args", async () => {
  useSdkEnv();
  const requests: CapturedRequest[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ input: String(input), init });
    const command = bodyOf({ input: String(input), init });
    const commandName = Array.isArray(command) ? String(command[0]).toUpperCase() : "";
    if (commandName === "GET") return response('{"job":"pending"}');
    if (commandName === "EVAL") return response("lua-result");
    return response("OK");
  };

  const redis = getRedis();
  assert.equal(await redis.get("job:1"), '{"job":"pending"}');
  assert.equal(await redis.command(["SET", "lock:1", "token", "EX", "60", "NX"]), "OK");
  assert.equal(await redis.eval("return ARGV[1]", ["lock:1"], ["token"]), "lua-result");

  assert.deepEqual(bodyOf(requests[0]), ["get", "job:1"]);
  assert.deepEqual(bodyOf(requests[1]), ["SET", "lock:1", "token", "EX", "60", "NX"]);
  assert.deepEqual(bodyOf(requests[2]), ["eval", "return ARGV[1]", 1, "lock:1", "token"]);
});

test("SDK returns null for missing GET values and does not deserialize JSON strings", async () => {
  useSdkEnv();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response(null);
  };

  const redis = getRedis();
  assert.equal(await redis.get("missing"), null);
  assert.equal(calls, 1);
});

test("SDK transport retries are disabled so an INCR-like command is sent once", async () => {
  useSdkEnv();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("network failure");
  };

  await assert.rejects(getRedis().command(["INCR", "counter"]), isStorageError);
  assert.equal(calls, 1);
});

test("SDK requests use the bounded AbortSignal timeout and map aborts to storage errors", async () => {
  useSdkEnv();
  const timeoutSignal = AbortSignal.abort(new DOMException("timed out", "TimeoutError"));
  Object.defineProperty(AbortSignal, "timeout", { value: () => timeoutSignal, configurable: true, writable: true });
  let receivedSignal: AbortSignal | undefined;
  globalThis.fetch = async (_input, init) => {
    receivedSignal = init?.signal as AbortSignal | undefined;
    throw receivedSignal?.reason ?? new Error("aborted");
  };

  await assert.rejects(getRedis().get("timeout"), isStorageError);
  assert.equal(receivedSignal, timeoutSignal);
  assert.equal(receivedSignal?.reason?.name, "TimeoutError");
});

test("Redis URL validation rejects non-HTTPS or credential-bearing URLs without exposing secrets", () => {
  setEnv("NODE_ENV", "test");
  delete process.env.VERCEL;
  setEnv("UPSTASH_REDIS_REST_TOKEN", "super-secret-token");
  for (const invalidUrl of [
    "http://example.upstash.io",
    "https://user:password@example.upstash.io",
    "not a url",
  ]) {
    setEnv("UPSTASH_REDIS_REST_URL", invalidUrl);
    assert.throws(() => getRedis(), (error: unknown) => {
      assert.equal(isStorageError(error), true);
      assert.equal(String(error).includes(invalidUrl), false);
      assert.equal(String(error).includes("super-secret-token"), false);
      return true;
    });
  }
});

test("Redis SDK and test injection never fall back to in-memory production state", () => {
  const fake: RedisLike = {
    command: async <T>() => "OK" as T,
    eval: async <T>() => "OK" as T,
    get: async () => null,
  };
  setEnv("NODE_ENV", "test");
  delete process.env.VERCEL;
  setRedisForTests(fake);
  assert.equal(getRedis(), fake);

  setEnv("NODE_ENV", "production");
  assert.throws(() => setRedisForTests(fake), /unavailable/);
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.throws(() => getRedis(), isStorageError);
  setEnv("NODE_ENV", "test");
  setEnv("VERCEL", "1");
  assert.throws(() => setRedisForTests(fake), /unavailable/);
  delete process.env.VERCEL;
  setRedisForTests(undefined);
});

