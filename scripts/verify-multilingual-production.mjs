import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const origin = process.env.OVANTO_UI_TEST_BASE_URL ?? "https://www.ovanto.ai";
const base = new URL(origin);
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("HTTPS required");
mkdirSync(".test-build", { recursive: true });
const bundlePath = path.resolve(".test-build/locale-registry.cjs");
buildSync({ entryPoints: ["lib/site.ts"], bundle: true, platform: "node", format: "cjs", outfile: bundlePath, logLevel: "silent" });
const { TOOL_ROUTES, PUBLIC_HTML_ROUTES, SUPPORTED_LOCALES, canonicalUrl } = createRequire(import.meta.url)(bundlePath);
const entries = Object.entries(TOOL_ROUTES).flatMap(([locale, routes]) => Object.entries(routes).map(([kind, route]) => ({ locale, kind, route })));
const result = { origin: base.origin, checkedAt: new Date().toISOString(), pages: [], catalogPricingConsistent: false, sitemapComplete: false, sitemapUrlCount: 0, newGenerationCreated: false };

// Public GETs only. No owner cookie, account token, provider key or mutation.
for (const entry of entries) {
  const response = await fetch(new URL(entry.route, base), { redirect: "error", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, entry.route);
  const html = await response.text();
  assert.match(html, new RegExp(`<html[^>]*lang="${entry.locale}"`), entry.route);
  assert.ok(html.includes(`rel="canonical" href="${canonicalUrl(entry.route)}"`), `canonical ${entry.route}`);
  const modes = html.match(/<nav\b[^>]*class="workbench-modes"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(modes, `modes ${entry.route}`);
  assert.equal((modes.match(/<a\b/g) ?? []).length, 3, entry.route);
  for (const tool of ["image", "video", "edit"]) assert.ok(modes.includes(`href="${TOOL_ROUTES[entry.locale][tool]}"`), `${entry.route}: ${tool}`);
  for (const locale of SUPPORTED_LOCALES) assert.ok(html.includes(`hrefLang="${locale}" href="${canonicalUrl(TOOL_ROUTES[locale][entry.kind])}"`) || html.includes(`hreflang="${locale}" href="${canonicalUrl(TOOL_ROUTES[locale][entry.kind])}"`), `${entry.route}: alternate ${locale}`);
  for (const id of ["ai-tools", "ai-models", "inspiration", "core-benefits", "how-it-works", "advanced-features", "faq"]) assert.ok(html.includes(`id="${id}"`), `${entry.route}: ${id}`);
  const modelSection = html.match(/<section\b[^>]*id="ai-models"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(modelSection, `${entry.route}: ai-models section missing`);
  if (entry.kind === "image") {
    assert.ok(modelSection.includes("Flux Schnell"), `${entry.route}: image model must be Flux Schnell`);
  } else if (entry.kind === "video") {
    assert.ok(modelSection.includes("Wan 2.5"), `${entry.route}: video page must mention Wan 2.5`);
    assert.ok(modelSection.includes("Kling 2.5 Turbo Pro"), `${entry.route}: video page must mention Kling 2.5 Turbo Pro`);
    assert.ok(!modelSection.includes("Flux Schnell"), `${entry.route}: video page must not mention Flux Schnell`);
  } else {
    assert.ok(modelSection.includes("Flux Kontext Dev"), `${entry.route}: edit page must mention Flux Kontext Dev`);
    assert.ok(!modelSection.includes("Flux Schnell"), `${entry.route}: edit page must not mention Flux Schnell`);
  }
  result.pages.push({ ...entry, status: response.status, consistent: true });
}

// The retired Dutch keyword landing page must resolve in one permanent hop,
// for both URL forms, while preserving campaign query parameters.
for (const path of ["/nl/afbeeldingen-maken-met-ai", "/nl/afbeeldingen-maken-met-ai/"]) {
  const query = "?utm_source=legacy";
  const response = await fetch(new URL(`${path}${query}`, base), { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 301, `legacy redirect ${path}`);
  const location = response.headers.get("location");
  assert.ok(location, `legacy location missing ${path}`);
  const actual = new URL(location, response.url);
  const expected = new URL(`/nl/${query}`, response.url);
  assert.equal(actual.origin, expected.origin, `legacy origin ${path}`);
  assert.equal(actual.pathname, expected.pathname, `legacy path ${path}`);
  assert.equal(actual.search, expected.search, `legacy query ${path}`);
}
const sitemapResponse = await fetch(new URL("/sitemap.xml", base));
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, 15, "sitemap must contain exactly 15 canonical URLs");
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "sitemap must not contain duplicate URLs");
for (const pathname of PUBLIC_HTML_ROUTES) assert.ok(sitemapUrls.includes(canonicalUrl(pathname)), `sitemap ${pathname}`);
assert.ok(!sitemapUrls.includes(canonicalUrl("/nl/afbeeldingen-maken-met-ai/")), "legacy Dutch image route must not be in sitemap");
result.sitemapUrlCount = sitemapUrls.length;
result.sitemapComplete = true;
const catalogResponse = await fetch(new URL("/api/waffo/catalog", base));
assert.equal(catalogResponse.status, 200);
const catalog = await catalogResponse.json();
const pricingResponse = await fetch(new URL("/pricing/", base));
assert.equal(pricingResponse.status, 200);
const pricing = await pricingResponse.text();
assert.ok(pricing.includes(catalog.enabled === true ? "Ovanto Pro Video Pack is available for purchase." : "Ovanto Pro Video Pack is not yet available for purchase."));
if (catalog.enabled === true) {
  for (const workspace of ["/video/", "/it/", "/fr/", "/nl/ai-video-maken/"]) {
    assert.ok(pricing.includes(`href="${workspace}"`), `pricing missing video workspace link ${workspace}`);
  }
  assert.ok(!pricing.includes("through the English video workspace"), "pricing contains the retired English-only workspace copy");
}
result.catalogPricingConsistent = true;
writeFileSync(".test-build/multilingual-http-verification.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
