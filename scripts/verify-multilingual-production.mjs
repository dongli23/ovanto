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
const { TOOL_ROUTES, SUPPORTED_LOCALES, canonicalUrl } = createRequire(import.meta.url)(bundlePath);
const entries = Object.entries(TOOL_ROUTES).flatMap(([locale, routes]) => Object.entries(routes).map(([kind, route]) => ({ locale, kind, route })));
entries.push({ locale: "nl", kind: "image", route: "/nl/afbeeldingen-maken-met-ai/" });
const result = { origin: base.origin, checkedAt: new Date().toISOString(), pages: [], catalogPricingConsistent: false, sitemapComplete: false, newGenerationCreated: false };

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
  result.pages.push({ ...entry, status: response.status, consistent: true });
}
const sitemapResponse = await fetch(new URL("/sitemap.xml", base));
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
for (const entry of entries) assert.ok(sitemap.includes(canonicalUrl(entry.route)), `sitemap ${entry.route}`);
result.sitemapComplete = true;
const catalogResponse = await fetch(new URL("/api/waffo/catalog", base));
assert.equal(catalogResponse.status, 200);
const catalog = await catalogResponse.json();
const pricingResponse = await fetch(new URL("/pricing/", base));
assert.equal(pricingResponse.status, 200);
const pricing = await pricingResponse.text();
assert.ok(pricing.includes(catalog.enabled === true ? "Ovanto Pro Video Pack is available for purchase." : "Ovanto Pro Video Pack is not yet available for purchase."));
result.catalogPricingConsistent = true;
writeFileSync(".test-build/multilingual-http-verification.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
