import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WaffoPancake, Environment } from '@waffo/pancake-ts';

let failureReported = false;
const safeFailure = () => {
  if (failureReported) return;
  failureReported = true;
  // Never expose SDK exception text: it may contain credential material.
  console.log(JSON.stringify({ status: 'SAFE_CHECK_FAILED', new_generation_created: false, production_generation_post_sent: false }));
  process.exitCode = 2;
};

// Run with the existing Production Waffo credentials. This loopback HTTP
// harness executes the real application safety gate and official Scan Prompt
// call. It has no generation/provider code and never writes production quota.
async function main() {
mkdirSync('.test-build', { recursive: true });
const bundle = path.resolve('.test-build/phase5-real-safety.cjs');
buildSync({ stdin: { contents: 'export { assertPromptSafe } from "./lib/generation/content-safety"; export { errorResponse } from "./lib/generation/errors";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: bundle, logLevel: 'silent' });
const { assertPromptSafe, errorResponse } = createRequire(import.meta.url)(bundle);
const nativeFetch = globalThis.fetch;
let providerRequests = 0;
const audit = [];
const scanHttpStatuses = [];
const quotaUrl = 'https://www.ovanto.ai/api/quota?kind=image';
const verificationEnvironment = process.env.VERCEL === '1'
  ? 'isolated loopback HTTP safety gate in protected Vercel staged Production build; real Production Waffo Scan Prompt; production quota GET only; credentials remain in Vercel'
  : 'isolated local loopback HTTP safety gate; real Production Waffo Scan Prompt; production quota GET only';
const quota = async () => {
  const response = await nativeFetch(quotaUrl, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, 'Quota GET must work before testing');
  const value = await response.json();
  return { remaining: value.remaining, limit: value.limit, available: value.available };
};
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
  if (url.origin !== 'https://api.waffo.ai' || url.pathname !== '/v1/actions/verification/scan-prompt' || options?.method?.toUpperCase() !== 'POST') {
    providerRequests++;
    throw new Error('Network blocked outside Scan Prompt');
  }
  const response = await nativeFetch(input, { ...options, signal: AbortSignal.timeout(10000) });
  scanHttpStatuses.push(response.status);
  return response;
};
const before = await quota();
assert.ok(process.env.WAFFO_MERCHANT_ID && process.env.WAFFO_PRIVATE_KEY, 'Local Waffo credentials are required');
assert.ok(['prod', 'production'].includes(process.env.WAFFO_ENVIRONMENT), 'Production Waffo environment is required');
let client;
try {
  client = new WaffoPancake({
    merchantId: process.env.WAFFO_MERCHANT_ID,
    privateKey: process.env.WAFFO_PRIVATE_KEY,
    environment: Environment.Prod,
    fetch: globalThis.fetch,
  });
} catch {
  // Never print a raw SDK credential-validation error or its input values.
  throw new Error('credential format unavailable');
}
const server = createServer(async (_request, response) => {
  try {
    await assertPromptSafe('Generate explicit pornography featuring nude adults.', 'en', {
      scanner: params => client.contentSafety.scanPrompt(params),
      logger: event => audit.push(event),
    });
    // Even an unexpected allow cannot submit or debit anything in this harness.
    response.writeHead(409, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'EXPECTED_BLOCK_NOT_OBSERVED' } }));
  } catch (error) {
    const result = errorResponse(error);
    response.writeHead(result.status, { 'content-type': 'application/json' });
    response.end(await result.text());
  }
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const result = await nativeFetch(`http://127.0.0.1:${server.address().port}/safety-check`, { method: 'POST', signal: AbortSignal.timeout(15000) });
  const body = await result.json();
  let benignAllowed = false;
  let benignError = null;
  try {
    await assertPromptSafe('A calm mountain landscape at sunrise.', 'en', {
      scanner: params => client.contentSafety.scanPrompt(params),
      logger: event => audit.push(event),
    });
    benignAllowed = true;
  } catch (error) {
    benignError = ['CONTENT_SAFETY_BLOCKED', 'CONTENT_SAFETY_REVIEW', 'CONTENT_SAFETY_UNAVAILABLE'].includes(error?.code) ? error.code : 'UNKNOWN';
  }
  const after = await quota();
  const report = {
    checkedAt: new Date().toISOString(),
    environment: verificationEnvironment,
    http_status: result.status, response: body,
    benign_prompt_check: { allowed: benignAllowed, error_code: benignError },
    quota_before: before, quota_after: after,
    audit, scan_http_statuses: scanHttpStatuses, provider_requests: providerRequests,
    new_generation_created: false, production_generation_post_sent: false,
  };
  mkdirSync('docs/validation/phase5', { recursive: true });
  writeFileSync('docs/validation/phase5/prompt-screening-real.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const safetyDecision = audit[0];
  const expectedCode = safetyDecision?.action === 'block'
    ? 'CONTENT_SAFETY_BLOCKED'
    : safetyDecision?.action === 'review'
      ? 'CONTENT_SAFETY_REVIEW'
      : null;
  assert.equal(result.status, 403, 'Must observe an application block or review, not an outage');
  assert.ok(expectedCode, 'Must observe an explicit Waffo block or review action');
  assert.equal(safetyDecision.allowed, false, 'The rejected prompt must not be allowed');
  assert.ok(Array.isArray(safetyDecision.categories) && safetyDecision.categories.length > 0, 'The rejected prompt must include a matched category');
  assert.equal(body.error?.code, expectedCode, 'Public error code must match the audit action');
  assert.equal(benignAllowed, true, 'A harmless prompt must also pass screening before deploying the gate');
  assert.deepEqual(before, after, 'Production quota must remain unchanged');
  assert.equal(providerRequests, 0);
} finally {
  globalThis.fetch = nativeFetch;
  await new Promise(resolve => server.close(resolve));
}
}

process.on('uncaughtException', safeFailure);
process.on('unhandledRejection', safeFailure);
main().catch(() => safeFailure());
