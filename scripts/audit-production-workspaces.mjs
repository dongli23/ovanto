import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

// Isolated browser contexts, real read-only APIs. Never submit a generation,
// verification token, purchase or provider request during this audit.
const base = process.env.OVANTO_UI_TEST_BASE_URL ?? 'https://www.ovanto.ai';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const path of ['/it/', '/video/', '/fr/', '/nl/ai-video-maken/', '/', '/nl/']) {
    const context = await browser.newContext();
    const blocked = [];
    const responses = [];
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method()) || /(?:api\.replicate\.com|queue\.fal\.run|fal\.run)$/.test(url.hostname)) {
        blocked.push({ method: request.method(), host: url.hostname, path: url.pathname });
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    const reads = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname === '/api/quota' || url.pathname === '/api/account/session') {
        reads.push((async () => {
          const body = await response.json().catch(() => ({}));
          responses.push({ path: url.pathname, kind: url.searchParams.get('kind'), status: response.status(), ...(url.pathname === '/api/quota' ? { remaining: body.remaining, limit: body.limit, available: body.available, code: body.code ?? body.error?.code } : { authenticated: body.authenticated }) });
        })());
      }
    });
    const document = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /\d+\/\d+/.test(document.querySelector('.quota-label')?.textContent ?? ''), { timeout: 20000 });
    await Promise.all(reads);
    const result = { path, document_status: document.status(), quota: await page.locator('.quota-label').textContent(), settings: await page.locator('.workbench-settings').textContent(), selected_tier: await page.locator('.paid-tier.is-selected').allTextContents(), responses, blocked_mutations: blocked.length };
    assert.equal(result.document_status, 200, path);
    const quota = responses.find(item => item.path === '/api/quota');
    assert.equal(quota?.status, 200, path);
    assert.equal(quota?.available, true, path);
    assert.ok(result.quota.includes(`${quota.remaining}/${quota.limit}`), path);
    assert.ok(result.settings.includes(quota.kind === 'video' ? 'Wan 2.5' : 'Flux Schnell'), path);
    assert.equal(blocked.length, 0, 'Audit must not trigger mutation attempts');
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
  mkdirSync('.test-build', { recursive: true });
  writeFileSync('.test-build/production-workspace-audit.json', JSON.stringify({ checkedAt: new Date().toISOString(), origin: base, results, newGenerationCreated: false }, null, 2));
} finally {
  await browser.close();
}
