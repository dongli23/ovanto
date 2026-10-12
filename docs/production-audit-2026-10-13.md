# Ovanto production audit — 13 October 2026

## Confirmed production behavior before changes

Isolated Chrome contexts with no account cookies or saved tier were used.
Real GET responses were read; generation, checkout, token verification and
provider submission were never executed.

| Page | Default model/tier | Hydrated free quota | Quota API |
| --- | --- | --- | --- |
| `/it/` | Wan 2.5 / Gratis | 1/1 | 200, available=true |
| `/video/` | Wan 2.5 / Free | 1/1 | 200, available=true |
| `/fr/` | Wan 2.5 / Gratuit | 1/1 | 200, available=true |
| `/` | Flux Schnell | 3/3 | 200, available=true |
| `/nl/` | Flux Schnell | 3/3 | 200, available=true |

The server-rendered quota placeholder is replaced after the client reads quota.
It is not evidence that Redis is unavailable. Existing account sessions with a
positive paid balance default to Paid unless a tier was explicitly chosen;
anonymous sessions default to Free. No quota or paid-tier logic was changed.

## Confirmed content/routing fixes

- Merge the overlapping Dutch image entry into `/nl/`. Both legacy forms of
  `/nl/afbeeldingen-maken-met-ai/` permanently redirect in one 301, retaining
  query parameters. Remove that legacy URL from internal links and sitemap.
  The canonical sitemap now contains 15 URLs (12 tool pages, 3 policy/pricing
  pages). Existing API paths and canonical trailing-slash behavior are preserved.
- Give video and photo-edit platform sections tool-specific localized models,
  workflows, benefits and reference captions in all four languages. Video copy
  describes Wan 2.5 free and Kling 2.5 Turbo Pro paid; edit copy describes Flux
  Kontext Dev and uploading an original. Static illustrations remain clearly
  labeled concept references. CTAs target the matching tool workspace.
- Pricing describes purchase through the English, Italian, French and Dutch
  video workspaces, with links to all four. Prices and payment behavior are
  unchanged.

## Google Search Console: direct first-party evidence

The authenticated Search Console resource `sc-domain:ovanto.ai` was read through
the browser, rather than inferred from an SEO plugin's imported datasets.

- Overview displayed 2 web-search clicks.
- Index report, last updated 9 October 2026: 8 indexed pages and 3 not indexed.
- Non-indexed categories: 1 redirecting page; 2 crawled but not currently indexed.
- Sitemaps report already contained `https://www.ovanto.ai/sitemap.xml`, status
  Success, with 10 discovered pages at its reported last read (11 October).
  The displayed submission date was 12 October.

These counters are Google's delayed reports, not the live sitemap count or a
promise that new URLs are indexed. The GSC Wizard connector was unavailable
because its subscription had expired. No evidence established whether the
Gefei plugin itself is authorized to import this property.

## Reproducible verification

- `npm test`, `npm run typecheck`, `npm run build`.
- `npm run test:ui`: API fixtures only; no live provider or payment calls.
- `npm run verify:multilingual`: public GETs, model-independent metadata,
  sitemap, legacy redirects and catalog/pricing consistency.
- `node scripts/audit-production-workspaces.mjs`: fresh browser contexts with
  real read-only quota/session requests; rejects mutation attempts and writes
  safe evidence to `.test-build/production-workspace-audit.json`.

This audit does not retest paid checkout or real media generation. No new
generation or provider request was created and no credits were consumed.
