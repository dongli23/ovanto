# OVANTO_RAPHAEL_LAYOUT_REDESIGN_V1

## BASELINE
- branch: main
- start_commit: a7950d9b1abf144be54de8c77305da7f704cfaa2
- framework: Next.js 16.3.7, React 19, TypeScript, existing global CSS/Tailwind
- homepage: app/page.tsx → components/PageShell.tsx
- generator_component: components/GeneratorWorkbench.tsx → components/Generator.tsx
- global_styles: app/tokens.css, app/globals.css
- working_tree_before: untracked AGENTS.md and CLAUDE.md; no tracked changes
- current_build_result: baseline production build PASS
- screenshots: docs/validation/raphael-before-1440.png, raphael-before-390.png

## DESIGN_SYSTEM
- tokens_updated: paper, ink, muted text, border, mint, coral, readable dark coral, light shadow, container/prose widths and section spacing
- global_styles: legacy color names resolve to shared Ovanto tokens; responsive platform sections, compact workbench controls, visible keyboard focus and reduced motion
- new_shared_components: HomePlatform server component with SectionHeading helper; real tool/model/inspiration data arrays allow future expansion
- no added dependencies, client animation library or provider changes

## HOMEPAGE
- header: real image workspace anchor; existing French video and editor routes explicitly marked FR; tools anchor; existing four languages retained
- hero: original H1 preserved; short subtitle and compact trust points; generator remains near the first viewport
- generator: left controls/right result on desktop; single column on mobile; compact fixed model/ratio display; example chips; explicit result empty state
- tools: Image Generator, AI Video, AI Photo Editor; no fabricated tools or coming-soon buttons
- models: Flux Schnell only in the free image workspace; Auto and unexposed paid models are not advertised
- inspiration: six lazy-loaded concept illustrations with dimensions, alt text and clear illustrative provenance; three existing WebP assets plus three original SVG assets authored in this change; no third-party images
- core_benefits: six concise, factual benefits
- how_it_works: Describe → Generate → Download, three columns/one column
- advanced_features: current prompt example assistance and browser review/download workflow; illustrative previews, no nonexistent smart-prompt or improvement actions
- seo_content_reordered: all existing leads, detail paragraphs, use cases, steps, headings and FAQ text preserved below platform modules
- faq: native details/summary accordion with mouse and Enter-key checks; existing FAQ JSON-LD unchanged
- footer: tools, resources, languages; existing links retained on localized pages
- multilingual: new platform modules target the English homepage; shared token/empty-state/FAQ improvements also apply to localized pages without changing their content or routes

## FUNCTIONAL_REGRESSION
- prompt: PASS, actual local input and isolated browser fixture
- example_prompt: PASS, actual click fills and focuses textarea
- model: PASS, fixed Flux Schnell display retained; no selectable model was supported before
- aspect_ratio: PASS, fixed 1:1 retained; backend rejects caller-selected controls
- generate/loading/result: PASS in isolated browser mock; actual unconfigured local service reports unavailable
- retry: PASS, clears error; subsequent generate succeeds in mock
- download: PASS, browser download event and ovanto-image.webp filename in mock
- rate_limit: PASS, existing unit tests plus isolated browser limit response
- turnstile: PASS, existing unit tests plus browser stub executes and returns token; real Cloudflare challenge not tested
- request_contract: original task, tier, prompt, idempotencyKey, turnstileToken fields verified; no model/ratio fields introduced
- production provider generation: UNVERIFIED; local secrets absent. No production credentials, provider calls or quota consumption were introduced for testing.

## SEO_REGRESSION
- title/description/H1/canonical/hreflang: PASS on all seven existing pages; lib/content.ts unchanged from baseline
- faq_schema: PASS, original questions and answers remain consistent with rendered accordion content
- robots/sitemap: PASS, unchanged sources and HTTP 200
- SSR/indexability: PASS, preserved existing routes, canonical host and protected generation/SEO sources
- old SEO copy: PASS, original headings and all long-text paragraphs present in HTTP HTML
- old historical verifiers assume four total H2s and older mode/link contracts; the new dedicated verifier covers the expanded layout without weakening or rewriting those archived checks

## RESPONSIVE
- 390: PASS, ≤4 H1 lines, single-column generator
- 430: PASS, ≤4 H1 lines, single-column generator
- 768: PASS
- 1440: PASS
- horizontal_overflow: NONE, measured document width and visible element bounds without masking overflow
- controls: PASS, Generate/Retry/example chips at least 44px
- images: PASS, six decoded inspiration images, lazy loading, correct alt/dimensions
- screenshots: docs/validation/raphael-after-{390,430,768,1440}.png

## QUALITY
- tests: PASS, 62/62
- lint: N/A; repository has no configured lint script/dependency. git diff --check PASS.
- typecheck: PASS
- production_build: PASS (repeated after the final dark-coral contrast adjustment)
- browser_regression: PASS, 81 checks; docs/validation/raphael-regression.json
- final review: server-rendered product modules; generator change limited to empty-state markup; protected API/routing/SEO/payment files unchanged

## REPRODUCING BROWSER CHECKS
Use the existing bundled Playwright runtime or set PLAYWRIGHT_RUNTIME to its package.json path. Start agent-browser, put its `get cdp-url` result in CDP_URL, and run:

```text
BASE_URL=http://localhost:3001 node scripts/verify-platform-redesign.mjs
```

The first pass expects an unconfigured local service. For isolated generation fixtures, stop that server, restart the same local dev service with process-only NEXT_PUBLIC_TURNSTILE_SITE_KEY=browser-regression-sitekey, and run the script with --fixture. The script intercepts quota, generation and Cloudflare requests in an isolated browser context. Never set that test key in production or an environment file. Stop the fixture server before the production build.

## GIT
- files_changed: four existing UI/style files; new HomePlatform, three original SVG illustrations, dedicated browser verifier, report, and baseline/final/phase-C screenshots
- commit: see final chat response and git history for this report
- push: origin/main; final response records the confirmed remote commit
- working_tree_after: tracked changes committed; pre-existing untracked AGENTS.md/CLAUDE.md preserved. A sandbox-generated %SystemDrive% directory is outside the staged change and is preserved.

## FINAL_STATUS
UI implementation and local regression complete. Production provider/real challenge verification remains unverified because local credentials are absent; this is not represented as a full live-production acceptance pass.