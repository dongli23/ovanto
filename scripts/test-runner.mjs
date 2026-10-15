import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, ".test-build");
mkdirSync(outDir, { recursive: true });

const routeStateFile = path.join(root, "tests", "content-safety-route-state.ts").replaceAll("\\", "/");
const routeStateModule = "ovanto-content-safety-route-state";
const routeStateImport = JSON.stringify(routeStateModule);
const routeMockNamespace = "ovanto-content-safety-route-mock";
const routeMockModules = new Map([
  ["next/headers", `export async function cookies() { return {}; }`],
  [path.join(root, "lib/generation/identity.ts"), `
    const identity = { ip: "203.0.113.8", country: "US", ownerId: "owner-route-test", ipHash: "hash-route-test" };
    export function assertSameSiteOrigin() {}
    export function assertFreeRegion() {}
    export function getDailyIdentity() { return identity; }
  `],
  [path.join(root, "lib/generation/http.ts"), `
    export function assertGenerationConfig() {}
    export function noStoreJson(body, status) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
    export function publicJob(job, remaining) { return { id: job.id, status: job.status, remaining }; }
  `],
  [path.join(root, "lib/generation/config.ts"), `
    export const MAX_GENERATION_BODY_BYTES = 16 * 1024;
    export const MAX_PROMPT_LENGTH = 2_000;
    export const MAX_VIDEO_PROMPT_LENGTH = 1_500;
    export const MAX_TURNSTILE_TOKEN_LENGTH = 4_096;
    export function isGenerationKind(value) { return value === "image" || value === "edit" || value === "video"; }
    export function providerFor() { return { provider: "replicate" }; }
  `],
  [path.join(root, "lib/generation/redis.ts"), `
    import { routeTestState } from ${routeStateImport};
    export function getRedis() { routeTestState.redisCalls += 1; return {}; }
  `],
  [path.join(root, "lib/generation/turnstile.ts"), `
    import { routeTestState } from ${routeStateImport};
    export async function verifyTurnstile() { routeTestState.turnstileCalls += 1; }
  `],
  [path.join(root, "lib/generation/store.ts"), `
    import { routeTestState } from ${routeStateImport};
    export function inputHash() { return "route-test-input-hash"; }
    export async function reserveGeneration() {
      routeTestState.reserveCalls += 1;
      return { state: "new", remaining: routeTestState.freeQuota, job: { id: "650e8400-e29b-41d4-a716-446655440000", status: "pending" } };
    }
    export async function releaseReservation() { routeTestState.releaseCalls += 1; }
    export async function updateJob() { routeTestState.updateCalls += 1; }
    export async function recordGenerationAudit() { routeTestState.auditCalls += 1; }
  `],
  [path.join(root, "lib/generation/provider.ts"), `
    import { routeTestState } from ${routeStateImport};
    export class ProviderRejectedError extends Error {}
    export class ProviderUnavailableError extends Error {}
    export class ProviderProtocolError extends Error {}
    export async function submitGeneration() {
      routeTestState.providerCalls += 1;
      return { requestId: "route-test-provider-request", statusUrl: "https://provider.invalid/status", responseUrl: "https://provider.invalid/result", model: "route-test-model" };
    }
  `],
  [path.join(root, "lib/accounts/store.ts"), `export async function getPaidSession() { return { accountId: "account-route-test", scopeOrderId: "scope-route-test" }; }`],
  [path.join(root, "lib/accounts/db.ts"), `export function getAccountDb() { return {}; }`],
  [path.join(root, "lib/generation/asset.ts"), `export async function getOwnedValidatedAsset() { return { url: "https://provider.invalid/source" }; }`],
  [path.join(root, "lib/payments/errors.ts"), `
    export class PaymentError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
    export function assertSessionConfiguration() {}
    export function noStore(body, status) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
    export function paymentResponse() { return Response.json({ error: { code: "PAYMENT_ERROR" } }, { status: 503 }); }
  `],
  [path.join(root, "lib/payments/store.ts"), `
    import { routeTestState } from ${routeStateImport};
    export async function balancesFor() { routeTestState.balancesCalls += 1; return { image: routeTestState.paidBalance, video: routeTestState.paidBalance, edit: routeTestState.paidBalance }; }
  `],
  [path.join(root, "lib/paid-generation/service.ts"), `
    import { routeTestState } from ${routeStateImport};
    export async function startPaidGeneration() {
      routeTestState.startPaidCalls += 1;
      routeTestState.providerCalls += 1;
      return { state: "new", job: { id: "750e8400-e29b-41d4-a716-446655440000", status: "processing" } };
    }
    export function publicPaidJob(job, remaining) { return { id: job.id, status: job.status, remaining }; }
  `],
  [path.join(root, "lib/payments/waffo.ts"), `
    import { routeTestState } from ${routeStateImport};
    export function getWaffo() {
      return { contentSafety: { scanPrompt: async (params) => {
        routeTestState.scanCalls += 1;
        routeTestState.lastScanParams = params;
        if (routeTestState.scanError) throw new Error("mock safety service error");
        return routeTestState.verdict;
      } } };
    }
  `],
]);

function routeMockCandidates(resolveDir, specifier) {
  const resolved = path.resolve(resolveDir, specifier);
  return [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.mjs`];
}

const contentSafetyRouteMocks = {
  name: "content-safety-route-mocks",
  setup(build) {
    build.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "next/headers", namespace: routeMockNamespace }));
    build.onResolve({ filter: /^ovanto-content-safety-route-state$/ }, () => ({ path: routeStateFile }));
    build.onResolve({ filter: /.*/ }, (args) => {
      const match = routeMockCandidates(args.resolveDir || root, args.path).find((candidate) => routeMockModules.has(candidate));
      return match ? { path: match, namespace: routeMockNamespace } : undefined;
    });
    build.onLoad({ filter: /.*/, namespace: routeMockNamespace }, (args) => ({
      contents: routeMockModules.get(args.path),
      loader: "ts",
    }));
  },
};

const entries = [
  [path.join(root, "tests", "multilingual-routes.test.ts"), "multilingual-routes.test.cjs"],
  [path.join(root, "tests", "lua-reservation.test.cjs"), "lua-reservation.test.cjs"],
  [path.join(root, "tests", "generation.test.ts"), "generation.test.cjs"],
  [path.join(root, "tests", "generation-payload.test.ts"), "generation-payload.test.cjs"],
  [path.join(root, "tests", "seo-url.test.ts"), "seo-url.test.cjs"],
  [path.join(root, "tests", "multilingual-routes.test.ts"), "multilingual-routes.test.cjs"],
  [path.join(root, "tests", "generation-poll-route.test.ts"), "generation-poll-route.test.cjs"],
  [path.join(root, "tests", "generation-stale.test.ts"), "generation-stale.test.cjs"],
  [path.join(root, "tests", "content-safety.test.ts"), "content-safety.test.cjs"],
  [path.join(root, "tests", "content-safety-routes.test.ts"), "content-safety-routes.test.cjs", [contentSafetyRouteMocks]],
  [path.join(root, "tests", "generation-download.test.ts"), "generation-download.test.cjs"],
  [path.join(root, "tests", "payments.test.ts"), "payments.test.cjs"],
  [path.join(root, "tests", "payment-sql.test.ts"), "payment-sql.test.cjs"],
  [path.join(root, "tests", "database-tls.test.ts"), "database-tls.test.cjs"],
  [path.join(root, "tests", "paid-generation.test.ts"), "paid-generation.test.cjs"],
  [path.join(root, "tests", "deploy-contract.test.ts"), "deploy-contract.test.cjs"],
  [path.join(root, "tests", "deploy-providers.test.ts"), "deploy-providers.test.cjs"],
  [path.join(root, "tests", "deploy-redis.test.ts"), "deploy-redis.test.cjs"],
];
const outputs = [];
for (const [entry, name, plugins] of entries) {
  const outfile = path.join(outDir, name);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins,
    sourcemap: false,
    logLevel: "silent",
  });
  if (!existsSync(outfile)) throw new Error(`Test bundle was not created: ${name}`);
  outputs.push(outfile);
}

const result = spawnSync(process.execPath, ["--test", ...outputs], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
