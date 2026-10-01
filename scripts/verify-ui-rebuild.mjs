import { build, transform } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const base = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const baselineCommit = '8bc8a0394b956e25528a8b39c7fe4442f9d48ac5';
const moduleFrom = async (source) => {
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
};
const baseline = (await moduleFrom(execFileSync('git', ['show', `${baselineCommit}:lib/content.ts`], { encoding: 'utf8' }))).PAGE_CONTENT;
const current = (await moduleFrom(await readFile(new URL('../lib/content.ts', import.meta.url), 'utf8'))).PAGE_CONTENT;
const decode = (s) => s.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, h, d) => String.fromCodePoint(parseInt(h || d, h ? 16 : 10))).replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const text = (s) => decode(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] || '');
const failures = [], rows = [], pages = new Map();
const check = (ok, label) => { if (!ok) failures.push(label); };
const protectedFields = ['key', 'locale', 'path', 'url', 'title', 'description', 'h1', 'h2s', 'extraLinks'];
const hreflangs = { en: 'https://ovanto.ai/', it: 'https://ovanto.ai/it/', fr: 'https://ovanto.ai/fr/', nl: 'https://ovanto.ai/nl/', 'x-default': 'https://ovanto.ai/' };
for (const [key, page] of Object.entries(current)) {
  for (const field of protectedFields) {
    try { assert.deepEqual(page[field], baseline[key][field]); }
    catch { failures.push(`${page.path}: protected ${field} changed`); }
  }
  check(JSON.stringify(page.faq.map(q => q.question)) === JSON.stringify(baseline[key].faq.map(q => q.question)), `${page.path}: FAQ questions unchanged`);
  const res = await fetch(base + page.path, { redirect: 'manual' });
  const html = await res.text();
  pages.set(page.path, html);
  const body = html.match(/<body\b[\s\S]*<\/body>/)?.[0] || '';
  const visible = text(body.replace(/<script\b[\s\S]*?<\/script>/g, ''));
  const c = (ok, label) => check(ok, `${page.path}: ${label}`);
  c(res.status === 200, 'HTTP 200');
  c(attr(html.match(/<html\b[^>]*>/)?.[0] || '', 'lang') === page.locale, 'SSR locale');
  c(text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '') === page.title, 'Title');
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map(m => m[0]);
  c(metas.some(t => attr(t, 'name') === 'description' && attr(t, 'content') === page.description), 'Description');
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  c(h1s.length === 1 && text(h1s[0][1]) === page.h1, 'H1');
  c(JSON.stringify([...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(m => text(m[1]))) === JSON.stringify(page.h2s), 'H2 order');
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map(m => m[0]);
  const canonicals = links.filter(t => attr(t, 'rel') === 'canonical');
  c(canonicals.length === 1 && attr(canonicals[0], 'href') === page.url, 'canonical');
  const alternates = links.filter(t => attr(t, 'rel') === 'alternate');
  c(alternates.length === 5 && Object.entries(hreflangs).every(([lang, href]) => alternates.some(t => attr(t, 'hreflang') === lang && attr(t, 'href') === href)), 'hreflang');
  const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const faq = schemas.find(s => s['@type'] === 'FAQPage');
  try { assert.deepEqual(faq, { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map(q => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })) }); }
  catch { failures.push(`${page.path}: FAQ structure changed`); }
  c(faq?.mainEntity.length === 3, 'FAQ schema shape');
  c((faq?.mainEntity || []).every((q, i) => q.name === page.faq[i].question && q.acceptedAnswer.text === page.faq[i].answer && visible.includes(q.acceptedAnswer.text)), 'FAQ visible/schema match');
  const app = schemas.filter(s => s['@type'] === 'WebApplication');
  c(app.length === Number(['en', 'it', 'fr', 'nl'].includes(key)), 'WebApplication scope');
  if (app[0]) {
    try { assert.deepEqual(app[0], { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Ovanto', url: page.url, applicationCategory: 'MultimediaApplication', operatingSystem: 'Web', browserRequirements: 'Requires a modern web browser', isAccessibleForFree: true, description: page.description }); }
    catch { failures.push(`${page.path}: WebApplication changed`); }
  }
  const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m => ({ href: attr(m[1], 'href'), text: text(m[2]) }));
  c(anchors.filter(a => a.href.startsWith('/')).length <= 10, 'internal link count');
  for (const link of page.extraLinks || []) c(anchors.some(a => a.href === link.href && a.text === link.label), `matrix link ${link.href}`);
  const uploads = [...body.matchAll(/<input\b[^>]*type="file"[^>]*>/g)];
  c(uploads.length === Number(key === 'frEdit'), 'upload only in editor');
  const expectedMode = ['it', 'fr'].includes(key) ? 'video' : key === 'frEdit' ? 'edit' : 'image';
  c(page.toolKind === expectedMode, 'correct mode');
  c(body.includes('workbench-grid') && body.includes('workbench-preview'), 'shared workbench');
  c(body.includes('prompt-example'), 'prompt examples');
  c(!/paid purchase is not yet available|achat payant n'est pas encore disponible|acquisto a pagamento non è ancora disponibile/i.test(visible), 'no unfinished paid copy');
  const words = (visible.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  rows.push({ path: page.path, status: res.status, mode: page.toolKind, uploads: uploads.length, words });
}
const brief = (await readFile(new URL('../docs/ovanto-brief-v4.txt', import.meta.url), 'utf8')).replace(/\r/g, '');
for (const line of brief.split('## 6.')[1].split('## 7.')[0].split('\n').filter(l => l.startsWith('| /'))) {
  const [from, to, label] = line.split('|').slice(1, 4).map(s => s.trim());
  const route = from.replace(' 页脚', '');
  const html = pages.get(route);
  const scoped = from.includes('页脚') ? html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0] || '' : html;
  check([...scoped.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].some(m => attr(m[1], 'href') === to && text(m[2]) === label), `${route}: exact matrix anchor ${label}`);
}
// Execute the request adapter without Next's page runtime to verify host-specific indexing.
const proxyBundle = path.resolve('.test-build/proxy-verify.cjs');
await build({ entryPoints: ['proxy.ts'], outfile: proxyBundle, bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
const { proxy } = await import(pathToFileURL(proxyBundle).href);
for (const [hostname, expected] of [['ovanto.vercel.app', 'noindex, nofollow'], ['ovanto-preview.vercel.app', 'noindex, nofollow'], ['ovanto.ai', null]]) {
  const response = proxy({ nextUrl: { hostname, pathname: '/' }, headers: new Headers() });
  check(response.headers.get('x-robots-tag') === expected, `${hostname}: index policy`);
}
await mkdir(new URL('../docs/validation/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/validation/ui-rebuild.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), base, baselineCommit, passed: !failures.length, pages: rows, failures, liveGeneration: 'Pending credentials; not tested' }, null, 2) + '\n');
console.table(rows);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('UI modes, protected SEO, FAQ consistency, link matrix and preview noindex passed.');
