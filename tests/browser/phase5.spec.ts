import { test, expect } from "@playwright/test";
import { canonicalUrl, SUPPORTED_LOCALES, TOOL_ROUTES, toolRoute, type ToolKind } from "../../lib/site";

const footerAup = {
  en: "Acceptable use",
  it: "Uso accettabile",
  fr: "Utilisation acceptable",
  nl: "Aanvaardbaar gebruik",
} as const;

test.beforeEach(async ({ context }) => {
  await context.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") {
      throw new Error(`Unexpected non-GET API request in Phase 5 browser test: ${route.request().method()}`);
    }
    const url = new URL(route.request().url());
    let body: unknown = { error: { code: "PHASE5_TEST_ONLY", message: "No live API calls in this test" } };
    if (url.pathname === "/api/quota") {
      const kind = url.searchParams.get("kind");
      body = { remaining: kind === "video" ? 1 : 3, limit: kind === "video" ? 1 : 3, available: true };
    } else if (url.pathname === "/api/account/session") {
      body = { authenticated: false, balances: null };
    } else if (url.pathname === "/api/waffo/catalog") {
      body = { enabled: false, products: [] };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await context.route("https://challenges.cloudflare.com/**", (route) => route.abort());
});

test("A1 retouche page has its own intent, metadata, five alternates and JSON-LD", async ({ page }) => {
  await page.goto("/fr/retouche-photo-ia/");
  await expect(page).toHaveTitle(/retouche|photo/i);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("h1")).toHaveCount(1);
  const retoucheH1 = await page.locator("h1").innerText();
  await page.goto("/fr/modifier-photo-ia/");
  const modifierH1 = await page.locator("h1").innerText();
  expect(retoucheH1).not.toBe(modifierH1);

  await page.goto("/fr/retouche-photo-ia/");
  expect((await page.title()).length).toBeLessThanOrEqual(60);
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", canonicalUrl("/fr/retouche-photo-ia/"));
  for (const [lang, href] of Object.entries({
    en: canonicalUrl("/edit/"),
    it: canonicalUrl("/it/modifica-foto-ai/"),
    fr: canonicalUrl("/fr/retouche-photo-ia/"),
    nl: canonicalUrl("/nl/foto-bewerken-ai/"),
    "x-default": canonicalUrl("/edit/"),
  })) {
    await expect(page.locator(`head link[rel=alternate][hreflang="${lang}"]`)).toHaveAttribute("href", href);
  }
  const schemaTypes = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts.flatMap((script) => {
    try {
      const value = JSON.parse(script.textContent ?? "null");
      return [value?.["@type"]];
    } catch {
      return [];
    }
  }));
  expect(schemaTypes).toEqual(expect.arrayContaining(["WebApplication", "FAQPage"]));
});

test("A2 AUP, C2 localized safety terms and 17 URL sitemap are public", async ({ page, request }) => {
  await page.goto("/aup/");
  for (const id of ["content-standards", "moderation", "reporting", "enforcement"]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator('a[href="mailto:hello@ovanto.ai"]')).toHaveCount(2);

  await page.goto("/terms/");
  for (const locale of ["en", "it", "fr", "nl"]) {
    await expect(page.locator(`#content-safety-${locale}`)).toBeVisible();
    await expect(page.locator(`#refund-process-${locale}[lang="${locale}"]`)).toBeVisible();
  }
  await expect(page.locator("#refunds")).toBeVisible();
  await expect(page.locator('a[href="#consumer-rights"]')).toHaveCount(1);

  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(urls).toHaveLength(17);
  expect(urls).toContain(canonicalUrl("/fr/retouche-photo-ia/"));
  expect(urls).toContain(canonicalUrl("/aup/"));
  expect(urls).not.toContain(canonicalUrl("/nl/afbeeldingen-maken-met-ai/"));
});

test("A3 every locale/tool page has three summary links and same-locale context links", async ({ page }) => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const kind of ["image", "video", "edit"] as ToolKind[]) {
      await page.goto(toolRoute(locale, kind));
      const summaryLinks = await page.locator(".tools-summary a").evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
      expect(new Set(summaryLinks)).toEqual(new Set(Object.values(TOOL_ROUTES[locale])));
      expect(summaryLinks).toHaveLength(3);

      const contextLinks = await page.locator(".context-links a").evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).pathname));
      expect(contextLinks.length).toBeGreaterThanOrEqual(2);
      for (const route of Object.values(TOOL_ROUTES[locale]).filter((route) => route !== toolRoute(locale, kind))) {
        expect(contextLinks).toContain(route);
      }
      const localeRoutes = new Set<string>([
        ...Object.values(TOOL_ROUTES[locale]),
        ...(locale === "fr" ? ["/fr/retouche-photo-ia/"] : []),
      ]);
      expect(contextLinks.every((href) => localeRoutes.has(href))).toBe(true);
      await expect(page.locator(`a[href="/aup/"]`)).toContainText(footerAup[locale]);
    }
  }
});

test("Phase 5 browser audit performs no API mutation", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET") mutations.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/fr/retouche-photo-ia/");
  await expect(page.locator("h1")).toBeVisible();
  expect(mutations).toEqual([]);
});

test("C1 paid generation blocks a French unsafe prompt before any provider result", async ({ page }) => {
  let submittedLocale: string | undefined;
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (/replicate\.com|fal\.run|fal\.ai/i.test(request.url())) providerRequests.push(request.url());
  });

  await page.route("**/api/waffo/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        products: [{ key: "video", model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", credits: 3, packPriceCents: 499 }],
      }),
    });
  });
  await page.route("**/api/account/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, balances: { video: 2, image: 0, edit: 0 } }),
    });
  });
  await page.route("**/api/paid/generate", async (route) => {
    expect(route.request().method()).toBe("POST");
    submittedLocale = route.request().headers()["x-ovanto-interface-locale"];
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "CONTENT_SAFETY_BLOCKED", message: "This prompt cannot be used for generation." } }),
    });
  });

  await page.goto("/fr/");
  await expect(page.locator(".paid-tier-row")).toBeVisible();
  await expect(page.locator(".paid-tier.is-selected")).toContainText("Payant");
  await expect(page.locator(".paid-balance")).toContainText("2");
  await expect(page.locator(".workbench-settings")).toContainText("Kling 2.5 Turbo Pro");
  await page.locator("#video-prompt").fill("A safe UI content safety fixture");
  await page.locator(".generate-button").click();

  await expect(page.locator("#video-error")).toContainText("Ce prompt ne respecte pas nos règles de contenu");
  await expect(page.locator(".paid-balance")).toContainText("2");
  await expect(page.locator("#video-status video, #video-status img")).toHaveCount(0);
  expect(submittedLocale).toBe("fr");
  expect(providerRequests).toEqual([]);
});
