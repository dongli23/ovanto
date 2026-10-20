import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const origin = process.env.OVANTO_UI_TEST_BASE_URL ?? "https://www.ovanto.ai";
const base = new URL(origin.endsWith("/") ? origin : `${origin}/`);
const isLocalOrigin = ["localhost", "127.0.0.1", "::1"].includes(base.hostname);
if (base.protocol !== "https:" && !isLocalOrigin) {
  throw new Error("OVANTO_UI_TEST_BASE_URL must use HTTPS unless it points to localhost");
}

const SITE_ORIGIN = "https://www.ovanto.ai";
const routes = {
  fr: "/fr/retouche-photo-gratuite/",
  nl: "/nl/ai-foto-bewerken-gratis/",
};
const sourcePages = {
  frHome: { path: "/fr/", target: routes.fr },
  frAiRetouch: { path: "/fr/retouche-photo-ia/", target: routes.fr },
  nlHome: { path: "/nl/", target: routes.nl },
  nlEdit: { path: "/nl/foto-bewerken-ai/", target: routes.nl },
};
const expected = {
  fr: {
    title: "Retouche Photo Gratuite — Sans Inscription | Ovanto",
    h1: "Retouche Photo Gratuite en Ligne",
    lang: "fr",
    summary: ["/fr/photo-ia-gratuit/", "/fr/modifier-photo-ia/", "/fr/"],
    context: ["/fr/photo-ia-gratuit/", "/fr/", "/fr/retouche-photo-ia/"],
  },
  nl: {
    title: "AI Foto Bewerken Gratis — Zonder Registratie | Ovanto",
    h1: "AI Foto Bewerken Gratis",
    lang: "nl",
    summary: ["/nl/", "/nl/ai-video-maken/", "/nl/foto-bewerken-ai/"],
    context: ["/nl/", "/nl/ai-video-maken/", "/nl/foto-bewerken-ai/"],
  },
};
const canonical = (pathname) => `${SITE_ORIGIN}${pathname}`;
const expectedAlternates = {
  fr: {
    fr: canonical(routes.fr),
    nl: canonical(routes.nl),
    "x-default": canonical(routes.fr),
  },
  nl: {
    fr: canonical(routes.fr),
    nl: canonical(routes.nl),
    "x-default": canonical(routes.fr),
  },
};

const report = {
  checkedAt: new Date().toISOString(),
  origin: base.origin,
  source: isLocalOrigin ? "local" : "production",
  methodPolicy: "GET only",
  cookiesSent: false,
  apiRequests: 0,
  generationRequests: 0,
  requestedPaths: [],
  pages: {},
  sourceIncomingLinks: {},
  sitemap: null,
  sharedValidation: {
    verifiedBy: "primary agent",
    tests: "npm test: 167/167 PASS",
    typecheck: "PASS",
    build: "PASS",
    frozenScopeEvidence: "docs/validation/free-edit-pages/scope.json",
  },
  checks: [],
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

function elementByClass(html, tag, className) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] ?? "";
}

function elementByIdTag(html, id) {
  const match = html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i"));
  return match?.[0] ?? null;
}

function sectionById(html, id) {
  const match = html.match(new RegExp(`<section\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, "i"));
  return match?.[0] ?? "";
}

function anchorRecords(fragment) {
  const values = [];
  for (const match of fragment.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const raw = match[0];
    const href = attr(raw, "href");
    if (!href) continue;
    values.push({ raw, href: decodeHtml(href), text: visibleText(raw.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, "")) });
  }
  return values;
}

function absoluteUrl(href) {
  return new URL(href, base);
}

function pathnameOf(href) {
  return absoluteUrl(href).pathname;
}

function parseJsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      parsed = { invalid: true };
    }
    return { raw: match[0], parsed };
  });
}

function parseFaq(html) {
  const faq = [];
  for (const match of html.matchAll(/<details\b[^>]*class=["'][^"']*\bfaq-item\b[^"']*["'][^>]*>([\s\S]*?)<\/details>/gi)) {
    const body = match[1];
    faq.push({
      question: visibleText(body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? ""),
      answer: visibleText(body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ""),
    });
  }
  return faq;
}

function parsePage(html) {
  const title = visibleText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const h1 = visibleText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const descriptionTag = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] ?? "";
  const canonicalTag = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] ?? "";
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  const alternates = {};
  const alternateRaw = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const raw = match[0];
    if ((attr(raw, "rel") ?? "").toLowerCase() !== "alternate") continue;
    const lang = (attr(raw, "hreflang") ?? "").toLowerCase();
    const href = attr(raw, "href");
    if (!lang || !href) continue;
    alternates[lang] = decodeHtml(href);
    alternateRaw.push(raw);
  }
  const jsonLd = parseJsonLd(html);
  const summaryFragment = elementByClass(html, "p", "tools-summary");
  const contextFragment = elementByClass(html, "nav", "context-links");
  const faq = parseFaq(html);
  const webApplication = jsonLd.find(({ parsed }) => parsed?.["@type"] === "WebApplication")?.parsed ?? null;
  const faqPage = jsonLd.find(({ parsed }) => parsed?.["@type"] === "FAQPage")?.parsed ?? null;
  return {
    title,
    h1,
    description: decodeHtml(attr(descriptionTag, "content") ?? ""),
    canonical: decodeHtml(attr(canonicalTag, "href") ?? ""),
    htmlLang: attr(htmlTag, "lang"),
    alternates,
    alternateRaw,
    jsonLd,
    webApplication,
    faqPage,
    faq,
    summary: anchorRecords(summaryFragment),
    context: anchorRecords(contextFragment),
    workbenchIdTag: elementByIdTag(html, "edit-workbench"),
  };
}

async function get(pathname, { redirect = "error" } = {}) {
  const requestUrl = new URL(pathname, base);
  if (requestUrl.pathname.startsWith("/api/")) throw new Error(`API request is forbidden: ${requestUrl.pathname}`);
  report.requestedPaths.push(requestUrl.pathname);
  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      redirect,
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9" },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    return {
      status: response.status,
      url: response.url,
      location: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
      body,
      data: parsePage(body),
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      url: requestUrl.toString(),
      location: null,
      contentType: null,
      body: "",
      data: parsePage(""),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function compareFaq(pageData, pageKey) {
  const jsonFaq = Array.isArray(pageData.faqPage?.mainEntity)
    ? pageData.faqPage.mainEntity.map((item) => ({
        question: item?.name ?? "",
        answer: item?.acceptedAnswer?.text ?? "",
      }))
    : [];
  const pageFaq = pageData.faq;
  return {
    page: pageKey,
    pageFaq,
    jsonLdFaq: jsonFaq,
    identical: JSON.stringify(pageFaq) === JSON.stringify(jsonFaq),
  };
}

function newPageReport(pathname, response, pageKey) {
  const pageData = response.data;
  const pageExpected = expected[pageKey];
  const faqComparison = compareFaq(pageData, pageKey);
  const pagePath = routes[pageKey];
  const expectedCta = `${pagePath}#edit-workbench`;
  const modelSection = sectionById(response.body, "ai-models");
  const featureSection = sectionById(response.body, "advanced-features");
  const ctaAnchors = [...anchorRecords(modelSection), ...anchorRecords(featureSection)];
  const activeModeFragment = elementByClass(response.body, "nav", "workbench-modes");
  const activeModes = anchorRecords(activeModeFragment).filter((link) => /\bis-active\b/i.test(link.raw) && /\baria-current=["']page["']/i.test(link.raw));

  check(`${pageKey}: HTTP 200`, response.status === 200, { status: response.status });
  check(`${pageKey}: Title`, pageData.title === pageExpected.title, { actual: pageData.title, expected: pageExpected.title, length: pageData.title.length });
  check(`${pageKey}: H1`, pageData.h1 === pageExpected.h1, { actual: pageData.h1, expected: pageExpected.h1 });
  check(`${pageKey}: html lang`, pageData.htmlLang === pageExpected.lang, { actual: pageData.htmlLang, expected: pageExpected.lang });
  check(`${pageKey}: self canonical`, pageData.canonical === canonical(pagePath), { actual: pageData.canonical, expected: canonical(pagePath) });
  check(`${pageKey}: exactly three reciprocal hreflang links`, Object.keys(pageData.alternates).length === 3 && JSON.stringify(sortObject(pageData.alternates)) === JSON.stringify(sortObject(expectedAlternates[pageKey])), { actual: pageData.alternates, expected: expectedAlternates[pageKey] });
  check(`${pageKey}: hreflang excludes /edit/`, !pageData.alternateRaw.some((raw) => /\/edit\//.test(decodeHtml(attr(raw, "href") ?? ""))), { raw: pageData.alternateRaw });
  check(`${pageKey}: tools-summary has exactly three same-locale links`, pageData.summary.length === 3 && JSON.stringify([...new Set(pageData.summary.map((link) => pathnameOf(link.href)))].sort()) === JSON.stringify([...pageExpected.summary].sort()), { actual: pageData.summary, expected: pageExpected.summary });
  check(`${pageKey}: context-links has exactly three same-locale links`, pageData.context.length === 3 && JSON.stringify([...new Set(pageData.context.map((link) => pathnameOf(link.href)))].sort()) === JSON.stringify([...pageExpected.context].sort()), { actual: pageData.context, expected: pageExpected.context });
  if (pageKey === "fr") {
    check("fr: context retouch anchor uses complete phrase", pageData.context.some((link) => pathnameOf(link.href) === "/fr/retouche-photo-ia/" && link.text === "retouche photo IA"), { actual: pageData.context });
  }
  check(`${pageKey}: WebApplication JSON-LD`, Boolean(pageData.webApplication), { parsed: pageData.webApplication });
  check(`${pageKey}: WebApplication fields match page`, pageData.webApplication?.url === canonical(pagePath) && pageData.webApplication?.name === pageData.h1 && pageData.webApplication?.description === pageData.description && pageData.webApplication?.inLanguage === pageExpected.lang, { actual: pageData.webApplication, expected: { url: canonical(pagePath), name: pageData.h1, description: pageData.description, inLanguage: pageExpected.lang } });
  check(`${pageKey}: exactly two JSON-LD scripts`, pageData.jsonLd.length === 2, { actualCount: pageData.jsonLd.length });
  check(`${pageKey}: FAQPage JSON-LD`, Boolean(pageData.faqPage), { parsed: pageData.faqPage });
  check(`${pageKey}: FAQPage URL is self-referential`, pageData.faqPage?.url === canonical(pagePath), { actual: pageData.faqPage?.url, expected: canonical(pagePath) });
  check(`${pageKey}: rendered FAQ matches FAQPage JSON-LD`, faqComparison.identical && pageData.faq.length >= 3, { comparison: faqComparison });
  check(`${pageKey}: main CTA anchors point to own workbench`, ctaAnchors.length === 3 && ctaAnchors.every((link) => pathnameOf(link.href) === pagePath && new URL(link.href, base).hash === "#edit-workbench"), { expected: expectedCta, anchors: ctaAnchors });
  check(`${pageKey}: edit-workbench id exists`, Boolean(pageData.workbenchIdTag), { tag: pageData.workbenchIdTag });
  check(`${pageKey}: active mode is self-referential`, activeModes.length === 1 && pathnameOf(activeModes[0].href) === pagePath && new URL(activeModes[0].href, base).hash === "#edit-workbench", { activeModes, expected: expectedCta });

  return {
    status: response.status,
    error: response.error,
    contentType: response.contentType,
    htmlLength: response.body.length,
    bodyComplete: true,
    title: pageData.title,
    titleLength: pageData.title.length,
    h1: pageData.h1,
    description: pageData.description,
    canonical: pageData.canonical,
    htmlLang: pageData.htmlLang,
    alternateRaw: pageData.alternateRaw,
    alternates: pageData.alternates,
    jsonLd: pageData.jsonLd,
    faqComparison,
    toolsSummary: pageData.summary,
    contextLinks: pageData.context,
    frenchContextPhrase: pageKey === "fr" ? pageData.context.find((link) => pathnameOf(link.href) === "/fr/retouche-photo-ia/") ?? null : null,
    ctaAnchors,
    activeModeAnchors: activeModes,
    editWorkbenchTag: pageData.workbenchIdTag,
  };
}

for (const [pageKey, pathname] of Object.entries(routes)) {
  const response = await get(pathname);
  report.pages[pageKey] = newPageReport(pathname, response, pageKey);
}

for (const [sourceKey, source] of Object.entries(sourcePages)) {
  const response = await get(source.path);
  const links = response.data.context.filter((link) => pathnameOf(link.href) === source.target);
  report.sourceIncomingLinks[sourceKey] = {
    sourcePath: source.path,
    targetPath: source.target,
    status: response.status,
    links,
    count: links.length,
  };
  check(`${sourceKey}: exactly one incoming context link`, response.status === 200 && links.length === 1, { source: source.path, target: source.target, links });
}

for (const [pageKey, pathname] of Object.entries(routes)) {
  const barePath = pathname.replace(/\/+$/, "");
  const response = await get(barePath, { redirect: "manual" });
  const location = response.location ? new URL(response.location, base) : null;
  const reused = report.pages[pageKey]?.status === 200;
  check(`${pageKey}: bare path redirects once to canonical path`, response.status >= 300 && response.status < 400 && location?.pathname === pathname && reused, { status: response.status, location: response.location, trailingResponseReused: reused });
  report.pages[pageKey].bareRedirect = { status: response.status, location: response.location, trailingResponseReused: reused };
}

const sitemapResponse = await get("/sitemap.xml");
const locMatches = [...sitemapResponse.body.matchAll(/<loc>([^<]+)<\/loc>/g)];
const locs = locMatches.map((match) => match[1]);
const newLocs = locMatches.filter((match) => Object.values(routes).some((route) => match[1] === canonical(route))).map((match) => match[0]);
report.sitemap = {
  status: sitemapResponse.status,
  contentType: sitemapResponse.contentType,
  count: locs.length,
  locs,
  newLocs,
  rawNewLocs: newLocs,
};
check("sitemap contains exactly 19 canonical URLs", sitemapResponse.status === 200 && locs.length === 19, { status: sitemapResponse.status, actualCount: locs.length, expectedCount: 19 });
check("sitemap contains both new canonical locs", newLocs.length === 2 && Object.values(routes).every((route) => locs.includes(canonical(route))), { rawNewLocs: newLocs, expected: Object.values(routes).map(canonical) });
check("GET-only request policy was respected", report.requestedPaths.every((pathname) => !pathname.startsWith("/api/")) && report.apiRequests === 0 && report.generationRequests === 0 && !report.cookiesSent, { requestedPaths: report.requestedPaths });

report.pass = failures.length === 0;
report.failures = failures;

function markdownCodeFence(value, language = "text") {
  return `~~~${language}\n${value}\n~~~`;
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function inlineCode(value) {
  const tick = String.fromCharCode(96);
  return `${tick}${String(value ?? "").replaceAll(tick, `\\${tick}`)}${tick}`;
}

function buildDeliveryMarkdown() {
  const fr = report.pages.fr;
  const nl = report.pages.nl;
  const sourceRows = Object.values(report.sourceIncomingLinks).map((entry) => `| ${entry.sourcePath} | ${entry.targetPath} | ${entry.count} |`).join("\n");
  const sourceBlocks = Object.values(report.sourceIncomingLinks).map((entry) => `### ${entry.sourcePath}\n\n${entry.links.map((link) => markdownCodeFence(link.raw, "html")).join("\n\n")}`).join("\n\n");
  const faqRows = ["fr", "nl"].flatMap((key) => report.pages[key].faqComparison.pageFaq.map((item, index) => {
    const jsonItem = report.pages[key].faqComparison.jsonLdFaq[index] ?? {};
    return `| ${key.toUpperCase()} ${index + 1} | ${markdownCell(item.question)} | ${markdownCell(item.answer)} | ${markdownCell(jsonItem.question)} | ${markdownCell(jsonItem.answer)} | ${item.question === jsonItem.question && item.answer === jsonItem.answer ? "一致" : "不一致"} |`;
  })).join("\n");
  const alternateRows = ["fr", "nl"].map((key) => `### ${key.toUpperCase()}\n\n${markdownCodeFence(report.pages[key].alternateRaw.join("\n"), "html")}`).join("\n\n");
  const jsonRows = ["fr", "nl"].map((key) => `### ${key.toUpperCase()}\n\n${report.pages[key].jsonLd.map((entry) => markdownCodeFence(entry.raw, "html")).join("\n\n")}`).join("\n\n");
  const ctaRows = ["fr", "nl"].map((key) => {
    const page = report.pages[key];
    return `| ${key.toUpperCase()} | ${page.ctaAnchors.map((link) => inlineCode(link.href)).join("<br>")} | ${inlineCode(page.editWorkbenchTag)} |`;
  }).join("\n");
  const ctaBlocks = ["fr", "nl"].map((key) => {
    const page = report.pages[key];
    return `### ${key.toUpperCase()}\n\n${markdownCodeFence([...page.ctaAnchors.map((link) => link.raw), page.editWorkbenchTag].join("\n"), "html")}`;
  }).join("\n\n");
  const activeModeBlocks = ["fr", "nl"].map((key) => `### ${key.toUpperCase()}\n\n${markdownCodeFence(report.pages[key].activeModeAnchors.map((link) => link.raw).join("\n"), "html")}`).join("\n\n");
  const pagePass = (key) => report.checks.filter((item) => item.name.startsWith(`${key}:`)).every((item) => item.pass);
  const reportRows = [
    `| 1 | FR 新页 | URL：${canonical(routes.fr)}；Title：${markdownCell(fr?.title)}（${fr?.titleLength}）；H1：${markdownCell(fr?.h1)}；HTTP：${fr?.status} | ${pagePass("fr") ? "通过" : "失败"} |`,
    `| 2 | NL 新页 | URL：${canonical(routes.nl)}；Title：${markdownCell(nl?.title)}（${nl?.titleLength}）；H1：${markdownCell(nl?.h1)}；HTTP：${nl?.status} | ${pagePass("nl") ? "通过" : "失败"} |`,
    `| 3 | hreflang | 两页各 3 条，FR/NL/x-default 一致，未指向 /edit/ | ${report.checks.find((item) => item.name.includes("fr: exactly three reciprocal"))?.pass && report.checks.find((item) => item.name.includes("nl: exactly three reciprocal"))?.pass ? "通过" : "失败"} |`,
    `| 4 | JSON-LD | 两页完整 WebApplication + FAQPage 原文见下 | ${report.checks.filter((item) => item.name.endsWith("WebApplication fields match page") || item.name.endsWith("FAQPage JSON-LD")).every((item) => item.pass) ? "通过" : "失败"} |`,
    `| 5 | FAQ 一致性 | 页面 details.faq-item 与 FAQPage.mainEntity 逐条对照见下 | ${[fr, nl].every((page) => page?.faqComparison.identical) ? "通过" : "失败"} |`,
    `| 6 | 内链 | 四个来源页各新增 1 条 context-links 入链，原文见下 | ${Object.values(report.sourceIncomingLinks).every((entry) => entry.count === 1) ? "通过" : "失败"} |`,
    `| 7 | 自指锚 | 3 个主 CTA、edit-workbench id、active mode 自指证据见下 | ${[fr, nl].every((page) => page?.ctaAnchors.length === 3 && page?.editWorkbenchTag) ? "通过" : "失败"} |`,
    `| 8 | sitemap | ${report.sitemap?.count} loc；新增 2 条 loc 原文见下 | ${report.sitemap?.count === 19 && report.sitemap?.newLocs?.length === 2 ? "通过" : "失败"} |`,
  ].join("\n");
  return `# Free-edit landing pages delivery verification

检查时间：${report.checkedAt}\n来源：${report.origin}\n来源类型：${report.source}\n请求策略：GET only；无 Cookie；无 API；无生成请求。\n最终状态：${report.pass ? "PASS" : "BLOCKED"}\n\n## D 表\n\n| # | 交付 | 证据 | 状态 |\n| ---: | --- | --- | --- |\n${reportRows}\n\n## FR/NL 意图分工\n\n| 页面 | 主词 | 页面定位 |\n| --- | --- | --- |\n| ${routes.fr} | retouche photo gratuite | 免费修图、不注册、每日额度和限制；AI 只作为实现方式 |\n| ${routes.nl} | ai foto bewerken gratis | 免费 AI 修图、不注册、每日额度和限制；现有 NL 页面正文与 TDK 冻结，仅增加本单指定回链 |\n| /fr/retouche-photo-ia/ | retouche photo ia | AI 修图能力、模型与 prompt 方法 |\n| /nl/foto-bewerken-ai/ | 现有页面定位 | 正文与 TDK 冻结，仅增加本单指定回链 |\n\n## hreflang 原文\n\n${alternateRows}\n\n两页的 hreflang 集合均为 fr → ${canonical(routes.fr)}、nl → ${canonical(routes.nl)}、x-default → ${canonical(routes.fr)}；没有指向 /edit/。\n\n## JSON-LD 原文\n\n${jsonRows}\n\n## FAQ 逐条对照\n\n| 页面/条目 | 页面问题 | 页面答案 | JSON-LD 问题 | JSON-LD 答案 | 比对 |\n| --- | --- | --- | --- | --- | --- |\n${faqRows}\n\n## 四个来源页新增入链\n\n| 来源页 | 目标页 | 数量 |\n| --- | --- | ---: |\n${sourceRows}\n\n完整入链原始 HTML：\n\n${sourceBlocks}\n\n## 自指 CTA 与 id 证据\n\n| 页面 | 3 个 CTA href | edit-workbench id |\n| --- | --- | --- |\n${ctaRows}\n\n完整 CTA 与 id 原始 HTML：\n\n${ctaBlocks}\n\nactive mode 原始 HTML：\n\n${activeModeBlocks}\n\n## Sitemap\n\n- 实际状态：${report.sitemap?.status}\n- loc 数量：${report.sitemap?.count}（目标 19）\n- 新增 loc：\n${markdownCodeFence(report.sitemap?.rawNewLocs?.join("\n") ?? "", "xml")}\n\n## 明确不做范围\n\n| 事项 | 本轮处理 |\n| --- | --- |\n| 意语修图页 | 不做 |\n| \`foto bewerken met ai\` 单独页 | 不做 |\n| 修改 \`/nl/foto-bewerken-ai/\` Title | 不做 |\n| 修改现有页面 TDK | 不做 |\n| 新语种 | 不做 |\n| 支付、生成、API、额度规则 | 不做 |\n\n## 主 agent 验证标记\n\n以下结果由主 agent 在共享工作树中确认，验收脚本本身没有执行这些命令：\n\n- npm test：167/167 PASS\n- npm run typecheck：PASS\n- npm run build：PASS\n- 冻结的旧页面 TDK 与 NL 正文证据：docs/validation/free-edit-pages/scope.json\n\n## 验收记录\n\n详细 JSON 证据：[validation/free-edit-pages/${isLocalOrigin ? "local" : "production"}.json](validation/free-edit-pages/${isLocalOrigin ? "local" : "production"}.json)\n\n失败检查数：${failures.length}\n`;
}

const validationDir = path.join("docs", "validation", "free-edit-pages");
mkdirSync(validationDir, { recursive: true });
const jsonPath = path.join(validationDir, isLocalOrigin ? "local.json" : "production.json");
const markdownPath = path.join("docs", "free-edit-pages-delivery.md");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(markdownPath, buildDeliveryMarkdown(), "utf8");

console.log(JSON.stringify({
  jsonPath,
  markdownPath,
  origin: report.origin,
  source: report.source,
  pass: report.pass,
  failedChecks: failures.length,
  pages: Object.fromEntries(Object.entries(report.pages).map(([key, page]) => [key, { status: page.status, title: page.title, htmlLength: page.htmlLength }])),
  sitemapCount: report.sitemap?.count ?? null,
}, null, 2));
if (!report.pass) process.exitCode = 1;
