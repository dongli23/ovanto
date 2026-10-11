import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_CONTENT } from "../lib/content";
import { PUBLIC_HTML_ROUTES, canonicalPath, canonicalUrl, SITE_URL, SUPPORTED_LOCALES, TOOL_ROUTES, toolRoute, type ToolKind } from "../lib/site";
import sitemap from "../app/sitemap";
import { assertCheckoutReturnPath, CHECKOUT_RETURN_PATHS } from "../lib/payments/config";
import { proxy } from "../proxy";

const kinds: ToolKind[] = ["image", "video", "edit"];

test("canonicalPath normalizes bare and slashed forms to one trailing-slash path", () => {
  assert.equal(canonicalPath("/fr/modifier-photo-ia"), "/fr/modifier-photo-ia/");
  assert.equal(canonicalPath("/fr/modifier-photo-ia/"), "/fr/modifier-photo-ia/");
  assert.equal(canonicalPath("/"), "/");
  assert.equal(canonicalPath("/video"), "/video/");
  // Idempotent on already-canonical input.
  for (const pathname of ["/", "/it/", "/nl/afbeeldingen-maken-met-ai/"]) {
    assert.equal(canonicalPath(canonicalPath(pathname)), canonicalPath(pathname));
  }
});

test("every TOOL_ROUTES HTML path is the canonical trailing-slash form", () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const kind of kinds) {
      const path = toolRoute(locale, kind);
      assert.equal(path, canonicalPath(path), `${locale}/${kind} not canonical: ${path}`);
      assert.ok(path.endsWith("/"), `${locale}/${kind} missing trailing slash: ${path}`);
    }
  }
});

test("PUBLIC_HTML_ROUTES is the complete canonical public page set", () => {
  assert.equal(PUBLIC_HTML_ROUTES.length, 16, "expected 16 public HTML routes");
  for (const pathname of PUBLIC_HTML_ROUTES) {
    assert.equal(pathname, canonicalPath(pathname), `${pathname} not canonical`);
    assert.ok(pathname === "/" || pathname.endsWith("/"), `${pathname} missing trailing slash`);
    assert.ok(!pathname.startsWith("/api/"), `${pathname} is an API route`);
  }
  // Contains the previously missing pages.
  for (const required of ["/nl/afbeeldingen-maken-met-ai/", "/pricing/", "/terms/", "/privacy/"]) {
    assert.ok(PUBLIC_HTML_ROUTES.includes(required), `missing ${required}`);
  }
});

test("all page content paths and extra links are canonical trailing-slash URLs", () => {
  for (const page of Object.values(PAGE_CONTENT)) {
    assert.equal(page.path, canonicalPath(page.path), `${page.key} path not canonical: ${page.path}`);
    assert.equal(page.url, canonicalUrl(page.path), `${page.key} url mismatch`);
    for (const link of page.extraLinks ?? []) {
      assert.equal(link.href, canonicalPath(link.href), `${page.key} extraLink not canonical: ${link.href}`);
    }
  }
});

test("sitemap has no duplicates", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.equal(new Set(urls).size, urls.length, "duplicate sitemap URLs");
});

test("sitemap URLs are all on the www host", () => {
  for (const entry of sitemap()) {
    assert.ok(entry.url.startsWith(`${SITE_URL}/`), `non-www sitemap URL: ${entry.url}`);
    assert.ok(!/vercel\.app|ovanto\.ai\//.test(entry.url.slice(SITE_URL.length)), `preview/apex URL: ${entry.url}`);
  }
});

test("sitemap HTML URLs all carry the trailing slash and keep legal pages", () => {
  const urls = sitemap().map((entry) => entry.url);
  for (const url of urls) {
    const pathname = new URL(url).pathname;
    assert.ok(pathname === "/" || pathname.endsWith("/"), `bare HTML URL in sitemap: ${url}`);
    assert.ok(!pathname.startsWith("/api/"), `API URL in sitemap: ${url}`);
  }
  for (const legal of ["/pricing/", "/terms/", "/privacy/"]) {
    assert.ok(urls.includes(canonicalUrl(legal)), `legal page missing from sitemap: ${legal}`);
  }
});

test("language alternates for every page identify the same toolKind across locales", () => {
  for (const page of Object.values(PAGE_CONTENT)) {
    for (const locale of SUPPORTED_LOCALES) {
      const target = TOOL_ROUTES[locale][page.toolKind];
      assert.ok(target, `${page.key}: no ${locale} route for ${page.toolKind}`);
      assert.equal(canonicalPath(target), target, `${page.key}: non-canonical alternate ${target}`);
      const targetPage = Object.values(PAGE_CONTENT).find((candidate) => canonicalPath(candidate.path) === canonicalPath(target));
      assert.equal(targetPage?.toolKind, page.toolKind, `${page.key}: alternate ${locale} changes toolKind`);
      assert.equal(targetPage?.locale, locale, `${page.key}: alternate ${locale} has wrong locale`);
    }
  }
});

test("checkout returnPath whitelist accepts every locale video route and only canonical paths", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(assertCheckoutReturnPath(toolRoute(locale, "video")), toolRoute(locale, "video"));
  }
  for (const path of CHECKOUT_RETURN_PATHS) {
    assert.equal(path, canonicalPath(path), `returnPath whitelist entry not canonical: ${path}`);
  }
  assert.throws(() => assertCheckoutReturnPath("/fr/modifier-photo-ia"));
  assert.throws(() => assertCheckoutReturnPath("https://evil.example/video/"));
});

test("sitemap URL count matches PUBLIC_HTML_ROUTES", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.equal(urls.length, PUBLIC_HTML_ROUTES.length);
  for (const pathname of PUBLIC_HTML_ROUTES) {
    assert.ok(urls.includes(canonicalUrl(pathname)), `sitemap missing ${pathname}`);
  }
});

test("proxy redirects every bare PUBLIC_HTML_ROUTE to its trailing-slash canonical with 308", () => {
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  try {
    const makeRequest = (pathname: string) => {
      const url = new URL(`https://www.ovanto.ai${pathname}`);
      return {
        nextUrl: { hostname: url.hostname, origin: url.origin, pathname: url.pathname, search: url.search },
        headers: new Headers(),
      } as never;
    };
    for (const pathname of PUBLIC_HTML_ROUTES) {
      if (pathname === "/") continue; // root is already canonical
      const bare = pathname.replace(/\/+$/, "");
      const redirected = proxy(makeRequest(bare)) as Response;
      assert.equal(redirected.status, 308, `${bare} should redirect`);
      assert.equal(redirected.headers.get("location"), `https://www.ovanto.ai${pathname}`, `${bare} wrong Location`);
      const slashed = proxy(makeRequest(pathname)) as Response;
      assert.notEqual(slashed.status, 308, `${pathname} must not redirect`);
      assert.equal(slashed.headers.get("location"), null, `${pathname} must not carry a redirect Location`);
    }
    // API, metadata and unknown paths must pass through untouched.
    for (const pathname of ["/api/waffo/catalog", "/api/waffo/catalog/", "/robots.txt", "/sitemap.xml", "/unknown"]) {
      const response = proxy(makeRequest(pathname)) as Response;
      assert.notEqual(response.status, 308, `${pathname} must not redirect`);
      assert.equal(response.headers.get("location"), null, `${pathname} must not carry a redirect Location`);
    }
  } finally {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});
