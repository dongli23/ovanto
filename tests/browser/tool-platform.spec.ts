import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { SUPPORTED_LOCALES, toolRoute, type ToolKind } from "../../lib/site";

// This contract suite only reads pages and mocks the read-only API calls made by
// the workbench. Any mutation request fails the test instead of reaching a
// provider, checkout, quota mutation, or other external service.
test.beforeEach(async ({ context }) => {
  await context.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") {
      throw new Error(`Unexpected mutation in tool-platform UI test: ${route.request().method()} ${new URL(route.request().url()).pathname}`);
    }

    const path = new URL(route.request().url()).pathname;
    let body: unknown = { error: { code: "UI_TEST_ONLY", message: "No live API calls in UI tests" } };
    if (path === "/api/quota") {
      const kind = new URL(route.request().url()).searchParams.get("kind");
      body = { remaining: kind === "video" ? 1 : 3, limit: kind === "video" ? 1 : 3, available: true };
    } else if (path === "/api/waffo/catalog") {
      body = { enabled: true, products: [{ key: "video", model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", credits: 3, packPriceCents: 499 }] };
    } else if (path === "/api/account/session") {
      body = { authenticated: true, email: "ui-test@example.invalid", balances: { video: 0, image: 0, edit: 0 } };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await context.route("https://challenges.cloudflare.com/**", (route) => route.abort());
});

const expectedInspirationSources = ["avatar.webp", "sneaker.webp", "poster.svg", "interior.svg", "landscape.webp", "botanical.svg"];
const toolKinds = ["image", "video", "edit"] as const satisfies readonly ToolKind[];

for (const locale of SUPPORTED_LOCALES) {
  for (const kind of toolKinds) {
    test(`${locale}/${kind}: platform model copy, CTA anchors and reference image mapping`, async ({ page }) => {
      await page.goto(toolRoute(locale, kind));

      const modelText = await page.locator("#ai-models").innerText();
      const workflowText = await page.locator("#advanced-features").innerText();
      if (kind === "image") {
        expect(modelText).toContain("Flux Schnell");
      } else if (kind === "video") {
        expect(modelText).toContain("Wan 2.5");
        expect(modelText).toContain("Kling 2.5 Turbo Pro");
        expect(modelText).not.toContain("Flux Schnell");
        expect(workflowText).not.toContain("Flux Schnell");
      } else {
        expect(modelText).toContain("Flux Kontext Dev");
        expect(modelText).not.toContain("Flux Schnell");
        expect(workflowText).not.toContain("Flux Schnell");
      }

      const expectedWorkbench = `${toolRoute(locale, kind)}#${kind}-workbench`;
      const platformCtas = page.locator("#ai-models a, #advanced-features a");
      expect(await platformCtas.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual([
        expectedWorkbench,
        expectedWorkbench,
        expectedWorkbench,
      ]);

      const sourceAttributes = await page.locator("#inspiration .inspiration-card img").evaluateAll((images) => images.map((image) => image.getAttribute("src") ?? ""));
      expect(sourceAttributes).toHaveLength(expectedInspirationSources.length);
      for (const [index, source] of expectedInspirationSources.entries()) {
        expect(decodeURIComponent(sourceAttributes[index])).toContain(source);
      }
    });
  }
}

test("pricing source and rendered page expose every supported video workspace", async ({ page }) => {
  const workspaceLinks = ["/video/", "/it/", "/fr/", "/nl/ai-video-maken/"];
  const response = await page.goto("/pricing/");
  expect(response?.status()).toBe(200);

  const html = await page.locator("body").innerText();
  if (html.includes("Available now")) {
    for (const href of workspaceLinks) {
      await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
    }
  } else {
    // Local UI runs may intentionally omit checkout configuration. Keep the
    // copy contract covered without pretending that checkout is enabled.
    const source = readFileSync("app/pricing/page.tsx", "utf8");
    for (const href of workspaceLinks) expect(source).toContain(`href: "${href}"`);
  }
});
