# Multilingual workspace consistency

All four supported locales expose image, video and photo editing through the same workspace and site shell. Locale switching maps the selected tool to its equivalent page rather than falling back to a locale homepage with a different tool.

| Locale | Image | Video | Edit |
| --- | --- | --- | --- |
| English | `/` | `/video/` | `/edit/` |
| Italian | `/it/immagini-ai/` | `/it/` | `/it/modifica-foto-ai/` |
| French | `/fr/photo-ia-gratuit` | `/fr/` | `/fr/modifier-photo-ia` |
| Dutch | `/nl/` | `/nl/ai-video-maken/` | `/nl/foto-bewerken-ai/` |

Existing paths remain available, including `/nl/afbeeldingen-maken-met-ai/`. Canonicals identify the current page. Language alternates identify equivalent tools. The sitemap includes all 13 tool pages.

## State and safety

Full document navigation preserves correct server-rendered language and metadata. Same-tab session storage retains the prompt, explicit video tier choice, validated edit upload, accepted task identity and completed result. Restoring does not submit or poll automatically. A pending task resumes using its existing GET endpoint, including when its last paid credit has already been reserved. A deliberate new generation after completion receives a fresh idempotency key.

State is versioned, bounded, isolated by tool and validated against existing output/upload URL rules. It does not store account credentials, balances, cookies, Turnstile tokens, IP data or provider keys. Storage failures leave the app usable but prevent state retention. Result/source URL expiry still applies.

Provider models, prices, payment fulfillment, free limits and generation endpoints remain unchanged. The only payment configuration change is adding the two new video workspace paths to the existing exact checkout-return allowlist. Pricing availability now reflects the same server configuration as the public catalog.

## Verification

- `npm test`: 138 passing unit/regression tests.
- `npm run typecheck`: passed.
- `npm run build`: passed with Next.js 16.3.8.
- `npm run audit:client-secrets`: no matches in 234 browser artifacts.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities after compatible Next.js and source-map-js security patches. Existing test-only Fengari/sprintf-js advisories remain without an available fix.
- `npm run test:ui`: 34 browser cases cover desktop/mobile layout across the locale/tool matrix, language navigation, drafts, tiers, legacy routes, upload/result retention, download and accepted-task recovery. All API calls are intercepted. One intentional new-variation POST is fulfilled locally; no live task is created.
- `npm run verify:multilingual`: public GET-only HTTP checks cover all 13 tool pages, canonical/hreflang, complete tools/sections, sitemap and catalog/pricing consistency. Writes `.test-build/multilingual-http-verification.json`.

For local browser checks, build first and run the production server with a public test site key in the test process, then run `npm run test:ui`. The test intercepts the Cloudflare script and API calls; no live verification or provider calls occur. This does not change `.env.local` or Production configuration.

```powershell
npm run build
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA'
npm run start -- -p 3100 -H 127.0.0.1
# Separate terminal:
npm run test:ui
```

To run the same mocked UI checks against the deployed pages:

```powershell
$env:OVANTO_UI_TEST_BASE_URL = 'https://www.ovanto.ai'
npm run test:ui
npm run verify:multilingual
```

Browser checks use installed headless Chrome in an isolated context. No owner session is accessed. These checks verify UI/routing/state behavior; they do not revalidate provider billing or real generation.
