import { build, transform } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const baseOrigin = new URL(base).origin;
const baselineCommit = "6210ea612a57695cb4aa2721ef77c6245950c369";
const siteOrigin = "https://www.ovanto.ai";
const reportPath = path.resolve(repoRoot, process.env.OVANTO_REPORT_PATH || "docs/validation/seo-hardening.json");
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
const sitemapUrls = routePaths.map((pathname) => `${siteOrigin}${pathname.endsWith("/") ? pathname : `${pathname}/`}`);
const hreflangs = {
  en: `${siteOrigin}/`,
  it: `${siteOrigin}/it/`,
  fr: `${siteOrigin}/fr/`,
  nl: `${siteOrigin}/nl/`,
  "x-default": `${siteOrigin}/`,
};
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
const toolLinks = [
  "/",
  "/fr/modifier-photo-ia",
  "/it/",
];
const oldRootEditFaqPhrase = /download the finished file without uploading an image/i;

const failures = [];
const rows = [];
const check = (condition, label) => {
  if (!condition) failures.push(label);
};

const decode = (value) => String(value)
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
const trailingPath = (pathname) => pathname.endsWith("/") ? pathname : `${pathname}/`;
const expectedCanonical = (pathname) => `${siteOrigin}${trailingPath(pathname)}`;
const stripBodyScripts = (html) => String(html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
const hasOldHost = (value) => String(value || "").includes("https://ovanto.ai/");

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

async function loadBaselineContent() {
  const source = execFileSync("git", ["show", `${baselineCommit}:lib/content.ts`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const { code } = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)).PAGE_CONTENT;
}

async function loadCurrentContent() {
  const outfile = path.join(repoRoot, ".test-build", "content-seo-hardening.cjs");
  await build({
    entryPoints: [path.join(repoRoot, "lib/content.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
  });
  return (await import(`${pathToFileURL(outfile).href}?cacheBust=${Date.now()}`)).PAGE_CONTENT;
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
    extraLinks: page.extraLinks,
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

function schemaUrlValues(value, key = "", values = []) {
  if (Array.isArray(value)) {
    for (const child of value) schemaUrlValues(child, key, values);
  } else if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) schemaUrlValues(child, childKey, values);
  } else if (typeof value === "string" && ["url", "item", "@id"].includes(key)) {
    values.push(value);
  }
  return values;
}

function parsePage(html, page, pathname) {
  const body = html.match(/<body\b[\s\S]*<\/body>/i)?.[0] || html;
  const visible = text(stripBodyScripts(body));
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  const title = text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const descriptionTag = tags(html, "meta").find((tag) => attr(tag, "name").toLowerCase() === "description");
  const meta = (property) => tags(html, "meta").find((tag) => attr(tag, "property").toLowerCase() === property || attr(tag, "name").toLowerCase() === property);
  const links = tags(html, "link");
  const canonical = links.filter((tag) => attr(tag, "rel").toLowerCase() === "canonical");
  const alternates = links.filter((tag) => attr(tag, "rel").toLowerCase() === "alternate");
  const h1 = innerTags(html, "h1").map((entry) => text(entry.inner));
  const h2 = innerTags(html, "h2").map((entry) => text(entry.inner));
  const anchors = innerTags(body, "a").map((entry) => ({ href: attr(entry.tag, "href"), text: text(entry.inner) }));
  const modeButtons = innerTags(body, "button")
    .filter((entry) => attr(entry.tag, "class").split(/\s+/).includes("workbench-mode"))
    .map((entry) => ({ current: attr(entry.tag, "aria-current"), text: text(entry.inner) }));
  const toolsSection = body.match(/<section\b[^>]*class=["'][^"']*\btools-section\b[^"']*["'][\s\S]*?<\/section>/i)?.[0] || "";
  const toolsAnchors = innerTags(toolsSection, "a").map((entry) => ({ href: attr(entry.tag, "href"), text: text(entry.inner) }));
  const uploads = tags(body, "input").filter((tag) => attr(tag, "type").toLowerCase() === "file");
  const schemas = parseJsonLd(html);
  const faq = schemas.find((schema) => schema?.["@type"] === "FAQPage");
  const apps = schemas.filter((schema) => schema?.["@type"] === "WebApplication");
  const breadcrumbs = schemas.filter((schema) => schema?.["@type"] === "BreadcrumbList");
  return {
    body,
    visible,
    htmlLang: attr(htmlTag, "lang"),
    title,
    description: attr(descriptionTag, "content"),
    meta,
    canonical,
    alternates,
    h1,
    h2,
    anchors,
    modeButtons,
    toolsAnchors,
    uploads,
    schemas,
    faq,
    apps,
    breadcrumbs,
    pathname,
  };
}

async function main() {
  const [baseline, current, cache] = await Promise.all([
    loadBaselineContent(),
    loadCurrentContent(),
    loadCache(),
  ]);
  const source = cache ? "captured HTTP cache" : "actual HTTP";
  const fetchOrigin = new URL(base).origin;

  const baselineKeys = Object.keys(baseline).sort();
  const currentKeys = Object.keys(current).sort();
  check(JSON.stringify(currentKeys) === JSON.stringify(baselineKeys), "PAGE_CONTENT keys changed");
  const pagesByPath = new Map(Object.values(current).map((page) => [page.path, page]));
  check(JSON.stringify([...pagesByPath.keys()].sort()) === JSON.stringify([...routePaths].sort()), "page paths changed");

  for (const key of baselineKeys) {
    const before = baseline[key];
    const page = current[key];
    if (!page) {
      failures.push(`missing page definition: ${key}`);
      continue;
    }
    check(JSON.stringify(contentCore(page)) === JSON.stringify(contentCore(before)), `${key}: protected page definition changed`);
    check(page.url === expectedCanonical(page.path), `${page.path}: content URL must be the www trailing-slash canonical`);
    const questionsMatch = JSON.stringify(page.faq.map((item) => item.question)) === JSON.stringify(before.faq.map((item) => item.question));
    check(questionsMatch, `${page.path}: FAQ questions changed`);
    if (key === "en") {
      check(page.faq[0].answer === before.faq[0].answer, `${page.path}: first FAQ answer changed`);
      check(page.faq[2].answer === before.faq[2].answer, `${page.path}: third FAQ answer changed`);
      check(!oldRootEditFaqPhrase.test(page.faq[1].answer), `${page.path}: edit-only FAQ phrase remains`);
    } else {
      check(JSON.stringify(page.faq) === JSON.stringify(before.faq), `${page.path}: non-root FAQ changed`);
    }
  }

  async function responseFor(pathname) {
    if (cache && fetchOrigin === baseOrigin) {
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

  const parsedPages = new Map();
  for (const pathname of routePaths) {
    const page = pagesByPath.get(pathname);
    if (!page) continue;
    const variants = pathname === "/"
      ? [pathname]
      : [...new Set([pathname.replace(/\/+$/, ""), trailingPath(pathname)])];
    const parsedVariants = [];
    for (const variant of variants) {
      const response = await responseFor(variant);
      if (!response) continue;
      const html = await response.text();
      const parsed = parsePage(html, page, variant);
      parsedVariants.push(parsed);
      const label = `${pathname} (${variant})`;
      check(response.status === 200, `${label}: HTTP 200`);
      check(response.headers.get("location") === null, `${label}: no redirect`);
      if (new URL(base).hostname.toLowerCase() === "www.ovanto.ai") {
        check(response.headers.get("x-robots-tag") === null, `${label}: formal host has no noindex header`);
        check(!/\bnoindex\b/i.test(attr(parsed.meta("robots"), "content")), `${label}: formal host has no noindex metadata`);
      }
      check(parsed.htmlLang === page.locale, `${label}: SSR lang`);
      check(parsed.title === page.title, `${label}: Title`);
      check(parsed.description === page.description, `${label}: Description`);
      check(parsed.h1.length === 1 && parsed.h1[0] === page.h1, `${label}: H1`);
      check(JSON.stringify(parsed.h2) === JSON.stringify(page.h2s), `${label}: H2 order`);

      const canonicalHref = parsed.canonical.length === 1 ? attr(parsed.canonical[0], "href") : "";
      check(parsed.canonical.length === 1 && canonicalHref === expectedCanonical(pathname), `${label}: canonical`);
      check(parsed.alternates.length === 5, `${label}: five hreflangs`);
      for (const [lang, href] of Object.entries(hreflangs)) {
        check(parsed.alternates.some((tag) => attr(tag, "hreflang").toLowerCase() === lang && attr(tag, "href") === href), `${label}: hreflang ${lang}`);
      }

      const ogUrl = attr(parsed.meta("og:url"), "content");
      check(ogUrl === expectedCanonical(pathname), `${label}: og:url`);
      check(attr(parsed.meta("og:title"), "content") === page.title, `${label}: og:title`);
      check(attr(parsed.meta("og:description"), "content") === page.description, `${label}: og:description`);
      check(attr(parsed.meta("og:type"), "content") === "website", `${label}: og:type`);
      check(attr(parsed.meta("twitter:card"), "content") === "summary_large_image", `${label}: twitter:card`);
      check(attr(parsed.meta("twitter:title"), "content") === page.title, `${label}: twitter:title`);
      check(attr(parsed.meta("twitter:description"), "content") === page.description, `${label}: twitter:description`);
      for (const imageMeta of [parsed.meta("og:image"), parsed.meta("twitter:image")]) {
        const imageUrl = attr(imageMeta, "content");
        check(imageUrl.startsWith(`${siteOrigin}/`), `${label}: absolute www social image`);
        check(!hasOldHost(imageUrl), `${label}: old naked social image host`);
      }
      for (const metadataValue of [canonicalHref, ogUrl, ...parsed.alternates.map((tag) => attr(tag, "href"))]) {
        check(!hasOldHost(metadataValue), `${label}: old naked metadata host`);
      }

      const expectedMode = expectedModeByPath[pathname];
      const modeSet = new Set(Object.values(modeLabels[page.locale]));
      check(parsed.modeButtons.length === 3, `${label}: three workbench mode buttons`);
      check(parsed.modeButtons.filter((button) => button.current === "page").length === 1, `${label}: one active mode aria-current`);
      check(parsed.modeButtons.every((button) => modeSet.has(button.text)), `${label}: complete mode labels`);
      check(parsed.modeButtons.find((button) => button.current === "page")?.text === modeLabels[page.locale][expectedMode], `${label}: default mode`);
      const expectedUploads = expectedMode === "edit" ? 1 : 0;
      check(parsed.uploads.length === expectedUploads, `${label}: editor-only upload input`);
      check(parsed.anchors.filter((anchor) => anchor.href.startsWith("/") && !anchor.href.startsWith("//")).length <= 13, `${label}: internal link count <= 13`);

      const languagePaths = ["/", "/it/", "/fr/", "/nl/"];
      for (const languagePath of languagePaths) {
        check(parsed.anchors.filter((anchor) => anchor.href === languagePath).length >= 2, `${label}: language link ${languagePath} retained`);
      }
      for (const link of page.extraLinks || []) {
        check(parsed.anchors.some((anchor) => anchor.href === link.href && anchor.text === link.label), `${label}: legacy extra link ${link.href}`);
      }
      for (const toolHref of toolLinks) {
        const toolAnchor = parsed.toolsAnchors.find((anchor) => anchor.href === toolHref);
        check(Boolean(toolAnchor), `${label}: tools summary link ${toolHref}`);
        check(Boolean(toolAnchor?.text && !toolAnchor.text.includes(toolHref) && /[\p{L}]/u.test(toolAnchor.text)), `${label}: natural anchor ${toolHref}`);
      }
      if (expectedMode === "video") {
        check(/0[.,]99/.test(parsed.visible), `${label}: video price expectation`);
        check(/480\s*p/i.test(parsed.visible), `${label}: video 480p expectation`);
        check(/5\s*(?:s|sec(?:ond)?(?:es|i)?|secondes?|secondi)/i.test(parsed.visible), `${label}: video 5-second expectation`);
        check(!/(?:checkout|purchase now|buy now|acheter maintenant|acquista ora|pagamento|paiement|pagamento)/i.test(parsed.visible), `${label}: unfinished payment CTA`);
      }
      const buttonTexts = innerTags(parsed.body, "button").map((entry) => text(entry.inner));
      check(!buttonTexts.some((buttonText) => /(?:pricing|tariff|checkout|purchase|buy now|credits|premium|prix|prezzo|acquista|acheter|aankoop)/i.test(buttonText)), `${label}: pricing button exposed`);

      const schemas = parsed.schemas;
      const faq = parsed.faq;
      check(Boolean(faq), `${label}: FAQPage schema`);
      if (faq) {
        check(JSON.stringify(Object.keys(faq).sort()) === JSON.stringify(["@context", "@type", "mainEntity", "url"].sort()), `${label}: FAQPage schema scope`);
        check(faq.url === expectedCanonical(pathname), `${label}: FAQPage url`);
        check(Array.isArray(faq.mainEntity) && faq.mainEntity.length === 3, `${label}: FAQPage question count`);
        for (const [index, item] of (faq.mainEntity || []).entries()) {
          check(item?.["@type"] === "Question" && item.name === page.faq[index]?.question, `${label}: FAQ question ${index + 1}`);
          check(item?.acceptedAnswer?.["@type"] === "Answer" && item.acceptedAnswer.text === page.faq[index]?.answer, `${label}: FAQ answer ${index + 1}`);
          check(parsed.visible.includes(item?.acceptedAnswer?.text || "__missing_answer__"), `${label}: FAQ answer visible ${index + 1}`);
        }
      }
      const expectedAppCount = ["/", "/it/", "/fr/", "/nl/"].includes(pathname) ? 1 : 0;
      check(parsed.apps.length === expectedAppCount, `${label}: WebApplication scope`);
      for (const app of parsed.apps) {
        check(app.url === expectedCanonical(pathname), `${label}: WebApplication url`);
        check(!hasOldHost(JSON.stringify(app)), `${label}: WebApplication old host`);
      }
      // The current site has no BreadcrumbList schema. Keep this scope explicit so
      // the hardening check does not silently grow structured data on its own.
      check(parsed.breadcrumbs.length === 0, `${label}: BreadcrumbList scope`);
      if (parsed.breadcrumbs[0]) {
        const breadcrumbUrls = schemaUrlValues(parsed.breadcrumbs[0]);
        check(breadcrumbUrls.length > 0, `${label}: Breadcrumb URLs`);
        check(breadcrumbUrls.every((value) => value.startsWith(`${siteOrigin}/`)), `${label}: Breadcrumb www URLs`);
        check(breadcrumbUrls.includes(expectedCanonical(pathname)), `${label}: Breadcrumb current URL`);
        check(!hasOldHost(JSON.stringify(parsed.breadcrumbs[0])), `${label}: Breadcrumb old host`);
      }
      check(!oldRootEditFaqPhrase.test(pathname === "/" ? parsed.visible : ""), `${label}: root edit-only FAQ phrase`);

    }
    if (parsedVariants.length > 1) {
      const [first, second] = parsedVariants;
      const identity = (parsed) => JSON.stringify({
        htmlLang: parsed.htmlLang,
        title: parsed.title,
        description: parsed.description,
        h1: parsed.h1,
        h2: parsed.h2,
        canonical: parsed.canonical.map((tag) => attr(tag, "href")),
        alternates: parsed.alternates.map((tag) => [attr(tag, "hreflang"), attr(tag, "href")]),
        ogUrl: attr(parsed.meta("og:url"), "content"),
        schemas: parsed.schemas,
      });
      check(identity(first) === identity(second), `${pathname}: slash variants differ in SEO identity`);
    }
    if (parsedVariants[0]) {
      parsedPages.set(pathname, parsedVariants[0]);
      rows.push({
        path: pathname,
        mode: expectedModeByPath[pathname],
        status: 200,
        trailingSlashCanonical: expectedCanonical(pathname),
        internalLinks: parsedVariants[0].anchors.filter((anchor) => anchor.href.startsWith("/") && !anchor.href.startsWith("//")).length,
        source,
      });
    }
  }

  const robots = await responseFor("/robots.txt");
  if (robots) {
    const body = await robots.text();
    const contentType = robots.headers.get("content-type") || "";
    check(robots.status === 200, "/robots.txt: HTTP 200");
    check(/text\/plain/i.test(contentType), "/robots.txt: text/plain content type");
    check(/^User-agent:\s*\*\s*$/im.test(body), "/robots.txt: User-agent");
    check(/^Allow:\s*\/\s*$/im.test(body), "/robots.txt: Allow");
    check(body.includes(`Sitemap: ${siteOrigin}/sitemap.xml`), "/robots.txt: www sitemap");
    check(!/https?:\/\/(?:[^\s/]+\.)?vercel\.app|https:\/\/ovanto\.ai\//i.test(body), "/robots.txt: preview or naked host");
  }

  const sitemap = await responseFor("/sitemap.xml");
  if (sitemap) {
    const body = await sitemap.text();
    const contentType = sitemap.headers.get("content-type") || "";
    const locs = [...body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decode(match[1].trim()));
    check(sitemap.status === 200, "/sitemap.xml: HTTP 200");
    check(/(?:application|text)\/xml/i.test(contentType), "/sitemap.xml: XML content type");
    check(JSON.stringify(locs) === JSON.stringify(sitemapUrls), "/sitemap.xml: exact seven www URLs");
    check(locs.every((url) => url.startsWith(`${siteOrigin}/`) && !/vercel\.app|\/api\/|\/test/i.test(url)), "/sitemap.xml: no preview/API/test URL");
  }

  const proxyOut = path.join(repoRoot, ".test-build", "proxy-seo-hardening.cjs");
  await build({
    entryPoints: [path.join(repoRoot, "proxy.ts")],
    outfile: proxyOut,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
  });
  const previousVercelEnv = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    const productionProxy = (await import(`${pathToFileURL(proxyOut).href}?production=${Date.now()}`)).proxy;
    for (const [hostname, expected] of [["www.ovanto.ai", null], ["ovanto.vercel.app", "noindex, nofollow"]]) {
      const response = productionProxy({ nextUrl: { hostname, pathname: "/" }, headers: new Headers() });
      check(response.headers.get("x-robots-tag") === expected, `${hostname}: production index policy`);
    }
    process.env.VERCEL_ENV = "preview";
    const previewProxy = (await import(`${pathToFileURL(proxyOut).href}?preview=${Date.now()}`)).proxy;
    for (const hostname of ["preview.ovanto.ai", "ovanto-preview.vercel.app", "ovanto.vercel.app"]) {
      const response = previewProxy({ nextUrl: { hostname, pathname: "/" }, headers: new Headers() });
      check(response.headers.get("x-robots-tag") === "noindex, nofollow", `${hostname}: preview index policy`);
    }
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({
    checkedAt: new Date().toISOString(),
    base,
    source,
    cachePath,
    baselineCommit,
    passed: failures.length === 0,
    pages: rows,
    failures,
  }, null, 2) + "\n");
  console.table(rows);
  if (failures.length) {
    console.error(failures.map((failure) => `FAIL ${failure}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`SEO hardening passed (${source}; ${base}). Report: ${path.relative(repoRoot, reportPath)}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
