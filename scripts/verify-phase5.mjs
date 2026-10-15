import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const origin = process.env.OVANTO_UI_TEST_BASE_URL ?? "https://www.ovanto.ai";
const base = new URL(origin.endsWith("/") ? origin : `${origin}/`);
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
  throw new Error("OVANTO_UI_TEST_BASE_URL must use HTTPS unless it points to localhost");
}

mkdirSync(".test-build", { recursive: true });
const bundlePath = path.resolve(".test-build/phase5-site-registry.cjs");
buildSync({
  entryPoints: ["lib/site.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: bundlePath,
  logLevel: "silent",
});
const { PUBLIC_HTML_ROUTES, SUPPORTED_LOCALES, TOOL_ROUTES, canonicalUrl } = createRequire(import.meta.url)(bundlePath);
const toolEntries = Object.entries(TOOL_ROUTES).flatMap(([locale, routes]) =>
  Object.entries(routes).map(([kind, route]) => ({ locale, kind, route })),
);

const expectedFooterAup = {
  en: "Acceptable use",
  it: "Uso accettabile",
  fr: "Utilisation acceptable",
  nl: "Aanvaardbaar gebruik",
};
const report = {
  checkedAt: new Date().toISOString(),
  origin: base.origin,
  methodPolicy: "GET only",
  cookiesSent: false,
  mutationRequests: 0,
  publicRouteCount: PUBLIC_HTML_ROUTES.length,
  pages: [],
  checks: [],
  sitemap: null,
};
const failures = [];

function check(name, pass, details = {}) {
  const item = { name, pass: Boolean(pass), ...details };
  report.checks.push(item);
  if (!pass) failures.push(item);
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function visibleText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? null;
}

function anchors(fragment) {
  const values = [];
  for (const match of fragment.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = match[0];
    const href = attr(tag, "href");
    if (href) values.push({ href: decodeHtml(href), text: visibleText(tag.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, "")) });
  }
  return values;
}

function elementByClass(html, tag, className) {
  return html.match(new RegExp(`<${tag}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1] ?? "";
}

function elementById(html, id) {
  return html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</\\1>`, "i"))?.[2] ?? "";
}

function elementRecordById(html, id) {
  const match = html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</\\1>`, "i"));
  if (!match) return null;
  return {
    lang: attr(match[0].slice(0, match[0].indexOf(">") + 1), "lang"),
    text: visibleText(match[2]),
  };
}

function parsePage(html) {
  const title = visibleText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const h1 = visibleText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const canonical = attr(html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] ?? "", "href");
  const alternates = {};
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if ((attr(tag, "rel") ?? "").toLowerCase() !== "alternate") continue;
    const lang = (attr(tag, "hreflang") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (lang && href) alternates[lang] = decodeHtml(href);
  }
  const jsonLd = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonLd.push(JSON.parse(match[1]));
    } catch {
      jsonLd.push({ invalid: true });
    }
  }
  const summary = anchors(elementByClass(html, "p", "tools-summary"));
  const context = anchors(elementByClass(html, "nav", "context-links"));
  const footerAup = anchors(html).find((link) => new URL(link.href, base).pathname === "/aup/");
  return {
    title,
    ogTitle: decodeHtml(attr(html.match(/<meta\b[^>]*property=["']og:title["'][^>]*>/i)?.[0] ?? "", "content") ?? ""),
    h1,
    canonical,
    alternates,
    jsonLdTypes: jsonLd.flatMap((item) => Array.isArray(item) ? item.map((entry) => entry?.["@type"]) : [item?.["@type"]]).filter(Boolean),
    summaryLinks: summary.map((link) => new URL(link.href, base).pathname),
    contextLinks: context.map((link) => new URL(link.href, base).pathname),
    footerAup: footerAup ? { href: footerAup.href, text: footerAup.text } : null,
  };
}

async function getPage(pathname) {
  try {
    const response = await fetch(new URL(pathname, base), {
      method: "GET",
      redirect: "error",
      headers: { accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(30_000),
    });
    const html = await response.text();
    return { status: response.status, html, data: parsePage(html) };
  } catch (error) {
    return { status: null, html: "", data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

check("public route registry has 17 routes", PUBLIC_HTML_ROUTES.length === 17, { actual: PUBLIC_HTML_ROUTES.length });

const fetched = new Map();
for (const pathname of PUBLIC_HTML_ROUTES) {
  const response = await getPage(pathname);
  fetched.set(pathname, response);
  report.pages.push({ pathname, status: response.status, error: response.error, title: response.data?.title ?? null });
  check(`GET ${pathname}`, response.status === 200, { status: response.status, error: response.error });
}

for (const entry of toolEntries) {
  const response = fetched.get(entry.route);
  const data = response?.data;
  const expectedSummary = Object.values(TOOL_ROUTES[entry.locale]).sort();
  const actualSummary = [...(data?.summaryLinks ?? [])].sort();
  const expectedContext = Object.values(TOOL_ROUTES[entry.locale]).filter((route) => route !== entry.route);
  const contextSet = new Set(data?.contextLinks ?? []);
  check(`${entry.route}: tools-summary has three same-locale links`,
    actualSummary.length === 3 && JSON.stringify(actualSummary) === JSON.stringify(expectedSummary),
    { actual: data?.summaryLinks ?? [], expected: expectedSummary });
  check(`${entry.route}: context-links has same-locale tool links`,
    expectedContext.every((route) => contextSet.has(route)) && (data?.contextLinks?.length ?? 0) >= 2 &&
      (data?.contextLinks ?? []).every((route) => new Set([
        ...Object.values(TOOL_ROUTES[entry.locale]),
        ...(entry.locale === "fr" ? ["/fr/retouche-photo-ia/"] : []),
      ]).has(route)),
    { actual: data?.contextLinks ?? [], expectedAtLeast: expectedContext });
  check(`${entry.route}: localized AUP footer link`,
    data?.footerAup?.href === "/aup/" && data.footerAup.text === expectedFooterAup[entry.locale],
    { actual: data?.footerAup ?? null, expected: { href: "/aup/", text: expectedFooterAup[entry.locale] } });
}

const retouch = fetched.get("/fr/retouche-photo-ia/")?.data;
const modifier = fetched.get("/fr/modifier-photo-ia/")?.data;
const retouchAlternates = {
  en: canonicalUrl("/edit/"),
  it: canonicalUrl("/it/modifica-foto-ai/"),
  fr: canonicalUrl("/fr/retouche-photo-ia/"),
  nl: canonicalUrl("/nl/foto-bewerken-ai/"),
  "x-default": canonicalUrl("/edit/"),
};
check("A1 retouche title is at most 60 characters", (retouch?.title?.length ?? 0) > 0 && (retouch?.title?.length ?? 61) <= 60, { actualLength: retouch?.title?.length ?? null });
check("A1 retouche H1 is distinct from modifier page", Boolean(retouch?.h1) && retouch?.h1 !== modifier?.h1, { retoucheH1: retouch?.h1 ?? null, modifierH1: modifier?.h1 ?? null });
check("A1 retouche canonical", retouch?.canonical === canonicalUrl("/fr/retouche-photo-ia/"), { actual: retouch?.canonical ?? null });
check("A1 retouche has exactly the required hreflangs", JSON.stringify(retouch?.alternates ?? {}) === JSON.stringify(retouchAlternates), { actual: retouch?.alternates ?? {}, expected: retouchAlternates });
check("A1 retouche includes WebApplication and FAQPage JSON-LD", retouch?.jsonLdTypes?.includes("WebApplication") && retouch?.jsonLdTypes?.includes("FAQPage"), { actual: retouch?.jsonLdTypes ?? [] });

const homepage = fetched.get("/")?.data;
check("B2 homepage title retains both keywords within 60 characters", Boolean(homepage?.title) && homepage.title.length <= 60 && /free ai image generator/i.test(homepage.title) && /no sign up/i.test(homepage.title), { title: homepage?.title, length: homepage?.title?.length });
check("B2 homepage og:title matches the concise title", homepage?.ogTitle === homepage?.title, { title: homepage?.title, ogTitle: homepage?.ogTitle });

const aup = fetched.get("/aup/")?.html ?? "";
const aupSections = ["content-standards", "moderation", "reporting", "enforcement"];
check("A2 AUP contains all four required sections", aupSections.every((id) => Boolean(elementById(aup, id))), { sections: aupSections.filter((id) => Boolean(elementById(aup, id))) });
check("A2 AUP exposes the reporting mailbox", aup.includes("mailto:hello@ovanto.ai"), {});

const terms = fetched.get("/terms/")?.html ?? "";
const termsLocales = ["en", "it", "fr", "nl"];
report.compliance = { terms: { contentSafety: {}, refundProcess: {} } };
for (const locale of termsLocales) {
  const safety = elementRecordById(terms, `content-safety-${locale}`);
  const refund = elementRecordById(terms, `refund-process-${locale}`);
  report.compliance.terms.contentSafety[locale] = safety ?? { lang: null, text: "" };
  report.compliance.terms.refundProcess[locale] = refund ?? { lang: null, text: "" };
  check(`C2 content-safety-${locale} exists with lang`, Boolean(safety) && safety.lang === locale, { lang: safety?.lang ?? null });
  check(`C2 refund-process-${locale} exists with lang`, Boolean(refund) && refund.lang === locale, { lang: refund?.lang ?? null });
}
check("C2 terms states screening before provider submission", termsLocales.every((locale) => report.compliance.terms.contentSafety[locale].text.length > 100), {});
check("C2 terms exposes refund policy and points to mandatory consumer rights", terms.includes('id="refunds"') && terms.includes('href="#consumer-rights"'), {});

try {
  const response = await fetch(new URL("/sitemap.xml", base), { method: "GET", redirect: "error", signal: AbortSignal.timeout(30_000) });
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = PUBLIC_HTML_ROUTES.map((pathname) => canonicalUrl(pathname));
  report.sitemap = { status: response.status, count: urls.length, urls };
  check("sitemap contains all 17 canonical URLs", response.status === 200 && urls.length === 17 && expected.every((url) => urls.includes(url)) && !urls.some((url) => url.includes("afbeeldingen-maken-met-ai")), { actualCount: urls.length, expectedCount: 17 });
} catch (error) {
  report.sitemap = { status: null, error: error instanceof Error ? error.message : String(error) };
  check("sitemap contains all 17 canonical URLs", false, { error: report.sitemap.error });
}

check("no API mutation was requested", report.mutationRequests === 0, { mutationRequests: report.mutationRequests });

const outputPath = "docs/validation/phase5/after-public.json";
mkdirSync(path.dirname(outputPath), { recursive: true });
report.pass = failures.length === 0;
report.failures = failures;
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, pass: report.pass, failedChecks: failures.length, publicRouteCount: report.publicRouteCount }, null, 2));
if (!report.pass) process.exitCode = 1;
