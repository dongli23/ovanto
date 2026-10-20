import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { PAGE_CONTENT } from "../lib/content";
import { freeEditAlternates, isFreeEditPagePath, ROUTES, SUPPORTED_LOCALES, TOOL_ROUTES, canonicalPath, canonicalUrl, localeFromPath, toolRoute, type ToolKind } from "../lib/site";
import sitemap from "../app/sitemap";
import { assertCheckoutReturnPath } from "../lib/payments/config";

const kinds: ToolKind[] = ["image", "video", "edit"];

test("each locale has a real public page for every tool, with matching content and locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(new Set(Object.values(TOOL_ROUTES[locale])).size, 3);
    for (const kind of kinds) {
      const path = toolRoute(locale, kind);
      const page = Object.values(PAGE_CONTENT).find(page => canonicalPath(page.path) === canonicalPath(path));
      assert.ok(page, `${locale}/${kind} content missing`);
      assert.equal(page.locale, locale);
      assert.equal(page.toolKind, kind);
      assert.equal(localeFromPath(path), locale);
      assert.equal(page.url, canonicalUrl(path));
      assert.ok(existsSync(`app${path === "/" ? "/" : canonicalPath(path)}page.tsx`), `${path} route missing`);
    }
  }
});

test("tool language alternates all identify the same workflow", () => {
  for (const source of Object.values(PAGE_CONTENT)) {
    for (const locale of SUPPORTED_LOCALES) {
      const target = Object.values(PAGE_CONTENT).find(page => canonicalPath(page.path) === canonicalPath(toolRoute(locale, source.toolKind)));
      assert.equal(target?.toolKind, source.toolKind);
      assert.equal(target?.locale, locale);
    }
  }
});

test("French retouch landing page keeps a distinct improvement intent", () => {
  const retouch = PAGE_CONTENT.frRetouch;
  const modifier = PAGE_CONTENT.frEdit;
  assert.equal(retouch.path, ROUTES.frRetouch);
  assert.equal(retouch.locale, "fr");
  assert.equal(retouch.toolKind, "edit");
  assert.notEqual(retouch.h1, modifier.h1);
  assert.match(retouch.h1, /retouche|retoucher/i);
  assert.match(retouch.description, /retouch/i);
  assert.deepEqual(
    {
      en: toolRoute("en", "edit"),
      it: toolRoute("it", "edit"),
      fr: ROUTES.frRetouch,
      nl: toolRoute("nl", "edit"),
      "x-default": toolRoute("en", "edit"),
    },
    {
      en: "/edit/",
      it: "/it/modifica-foto-ai/",
      fr: "/fr/retouche-photo-ia/",
      nl: "/nl/foto-bewerken-ai/",
      "x-default": "/edit/",
    },
  );
});

test("French and Dutch free-edit landing pages share a reciprocal alternate group", () => {
  assert.equal(isFreeEditPagePath(ROUTES.frFreeEdit), true);
  assert.equal(isFreeEditPagePath(ROUTES.nlFreeEdit), true);
  assert.deepEqual(freeEditAlternates(), [
    { hrefLang: "fr", href: canonicalUrl(ROUTES.frFreeEdit) },
    { hrefLang: "nl", href: canonicalUrl(ROUTES.nlFreeEdit) },
    { hrefLang: "x-default", href: canonicalUrl(ROUTES.frFreeEdit) },
  ]);
  assert.equal(freeEditAlternates().some(({ href }) => href.includes("/edit/")), false);
});

test("sitemap includes every tool page without duplicate canonical URLs", () => {
  const urls = sitemap().map(entry => entry.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const page of Object.values(PAGE_CONTENT)) assert.ok(urls.includes(canonicalUrl(page.path)), page.path);
});

test("all locale video pages can safely return from checkout, arbitrary URLs stay rejected", () => {
  for (const locale of SUPPORTED_LOCALES) assert.equal(assertCheckoutReturnPath(toolRoute(locale, "video")), toolRoute(locale, "video"));
  for (const path of ["https://evil.example/video/", "//evil.example", "/video/?next=https://evil.example", "/unknown/"]) {
    assert.throws(() => assertCheckoutReturnPath(path));
  }
});
