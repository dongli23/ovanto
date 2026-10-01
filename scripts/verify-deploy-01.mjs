import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRIVATE_ENV_NAMES } from "./audit-client-secrets.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const baseOrigin = new URL(base).origin;
const siteOrigin = "https://www.ovanto.ai";
const baselineCommit = "3277957";
const reportPath = path.resolve(repoRoot, process.env.OVANTO_REPORT_PATH || "docs/validation/deploy-01-local.json");
const cachePath = process.env.OVANTO_PAGE_CACHE ? path.resolve(process.env.OVANTO_PAGE_CACHE) : null;

const routePaths = [
  "/",
  "/it/",
  "/fr/",
  "/fr/photo-ia-gratuit",
  "/fr/modifier-photo-ia",
  "/nl/",
  "/nl/afbeeldingen-maken-met-ai",
];

const expectedModeByPath = {
  "/": "image",
  "/it/": "video",
  "/fr/": "video",
  "/fr/photo-ia-gratuit": "image",
  "/fr/modifier-photo-ia": "edit",
  "/nl/": "image",
  "/nl/afbeeldingen-maken-met-ai": "image",
};

const modeLabels = {
  en: { image: "Image", edit: "Edit", video: "Video" },
  it: { image: "Immagine", edit: "Modifica", video: "Video" },
  fr: { image: "Image", edit: "Modifier", video: "Vidéo" },
  nl: { image: "Afbeelding", edit: "Bewerken", video: "Video" },
};

const videoPriceTrustPoints = {
  en: "Video 5s from $0.99",
  it: "Video 5s da $0.99",
  fr: "Vidéo 5s à partir de 0,99 $",
  nl: "Video 5s vanaf $0.99",
};

const failures = [];
const pending = [];
const rows = [];
const check = (condition, label) => {
  if (!condition) failures.push(label);
};

const decode = (value) => String(value || "")
  .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
  .replace(/&(?:quot|ldquo|rdquo);/gi, '"')
  .replace(/&(?:#39|apos|lsquo|rsquo);/gi, "'")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ");

const text = (value) => decode(String(value || "")
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
  .replace(/<[^>]*>/g, "")
  .replace(/\s+/g, " ")
  .trim());

const attr = (tag, name) => {
  const match = String(tag || "").match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return decode(match?.[1] || "");
};

const tags = (html, name) => [...String(html).matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
const innerTags = (html, name) => [...String(html).matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi"))].map((match) => ({ tag: match[0], inner: match[1] }));
const hasClass = (tag, className) => attr(tag, "class").split(/\s+/).includes(className);
const trailingPath = (pathname) => pathname.endsWith("/") ? pathname : `${pathname}/`;
const stripTrailingPath = (pathname) => pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
const stripBodyScripts = (html) => String(html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
const hasOldHost = (value) => /https:\/\/ovanto\.ai\//i.test(String(value || ""));

async function loadCache() {
  if (!cachePath) return null;
  let parsed;
  try {
    parsed = JSON.parse(await readFile(cachePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read OVANTO_PAGE_CACHE ${cachePath}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`OVANTO_PAGE_CACHE must be an object keyed by pathname: ${cachePath}`);
  }
  return parsed;
}

async function buildModule(entryPoint, outfile) {
  await build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
  });
  return import(`${pathToFileURL(outfile).href}?cacheBust=${Date.now()}-${Math.random()}`);
}

async function loadCurrentSite() {
  return buildModule(path.join(repoRoot, "lib/site.ts"), path.join(repoRoot, ".test-build", "deploy-01-site.cjs"));
}

async function loadCurrentContent() {
  const module = await buildModule(path.join(repoRoot, "lib/content.ts"), path.join(repoRoot, ".test-build", "deploy-01-content.cjs"));
  return module.PAGE_CONTENT;
}

async function loadBaselineContent() {
  const baselineDir = path.join(repoRoot, ".test-build", "deploy-01-baseline");
  await mkdir(baselineDir, { recursive: true });
  const contentSource = execFileSync("git", ["show", `${baselineCommit}:lib/content.ts`], { cwd: repoRoot, encoding: "utf8" });
  const siteSource = execFileSync("git", ["show", `${baselineCommit}:lib/site.ts`], { cwd: repoRoot, encoding: "utf8" });
  await writeFile(path.join(baselineDir, "content.ts"), contentSource, "utf8");
  await writeFile(path.join(baselineDir, "site.ts"), siteSource, "utf8");
  const module = await buildModule(path.join(baselineDir, "content.ts"), path.join(repoRoot, ".test-build", "deploy-01-baseline-content.cjs"));
  return module.PAGE_CONTENT;
}

function contentCore(page) {
  return {
    key: page.key,
    locale: page.locale,
    path: page.path,
    title: page.title,
    description: page.description,
    h1: page.h1,
    h2s: page.h2s,
    toolKind: page.toolKind,
    isVideo: page.isVideo,
  };
}

function parseJsonLd(html) {
  const values = [];
  for (const entry of innerTags(html, "script")) {
    if (attr(entry.tag, "type").toLowerCase() !== "application/ld+json") continue;
    try {
      const value = JSON.parse(entry.inner);
      if (Array.isArray(value)) values.push(...value);
      else if (Array.isArray(value?.["@graph"])) values.push(...value["@graph"]);
      else values.push(value);
    } catch (error) {
      failures.push(`JSON-LD parse error: ${error.message}`);
    }
  }
  return values;
}

function parsePage(html) {
  const body = html.match(/<body\b[\s\S]*<\/body>/i)?.[0] || html;
  const visible = text(stripBodyScripts(body));
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  const descriptionTag = tags(html, "meta").find((tag) => attr(tag, "name").toLowerCase() === "description");
  const meta = (property) => tags(html, "meta").find((tag) => attr(tag, "property").toLowerCase() === property || attr(tag, "name").toLowerCase() === property);
  const links = tags(html, "link");
  const h1 = innerTags(html, "h1").map((entry) => text(entry.inner));
  const h2 = innerTags(html, "h2").map((entry) => text(entry.inner));
  const anchors = innerTags(body, "a").map((entry) => ({ href: attr(entry.tag, "href"), text: text(entry.inner), tag: entry.tag }));
  const buttons = innerTags(body, "button").map((entry) => ({ text: text(entry.inner), tag: entry.tag }));
  const modeLinks = anchors.filter((anchor) => hasClass(anchor.tag, "workbench-mode"));
  const modeButtons = buttons.filter((button) => hasClass(button.tag, "workbench-mode"));
  const toolsSummary = body.match(/<p\b[^>]*class=["'][^"']*\btools-summary\b[^"']*["'][\s\S]*?<\/p>/i)?.[0] || "";
  const toolsAnchors = innerTags(toolsSummary, "a").map((entry) => ({ href: attr(entry.tag, "href"), text: text(entry.inner) }));
  const uploads = tags(body, "input").filter((tag) => attr(tag, "type").toLowerCase() === "file");
  const quotaLabels = innerTags(body, "span").filter((entry) => hasClass(entry.tag, "quota-label")).map((entry) => text(entry.inner));
  const schemas = parseJsonLd(html);
  const faq = schemas.find((schema) => schema?.["@type"] === "FAQPage");
  const apps = schemas.filter((schema) => schema?.["@type"] === "WebApplication");
  return {
    body,
    visible,
    htmlLang: attr(htmlTag, "lang"),
    title: text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""),
    description: attr(descriptionTag, "content"),
    meta,
    canonical: links.filter((tag) => attr(tag, "rel").toLowerCase() === "canonical"),
    alternates: links.filter((tag) => attr(tag, "rel").toLowerCase() === "alternate"),
    h1,
    h2,
    anchors,
    buttons,
    modeLinks,
    modeButtons,
    toolsAnchors,
    uploads,
    quotaLabels,
    schemas,
    faq,
    apps,
  };
}

function header(response, name) {
  return response.headers.get(name) || "";
}

function contentType(response) {
  return header(response, "content-type");
}

async function responseFor(pathname, cache) {
  if (cache) {
    if (!Object.prototype.hasOwnProperty.call(cache, pathname)) {
      failures.push(`${pathname}: missing entry in OVANTO_PAGE_CACHE`);
      return null;
    }
    const entry = cache[pathname];
    if (!entry || typeof entry !== "object") {
      failures.push(`${pathname}: malformed OVANTO_PAGE_CACHE entry`);
      return null;
    }
    const headers = entry.headers && typeof entry.headers === "object" ? entry.headers : {};
    return new Response(typeof entry.body === "string" ? entry.body : String(entry.body || ""), {
      status: Number(entry.status),
      headers,
    });
  }
  try {
    return await fetch(new URL(pathname, base), {
      redirect: "manual",
      headers: { "x-ovanto-locale": "ru" },
    });
  } catch (error) {
    failures.push(`${pathname}: HTTP request failed (${error.message})`);
    return null;
  }
}

function expectedToolHrefs(site, locale) {
  if (locale === "fr") return [site.ROUTES.frGenerate, site.ROUTES.frEdit, site.ROUTES.fr];
  if (locale === "it") return [site.ROUTES.it];
  if (locale === "nl") return [site.ROUTES.nl];
  return [site.ROUTES.en];
}

function expectedModeHrefs(site, locale) {
  if (locale === "fr") {
    return [
      ["image", site.ROUTES.frGenerate],
      ["edit", site.ROUTES.frEdit],
      ["video", site.ROUTES.fr],
    ];
  }
  if (locale === "it") return [["video", site.ROUTES.it]];
  if (locale === "nl") return [["image", site.ROUTES.nl]];
  return [["image", site.ROUTES.en]];
}

function checkPaymentControls(parsed, label) {
  const paymentText = /(?:pricing|checkout|purchase|buy(?:\s+now)?|stripe|payment|credits|premium|tariff|prix|prezzo|acquista|acheter|aankoop|betaling)/i;
  check(!parsed.buttons.some((button) => paymentText.test(button.text)), `${label}: paid/checkout button exposed`);
  check(!parsed.anchors.some((anchor) => paymentText.test(anchor.href)), `${label}: paid/checkout link exposed`);
}

function checkPage(parsed, page, pathname, expectedCanonical, site) {
  const label = pathname;
  const canonicalHref = parsed.canonical.length === 1 ? attr(parsed.canonical[0], "href") : "";
  check(parsed.canonical.length === 1 && canonicalHref === expectedCanonical, `${label}: canonical`);
  check(canonicalHref.startsWith(`${siteOrigin}/`) && !hasOldHost(canonicalHref), `${label}: canonical www host`);
  check(parsed.alternates.length === 5, `${label}: five hreflangs`);
  const hreflangs = {
    en: site.ABSOLUTE_ROUTES.en,
    it: site.ABSOLUTE_ROUTES.it,
    fr: site.ABSOLUTE_ROUTES.fr,
    nl: site.ABSOLUTE_ROUTES.nl,
    "x-default": site.ABSOLUTE_ROUTES.en,
  };
  for (const [lang, href] of Object.entries(hreflangs)) {
    check(parsed.alternates.some((tag) => attr(tag, "hreflang").toLowerCase() === lang && attr(tag, "href") === href), `${label}: hreflang ${lang}`);
  }

  check(parsed.htmlLang === page.locale, `${label}: html lang`);
  check(parsed.title === page.title, `${label}: Title`);
  check(parsed.description === page.description, `${label}: Description`);
  check(parsed.h1.length === 1 && parsed.h1[0] === page.h1, `${label}: H1`);
  check(JSON.stringify(parsed.h2) === JSON.stringify(page.h2s), `${label}: H2 order`);
  check(attr(parsed.meta("og:url"), "content") === expectedCanonical, `${label}: og:url`);
  check(attr(parsed.meta("og:title"), "content") === page.title, `${label}: og:title`);
  check(attr(parsed.meta("og:description"), "content") === page.description, `${label}: og:description`);
  check(attr(parsed.meta("og:type"), "content") === "website", `${label}: og:type`);
  check(attr(parsed.meta("twitter:card"), "content") === "summary_large_image", `${label}: twitter:card`);
  check(attr(parsed.meta("twitter:title"), "content") === page.title, `${label}: twitter:title`);
  check(attr(parsed.meta("twitter:description"), "content") === page.description, `${label}: twitter:description`);
  for (const imageMeta of [parsed.meta("og:image"), parsed.meta("twitter:image")]) {
    const imageUrl = attr(imageMeta, "content");
    check(imageUrl.startsWith(`${siteOrigin}/`) && !hasOldHost(imageUrl), `${label}: social image www host`);
  }

  const expectedTools = expectedToolHrefs(site, page.locale);
  check(JSON.stringify(parsed.toolsAnchors.map((anchor) => anchor.href)) === JSON.stringify(expectedTools), `${label}: same-language tools summary mapping`);
  check(parsed.toolsAnchors.every((anchor) => Boolean(anchor.text) && !anchor.text.includes(anchor.href)), `${label}: natural tools summary anchors`);

  const expectedModes = expectedModeHrefs(site, page.locale);
  check(parsed.modeButtons.length === 0, `${label}: workbench uses no mode buttons`);
  check(parsed.modeLinks.length === expectedModes.length, `${label}: workbench mode link count`);
  check(JSON.stringify(parsed.modeLinks.map((anchor) => anchor.href)) === JSON.stringify(expectedModes.map(([, href]) => href)), `${label}: workbench mode routes`);
  check(parsed.modeLinks.filter((anchor) => attr(anchor.tag, "aria-current") === "page").length === 1, `${label}: one active mode aria-current`);
  check(parsed.modeLinks.every((anchor) => expectedModes.some(([kind, href]) => href === anchor.href && text(anchor.text) === modeLabels[page.locale][kind])), `${label}: workbench mode labels`);
  const activeMode = parsed.modeLinks.find((anchor) => attr(anchor.tag, "aria-current") === "page");
  check(activeMode?.href === expectedModes.find(([kind]) => kind === expectedModeByPath[page.path])?.[1], `${label}: default mode`);
  check(parsed.uploads.length === (expectedModeByPath[page.path] === "edit" ? 1 : 0), `${label}: editor-only upload input`);

  check(parsed.quotaLabels.length === 1, `${label}: quota label count`);
  check(/^Free\s*\([^)]*(?:\d+\s*\/\s*\d+|unknown)[^)]*\)$/i.test(parsed.quotaLabels[0] || ""), `${label}: quota label uses Free quota`);
  check(!/(?:unavailable|indisponible|indisponibile|niet beschikbaar|limit reached|limite atteinte|limite raggiunto|daglimiet)/i.test(parsed.quotaLabels[0] || ""), `${label}: quota label contains no error copy`);
  checkPaymentControls(parsed, label);

  const types = parsed.schemas.map((schema) => schema?.["@type"]).sort();
  const expectedTypes = (["/", "/it/", "/fr/", "/nl/"].includes(page.path) ? ["FAQPage", "WebApplication"] : ["FAQPage"]).sort();
  check(JSON.stringify(types) === JSON.stringify(expectedTypes), `${label}: JSON-LD types`);
  check(Boolean(parsed.faq), `${label}: FAQPage schema`);
  if (parsed.faq) {
    check(JSON.stringify(Object.keys(parsed.faq).sort()) === JSON.stringify(["@context", "@type", "mainEntity", "url"].sort()), `${label}: FAQPage structure`);
    check(parsed.faq.url === expectedCanonical, `${label}: FAQPage url`);
    check(Array.isArray(parsed.faq.mainEntity) && parsed.faq.mainEntity.length === page.faq.length, `${label}: FAQ count`);
    for (const [index, item] of (parsed.faq.mainEntity || []).entries()) {
      check(item?.["@type"] === "Question" && item.name === page.faq[index]?.question, `${label}: FAQ question ${index + 1}`);
      check(item?.acceptedAnswer?.["@type"] === "Answer" && item.acceptedAnswer.text === page.faq[index]?.answer, `${label}: FAQ answer ${index + 1}`);
      check(parsed.visible.includes(item?.acceptedAnswer?.text || "__missing_answer__"), `${label}: FAQ answer visible ${index + 1}`);
    }
  }
  if (expectedTypes.includes("WebApplication")) {
    const app = parsed.apps[0];
    check(Boolean(app), `${label}: WebApplication schema`);
    if (app) {
      check(JSON.stringify(Object.keys(app).sort()) === JSON.stringify(["@context", "@type", "applicationCategory", "browserRequirements", "description", "isAccessibleForFree", "name", "operatingSystem", "url"].sort()), `${label}: WebApplication structure`);
      check(app.url === expectedCanonical && app.name === "Ovanto" && app.applicationCategory === "MultimediaApplication", `${label}: WebApplication values`);
      check(!hasOldHost(JSON.stringify(app)), `${label}: WebApplication www host`);
    }
  }
  check(!parsed.schemas.some((schema) => schema?.["@type"] === "BreadcrumbList"), `${label}: unexpected BreadcrumbList`);

  if (page.isVideo) {
    check(parsed.visible.includes(videoPriceTrustPoints[page.locale]), `${label}: video price trust point`);
    check(!/(?:in futuro|à l’avenir|in the future|in future|toekomst|will be available|seront proposées)/i.test(parsed.visible), `${label}: future video pricing wording`);
    const answers = page.faq.map((item) => item.answer);
    check(new Set(answers).size === answers.length, `${label}: FAQ answers are unique`);
    const freeQuota = /(?:\b[13]\b\s*(?:video|vidéo)|(?:free|gratis|gratuit).*(?:day|giorno|jour|dag)|(?:quota|limite|limit|allowance))/i;
    const paidPrice = /(?:\$0\.99|0,99|paid|payant|pagamento|betaald|à partir)/i;
    check(freeQuota.test(page.faq[2]?.answer || "") && paidPrice.test(page.faq[2]?.answer || ""), `${label}: third FAQ includes free quota and paid price`);
  }
}

async function main() {
  const [site, current, baseline, cache] = await Promise.all([
    loadCurrentSite(),
    loadCurrentContent(),
    loadBaselineContent(),
    loadCache(),
  ]);
  const source = cache ? "captured HTTP cache" : "actual HTTP";
  const expectedCanonical = (pathname) => site.canonicalUrl(pathname);
  const pageByPath = new Map(Object.values(current).map((page) => [page.path, page]));
  const baselineKeys = Object.keys(baseline).sort();
  const currentKeys = Object.keys(current).sort();
  check(JSON.stringify(currentKeys) === JSON.stringify(baselineKeys), "PAGE_CONTENT keys changed");
  check(JSON.stringify([...pageByPath.keys()].sort()) === JSON.stringify([...routePaths].sort()), "page paths changed");
  for (const key of baselineKeys) {
    check(Boolean(current[key]), `${key}: page definition missing`);
    if (current[key]) check(JSON.stringify(contentCore(current[key])) === JSON.stringify(contentCore(baseline[key])), `${key}: protected page definition changed`);
  }

  const responseCache = new Map();
  const responseForCached = async (pathname) => {
    if (!responseCache.has(pathname)) responseCache.set(pathname, await responseFor(pathname, cache));
    return responseCache.get(pathname);
  };

  for (const pathname of routePaths) {
    const page = pageByPath.get(pathname);
    if (!page) continue;
    const canonical = expectedCanonical(pathname);
    const canonicalPathname = new URL(canonical).pathname;
    const alternatePathname = pathname === "/" ? null : canonicalPathname.endsWith("/") ? stripTrailingPath(canonicalPathname) : trailingPath(canonicalPathname);
    const variants = alternatePathname ? [canonicalPathname, alternatePathname] : [canonicalPathname];
    const parsedVariants = [];
    for (const variant of variants) {
      const response = await responseForCached(variant);
      if (!response) continue;
      const location = header(response, "location");
      const isCanonical = variant === canonicalPathname;
      if (isCanonical) {
        check(response.status === 200, `${variant}: canonical route HTTP 200`);
        check(!location, `${variant}: canonical route has no redirect`);
      } else if (canonicalPathname.endsWith("/")) {
        if (response.status === 301 || response.status === 308) {
          check(new URL(location, new URL(variant, base)).href === canonical, `${variant}: redirect to canonical trailing URL`);
        } else {
          check(response.status === 200 && !location, `${variant}: slash variant status`);
          if (response.status === 200 && !location && ["/fr/photo-ia-gratuit", "/fr/modifier-photo-ia", "/nl/afbeeldingen-maken-met-ai"].includes(stripTrailingPath(variant))) {
            pending.push(`${variant}: trailing-slash normalization pending; canonicalUrl currently ends with /`);
          }
        }
      } else {
        check(response.status === 301 || response.status === 308, `${variant}: redirect to non-trailing canonical`);
        check(new URL(location, new URL(variant, base)).href === canonical, `${variant}: redirect Location`);
      }
      if (response.status === 200) {
        const renderedHtml = await response.text();
        for (const privateName of PRIVATE_ENV_NAMES) {
          check(!renderedHtml.includes(privateName), `${pathname}: private env name in HTML/Flight payload: ${privateName}`);
        }
        const parsed = parsePage(renderedHtml);
        parsedVariants.push({ variant, parsed });
        checkPage(parsed, page, variant, canonical, site);
        if (new URL(base).hostname.toLowerCase() === "www.ovanto.ai") {
          check(!/\bnoindex\b/i.test(attr(parsed.meta("robots"), "content")), `${variant}: formal host has no noindex metadata`);
          check(!/noindex/i.test(header(response, "x-robots-tag")), `${variant}: formal host has no noindex header`);
        }
      }
    }
    if (parsedVariants.length > 1) {
      const identity = ({ parsed }) => JSON.stringify({
        htmlLang: parsed.htmlLang,
        title: parsed.title,
        description: parsed.description,
        h1: parsed.h1,
        h2: parsed.h2,
        canonical: parsed.canonical.map((tag) => attr(tag, "href")),
        alternates: parsed.alternates.map((tag) => [attr(tag, "hreflang"), attr(tag, "href")]),
      });
      check(identity(parsedVariants[0]) === identity(parsedVariants[1]), `${pathname}: slash variants differ in SSR identity`);
    }
    rows.push({ path: pathname, canonical, mode: expectedModeByPath[pathname], status: 200, source });
  }

  const robots = await responseForCached("/robots.txt");
  if (robots) {
    const body = await robots.text();
    check(robots.status === 200, "/robots.txt: HTTP 200");
    check(/^User-agent:\s*\*\s*$/im.test(body), "/robots.txt: User-agent");
    check(/^Allow:\s*\/\s*$/im.test(body), "/robots.txt: Allow");
    check(body.includes(`Sitemap: ${siteOrigin}/sitemap.xml`), "/robots.txt: www sitemap");
    check(!/vercel\.app|https:\/\/ovanto\.ai\//i.test(body), "/robots.txt: preview/naked host");
  }

  const sitemap = await responseForCached("/sitemap.xml");
  if (sitemap) {
    const body = await sitemap.text();
    const locs = [...body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decode(match[1].trim()));
    const sitemapUrls = routePaths.map((pathname) => expectedCanonical(pathname));
    check(sitemap.status === 200, "/sitemap.xml: HTTP 200");
    check(/(?:application|text)\/xml/i.test(contentType(sitemap)), "/sitemap.xml: XML content type");
    check(JSON.stringify(locs) === JSON.stringify(sitemapUrls), "/sitemap.xml: exact seven current www URLs");
    check(locs.every((url) => url.startsWith(`${siteOrigin}/`) && !/vercel\.app|\/api\/|\/test/i.test(url)), "/sitemap.xml: no preview/API/test URL");
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  const passed = failures.length === 0 && pending.length === 0;
  await writeFile(reportPath, JSON.stringify({
    checkedAt: new Date().toISOString(),
    base,
    source,
    cachePath,
    baselineCommit,
    passed,
    pending,
    failures,
    pages: rows,
  }, null, 2) + "\n", "utf8");
  console.table(rows);
  if (pending.length) console.error(pending.map((item) => `PENDING ${item}`).join("\n"));
  if (failures.length) console.error(failures.map((failure) => `FAIL ${failure}`).join("\n"));
  if (passed) console.log(`Deploy-01 verification passed (${source}; ${base}). Report: ${path.relative(repoRoot, reportPath)}`);
  else process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
