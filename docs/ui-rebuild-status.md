# Ovanto UI rebuild V1

Scope: `OVANTO_RAPHAEL_INSPIRED_UI_FUNCTIONAL_REBUILD_V1.md`. UI only; existing generation, upload, quota, account and payment APIs are retained.

## Implemented

- Seven existing routes use a shared `GeneratorWorkbench` with image, edit and video modes.
- Desktop input/settings and result preview share a two-column workspace; small screens stack them.
- Image routes accept prompts without upload. `/fr/photo-ia-gratuit` is an image generator.
- `/fr/modifier-photo-ia` retains upload, original image and before/after comparison.
- Video routes use a playable video result and show the existing fixed 5-second, 480p, one-per-day allowance.
- Prompt examples fill the input without submitting or replacing an uploaded image.
- Existing API submission, polling, idempotency, quotas and downloads remain. Errors can be retried; failed downloads expose the actual result URL.
- Pricing and paid-model selection are omitted from the shared MVP workspace. Existing payment code and API routes are retained.
- Title, Description, H1, H2, canonical, hreflang, FAQ questions and link matrix are preserved. Only FAQ answer text is synchronized with the visible answers, as explicitly authorized.
- `*.vercel.app` responses receive `X-Robots-Tag: noindex, nofollow`; `ovanto.ai` is unaffected.

## Pending, by user direction

The user confirmed that credentials are not configured and requested the implementable UI work first. Do not mark these items as accepted:

- Configure Replicate, FAL, Turnstile, Upstash and the IP hashing secret in the existing environment configuration.
- Run real image, image edit and video flows, including security verification, upload, provider completion, preview and download.
- Add 3–6 real Ovanto-generated images and 1–3 videos with their actual prompts. Current prompt examples are text inspiration, not claimed generation results.
- Browser visual and interaction verification at 320, 375, 414 and 768px. The browser automation runtime failed to start with `windows sandbox failed: helper_unknown_error: setup refresh had errors`.

## Validation

Latest local acceptance: production build passed, all seven routes returned HTTP 200, protected SEO/link/schema checks passed, and the existing 43 backend tests passed. The local preview is `http://localhost:3001/`. Browser visual and real-provider acceptance remain pending as listed above.

- `npm test`: existing backend regression suite.
- `npm run build`: production build and TypeScript checks.
- `BASE_URL=http://localhost:3001 npm run verify`: seven-page UI/SEO checks against the original commit, schema synchronization, internal link matrix and preview indexing policy. Results are recorded in `docs/validation/ui-rebuild.json`.
- `npm run verify:v4`: archived original v4 checks. These include superseded UI expectations (two upload pages, illustration examples and old trust points) and are not the new rebuild acceptance criteria.

No provider credentials, paid generation requests, fabricated generated media or production deployment are included in this UI change.
