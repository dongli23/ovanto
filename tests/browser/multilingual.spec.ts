import { test, expect, type Page } from "@playwright/test";
import { SUPPORTED_LOCALES, toolRoute, canonicalUrl, type ToolKind } from "../../lib/site";
import { buildGenerationAttemptSignature, generationWorkspaceStorageKey, type GenerationWorkspaceState } from "../../lib/generation/workspace-state";
import { readFileSync } from "node:fs";
import sharp from "sharp";

// Every API request is intercepted before reaching a server. A deliberate new
// variation has one locally fulfilled POST fixture; no test reaches a live
// generation, quota mutation, provider charge or checkout.
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ context, page }) => {
  pageErrors.set(page, []);
  page.on("pageerror", error => pageErrors.get(page)?.push(error.message));
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") throw new Error(`Unexpected mutation in UI test: ${path}`);
    let body: unknown;
    if (path === "/api/quota") {
      const kind = new URL(route.request().url()).searchParams.get("kind");
      body = { remaining: kind === "video" ? 1 : 3, limit: kind === "video" ? 1 : 3, available: true };
    } else if (path === "/api/waffo/catalog") {
      body = { enabled: true, products: [{ key: "video", model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", credits: 3, packPriceCents: 499 }] };
    } else if (path === "/api/account/session") {
      body = { authenticated: true, email: "ui-test@example.invalid", balances: { video: 2, image: 0, edit: 0 } };
    } else {
      body = { error: { code: "UI_TEST_ONLY", message: "No live API calls in UI tests" } };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await context.route("https://challenges.cloudflare.com/**", route => route.abort());
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const locale of SUPPORTED_LOCALES) {
    for (const kind of ["image", "video", "edit"] as ToolKind[]) {
      test(`${viewport.width}px ${locale}/${kind}: complete tools, metadata, localized shell and no overflow`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const response = await page.goto(toolRoute(locale, kind));
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator(".site-shell")).toHaveClass(/platform-home/);
        await expect(page.locator(".workbench-modes a")).toHaveCount(3);
        await expect(page.locator(".workbench-modes [aria-current=page]")).toHaveAttribute("href", toolRoute(locale, kind));
        for (const target of SUPPORTED_LOCALES) {
          await expect(page.locator(`.language-nav a[hreflang=${target}]`)).toHaveAttribute("href", toolRoute(target, kind));
          await expect(page.locator(`head link[rel=alternate][hreflang=${target}]`)).toHaveAttribute("href", canonicalUrl(toolRoute(target, kind)));
        }
        await expect(page.locator("head link[rel=canonical]")).toHaveAttribute("href", canonicalUrl(toolRoute(locale, kind)));
        await expect(page.locator(".product-nav")).toBeVisible();
        await expect(page.locator("#inspiration")).toBeVisible();
        await expect(page.locator("#how-it-works")).toBeVisible();
        await expect(page.locator(`#${kind}-prompt`)).toBeVisible();
        await expect(page.locator("#edit-upload")).toHaveCount(kind === "edit" ? 1 : 0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const invalidAssets = await page.locator("img").evaluateAll(images => images.filter(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0).map(image => image.getAttribute("src")));
        expect(invalidAssets).toEqual([]);
      });
    }
  }
}

for (const kind of ["image", "video", "edit"] as ToolKind[]) {
  test(`${kind}: typing, locale switching and reload retain prompt and selected workflow`, async ({ page }) => {
    await page.goto(toolRoute("en", kind));
    const prompt = "Multilingual regression draft — keep my work";
    await page.locator(`#${kind}-prompt`).fill(prompt);
    for (const locale of ["it", "fr", "nl", "en"] as const) {
      await page.locator(`.language-nav a[hreflang=${locale}]`).click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator(`#${kind}-prompt`)).toHaveValue(prompt);
      await expect(page.locator(".workbench-modes [aria-current=page]")).toHaveAttribute("href", toolRoute(locale, kind));
    }
    await page.reload();
    await expect(page.locator(`#${kind}-prompt`)).toHaveValue(prompt);
  });
}

test("paid video model/balance and explicit free choice survive language switch", async ({ page }) => {
  await page.goto(toolRoute("en", "video"));
  await expect(page.locator(".workbench-settings")).toContainText("Kling 2.5 Turbo Pro");
  await expect(page.locator(".quota-label")).toContainText("2");
  await expect(page.locator(".quota-label")).not.toContainText("today");
  const tiers = page.locator(".paid-tier-row button");
  await tiers.first().click();
  await expect(page.locator(".workbench-settings")).toContainText("Wan 2.5");
  await page.locator(".language-nav a[hreflang=it]").click();
  await expect(page.locator(".workbench-settings")).toContainText("Wan 2.5");
  await expect(page.locator(".quota-label")).toContainText("1/1");
  await page.locator(".paid-tier-row button").nth(1).click();
  await page.locator(".language-nav a[hreflang=nl]").click();
  await expect(page.locator(".workbench-settings")).toContainText("Kling 2.5 Turbo Pro");
  await expect(page.locator(".quota-label")).toContainText("2");
  await expect(page.locator(".workbench-settings")).not.toContainText("480p");
});

test("legacy Dutch image route retains complete tools and equivalent language links", async ({ page }) => {
  expect((await page.goto("/nl/afbeeldingen-maken-met-ai/"))?.status()).toBe(200);
  await expect(page.locator(".workbench-modes a")).toHaveCount(3);
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await expect(page.locator("head link[rel=canonical]")).toHaveAttribute("href", canonicalUrl("/nl/afbeeldingen-maken-met-ai/"));
  await expect(page.locator(".language-nav a[hreflang=it]")).toHaveAttribute("href", toolRoute("it", "image"));
});

const fixturePrompt = "Existing task UI regression fixture";
const fixtureJobId = "00000000-0000-4000-8000-000000000001";
const fixtureImage = "https://replicate.delivery/ui-regression/result.webp";

function fixtureState(kind: ToolKind, overrides: Partial<GenerationWorkspaceState>): GenerationWorkspaceState {
  return {
    version: 1, kind,
    attemptSignature: buildGenerationAttemptSignature({ kind, paid: false, prompt: fixturePrompt }),
    idempotencyKey: "00000000-0000-4000-8000-000000000002",
    paid: false, pendingJob: null, result: null, resultJob: null,
    uploadedAsset: null, uploadName: null, ...overrides,
  };
}

test("completed result survives language navigation and reload without API mutation", async ({ page, context }) => {
  const state = fixtureState("image", { result: { url: fixtureImage, mediaType: "image" }, resultJob: { id: fixtureJobId, paid: false } });
  await context.addInitScript(({ key, state, prompt }) => {
    if (!sessionStorage.getItem("ui-test-seeded")) {
      sessionStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem("ovanto:prompt-draft", prompt);
      sessionStorage.setItem("ui-test-seeded", "yes");
    }
  }, { key: generationWorkspaceStorageKey("image"), state, prompt: fixturePrompt });
  await context.route(fixtureImage, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>' }));
  await page.goto("/");
  await expect(page.locator(`.result-panel img[src="${fixtureImage}"]`)).toBeVisible();
  await page.locator(".language-nav a[hreflang=fr]").click();
  await expect(page.locator(`.result-panel img[src="${fixtureImage}"]`)).toBeVisible();
  await page.reload();
  await expect(page.locator(`.result-panel img[src="${fixtureImage}"]`)).toBeVisible();
  await page.route(`**/api/generations/${fixtureJobId}/download`, route => route.fulfill({ status: 200, contentType: "image/webp", headers: { "Content-Disposition": 'attachment; filename="ovanto-image.webp"' }, body: readFileSync("public/examples/avatar.webp") }));
  const downloadEvent = page.waitForEvent("download");
  await page.locator(".download-button").click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("ovanto-image.webp");
  expect(await download.failure()).toBeNull();
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  expect((await sharp(downloadedPath!).metadata()).width).toBeGreaterThan(0);
});

test("restored accepted job resumes through GET only, without another generation POST", async ({ page, context }) => {
  const state = fixtureState("image", { pendingJob: { id: fixtureJobId, paid: false } });
  await context.addInitScript(({ key, state, prompt }) => {
    if (!sessionStorage.getItem("ui-test-seeded")) {
      sessionStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem("ovanto:prompt-draft", prompt);
      sessionStorage.setItem("ui-test-seeded", "yes");
    }
  }, { key: generationWorkspaceStorageKey("image"), state, prompt: fixturePrompt });
  let reads = 0;
  await page.route(`**/api/generations/${fixtureJobId}`, async route => {
    expect(route.request().method()).toBe("GET");
    reads++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: fixtureJobId, status: "succeeded", remaining: 2, result: { url: fixtureImage, mediaType: "image" } }) });
  });
  await context.route(fixtureImage, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>' }));
  await page.goto(toolRoute("fr", "image"));
  await expect(page.locator("#image-prompt")).toHaveValue(fixturePrompt);
  expect(reads).toBe(0); // Restore itself must not poll or submit.
  await page.locator(".generate-button").click();
  await expect(page.locator(`.result-panel img[src="${fixtureImage}"]`)).toBeVisible();
  expect(reads).toBe(1);
});

test("validated edit upload survives locale change", async ({ page, context }) => {
  const asset = { assetId: "00000000-0000-4000-8000-000000000003", url: "https://fal.media/ui-regression/upload.webp" };
  const state = fixtureState("edit", { attemptSignature: null, idempotencyKey: null, paid: null, uploadedAsset: asset, uploadName: "test-photo.webp" });
  await context.addInitScript(({ key, state }) => {
    if (!sessionStorage.getItem("ui-test-seeded")) {
      sessionStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem("ui-test-seeded", "yes");
    }
  }, { key: generationWorkspaceStorageKey("edit"), state });
  await context.route(asset.url, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>' }));
  await page.goto(toolRoute("en", "edit"));
  await expect(page.locator(".upload-name")).toContainText("test-photo.webp");
  await page.locator(".language-nav a[hreflang=nl]").click();
  await expect(page.locator(".upload-name")).toContainText("test-photo.webp");
  await expect(page.locator(".upload-original-preview img")).toBeVisible();
});

test("last paid credit already reserved: restored task still polls paid GET instead of free POST", async ({ page, context }) => {
  const state = fixtureState("video", {
    paid: true,
    attemptSignature: buildGenerationAttemptSignature({ kind: "video", paid: true, prompt: fixturePrompt }),
    pendingJob: { id: fixtureJobId, paid: true },
  });
  await context.addInitScript(({ key, state, prompt }) => {
    sessionStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem("ovanto:prompt-draft", prompt);
  }, { key: generationWorkspaceStorageKey("video"), state, prompt: fixturePrompt });
  await page.route("**/api/account/session", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, balances: { video: 0, image: 0, edit: 0 } }) }));
  let reads = 0;
  await page.route(`**/api/paid/generations/${fixtureJobId}`, async route => {
    expect(route.request().method()).toBe("GET");
    reads++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: fixtureJobId, status: "succeeded", remaining: 0, result: { url: "https://fal.media/ui-regression/video.mp4", mediaType: "video" } }) });
  });
  await context.route("https://fal.media/ui-regression/video.mp4", route => route.abort());
  await page.goto(toolRoute("it", "video"));
  await expect(page.locator("#video-prompt")).toHaveValue(fixturePrompt);
  await expect(page.locator(".paid-tier-row")).toBeVisible();
  expect(reads).toBe(0);
  await page.locator(".generate-button").click();
  await expect(page.locator(".result-panel video")).toHaveAttribute("src", "https://fal.media/ui-regression/video.mp4");
  expect(reads).toBe(1);
});

test("completed paid result: deliberate new variation gets a fresh idempotency key", async ({ page, context }) => {
  const oldKey = "00000000-0000-4000-8000-000000000002";
  const resultUrl = "https://fal.media/ui-regression/completed-video.mp4";
  const state = fixtureState("video", {
    paid: true,
    attemptSignature: buildGenerationAttemptSignature({ kind: "video", paid: true, prompt: fixturePrompt }),
    result: { url: resultUrl, mediaType: "video" }, resultJob: { id: fixtureJobId, paid: true },
  });
  await context.addInitScript(({ key, state, prompt }) => {
    sessionStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem("ovanto:prompt-draft", prompt);
  }, { key: generationWorkspaceStorageKey("video"), state, prompt: fixturePrompt });
  await context.route(resultUrl, route => route.abort());
  let submittedKey: string | undefined;
  // This POST is fulfilled locally and never reaches the app/provider.
  await page.route("**/api/paid/generate", async route => {
    expect(route.request().method()).toBe("POST");
    submittedKey = route.request().postDataJSON().idempotencyKey;
    expect(submittedKey).not.toBe(oldKey);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000004", status: "succeeded", remaining: 1, result: { url: resultUrl, mediaType: "video" } }) });
  });
  await page.goto(toolRoute("en", "video"));
  await expect(page.locator(".workbench-settings")).toContainText("Kling 2.5 Turbo Pro");
  await expect(page.locator(".result-panel video")).toHaveAttribute("src", resultUrl);
  await page.locator(".generate-button").click();
  await expect.poll(() => submittedKey).toBeTruthy();
  expect(submittedKey).not.toBe(oldKey);
});
