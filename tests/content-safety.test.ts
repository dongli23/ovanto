import assert from "node:assert/strict";
import test from "node:test";
import { proxy } from "../proxy";
import { GenerationError } from "../lib/generation/errors";
import {
  assertPromptSafe,
  resolveContentSafetyLocale,
  type ContentSafetyLocale,
} from "../lib/generation/content-safety";

function verdict(overrides: Record<string, unknown> = {}) {
  return {
    action: "allow",
    reasonCode: "allowed",
    matchedCategories: [],
    requestId: "req_safe_test",
    semanticStatus: "disabled",
    ...overrides,
  } as never;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof GenerationError ? error.code : undefined;
}

test("content safety allows only an explicit allow verdict and logs no prompt", async () => {
  const events: Record<string, unknown>[] = [];
  const prompt = "private prompt that must never appear in logs";
  await assertPromptSafe(prompt, "en", {
    scanner: async (params) => {
      assert.equal(params.prompt, prompt);
      assert.equal(params.semantic, "enforce");
      return verdict();
    },
    logger: (event) => events.push(event),
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].allowed, true);
  assert.equal(events[0].action, "allow");
  assert.equal(JSON.stringify(events).includes(prompt), false);
  assert.deepEqual(events[0].categories, []);
});

test("blocked prompts stop the downstream provider/reservation/credit sequence", async () => {
  const events: Record<string, unknown>[] = [];
  let reservationCalls = 0;
  let providerCalls = 0;
  let creditCalls = 0;

  await assert.rejects(
    async () => {
      await assertPromptSafe("blocked prompt", "fr", {
        scanner: async () => verdict({ action: "block", reasonCode: "restricted_content", matchedCategories: ["adult_nsfw"] }),
        logger: (event) => events.push(event),
      });
      reservationCalls += 1;
      providerCalls += 1;
      creditCalls += 1;
    },
    (error: unknown) => errorCode(error) === "CONTENT_SAFETY_BLOCKED" && (error as GenerationError).status === 403,
  );

  assert.equal(reservationCalls, 0);
  assert.equal(providerCalls, 0);
  assert.equal(creditCalls, 0);
  assert.equal(events[0].allowed, false);
  assert.deepEqual(events[0].categories, ["adult_nsfw"]);
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes("blocked prompt"), false);
  assert.equal(serialized.includes("IP"), false);
});

test("review verdicts are fail-closed before generation", async () => {
  await assert.rejects(
    assertPromptSafe("needs review", "it", {
      scanner: async () => verdict({ action: "review", reasonCode: "review_required" }),
      logger: () => undefined,
    }),
    (error: unknown) => errorCode(error) === "CONTENT_SAFETY_REVIEW" && (error as GenerationError).status === 403,
  );
});

test("scanner timeouts fail closed with a service-unavailable error", async () => {
  await assert.rejects(
    assertPromptSafe("slow prompt", "nl", {
      scanner: () => new Promise<never>(() => undefined),
      timeoutMs: 5,
      logger: () => undefined,
    }),
    (error: unknown) => errorCode(error) === "CONTENT_SAFETY_UNAVAILABLE" && (error as GenerationError).status === 503,
  );
});

test("malformed scanner verdicts fail closed and categories are allowlisted", async () => {
  const events: Record<string, unknown>[] = [];
  await assert.rejects(
    assertPromptSafe("malformed verdict", "en", {
      scanner: async () => verdict({
        action: "unexpected",
        reasonCode: "unsafe;drop logs",
        matchedCategories: ["adult_nsfw", "not-an-official-category", "csam_minor"],
      }),
      logger: (event) => events.push(event),
    }),
    (error: unknown) => errorCode(error) === "CONTENT_SAFETY_UNAVAILABLE" && (error as GenerationError).status === 503,
  );
  assert.equal(events[0].action, "unknown");
  assert.equal(events[0].reason, "unknown");
  assert.deepEqual(events[0].categories, ["adult_nsfw", "csam_minor"]);
});

test("locale resolution accepts only the four app locales and same-origin referers", () => {
  const cases: Array<[Request, ContentSafetyLocale]> = [
    [new Request("https://www.ovanto.ai/api/generate", { headers: { "x-ovanto-interface-locale": "fr" } }), "fr"],
    [new Request("https://www.ovanto.ai/api/generate", { headers: { "x-ovanto-interface-locale": "xx", referer: "https://www.ovanto.ai/it/" } }), "it"],
    [new Request("https://www.ovanto.ai/api/generate", { headers: { "x-ovanto-interface-locale": "xx", referer: "https://attacker.example/nl/" } }), "en"],
  ];
  for (const [request, expected] of cases) assert.equal(resolveContentSafetyLocale(request), expected);
});

test("proxy keeps the independent interface locale while deriving the SEO locale from the path", () => {
  const url = new URL("https://www.ovanto.ai/it/");
  const response = proxy({
    nextUrl: { hostname: url.hostname, origin: url.origin, pathname: url.pathname, search: url.search },
    headers: new Headers({ "x-ovanto-interface-locale": "fr" }),
  } as never) as Response;

  const forwarded = new Headers();
  const overrideHeaders = response.headers.get("x-middleware-override-headers");
  assert.ok(overrideHeaders?.includes("x-ovanto-interface-locale"));
  for (const [name, value] of response.headers) {
    if (name.startsWith("x-middleware-request-")) forwarded.set(name.slice("x-middleware-request-".length), value);
  }
  assert.equal(forwarded.get("x-ovanto-locale"), "it");
  assert.equal(forwarded.get("x-ovanto-interface-locale"), "fr");
  assert.equal(resolveContentSafetyLocale(new Request("https://www.ovanto.ai/api/generate", { headers: forwarded })), "fr");
});
