# Ovanto.ai — v4

Authoritative specification: [docs/ovanto-brief-v4.txt](docs/ovanto-brief-v4.txt). Phase 1 is accepted. Phase 2 awaits external acceptance. Phase 3 publishes only `/it/` after supplier billing and production Redis checks; other pages remain local until their phases are approved.

Seven SSR pages preserve approved metadata, headings, URLs, hreflang, trust copy and internal anchors. The two French inner pages use original-image upload and Kontext editing; the other five pages have no upload control. Fonts are self-hosted. Robots and sitemap remain withheld until Phase 6.

## Local verification

```text
npm run typecheck
npm test
npm run build
npm run start -- --port 3001
```

Run `npm run verify` with `BASE_URL=http://localhost:3001`. It reads v4 and writes `docs/validation/seo-v4.json`. Tests execute actual Redis Lua in a local Redis-command simulation and payment SQL in PGlite; neither replaces production Redis/PostgreSQL acceptance.

## Models and limits

| Tier / kind | Provider model | Allowance / expected upstream cost |
| --- | --- | --- |
| Free image | Replicate `black-forest-labs/flux-schnell` | 3/IP/UTC day; $0.003 |
| Free edit | Replicate `black-forest-labs/flux-kontext-dev` | 1/IP/UTC day; ~$0.023 |
| Free video | FAL `fal-ai/wan-25-preview/text-to-video` | 1/IP/UTC day; 5s / 480p; $0.25 |
| Paid image | Replicate `black-forest-labs/flux-dev` | $0.025 |
| Paid edit | FAL `fal-ai/flux-pro/kontext` | $0.04 |
| Paid video | FAL `fal-ai/kling-video/v2.5-turbo/pro/text-to-video` | Fixed 5s; $0.35 upstream; retail $0.99–1.49 |

Free requests require Turnstile and trusted deployment IP/country. IN/RU receive no free quota. Atomic inflight reservations cover independent $3 image, $2 edit and $5 video pools plus a separate $10 total cap. At $0.023, 86 edits fit the $2 pool; the 87th is rejected. Paid credits bypass free pools and free region exclusions. Model, duration, resolution and prices are server-owned. Watermark defaults off.

Uploads accept JPEG/PNG/GIF/WebP up to 10,000,000 bytes. Browser bytes go directly to a signed FAL CDN upload URL. Completion checks ownership, actual MIME, magic bytes and image decode, then copies validated bytes to a separate server-owned CDN object. No image is written to local disk. Assets expire after one hour. Technical protection limits uploads to 5 files and 50 MiB per IP per ten minutes.

## Guest payments and passwordless access

Stripe Hosted Checkout collects email and card. A verified webhook credits the order and associates the email account in one PostgreSQL transaction, with event/session deduplication. The returning browser initially receives access only to its order; full account access requires email activation or an eight-digit login code. A guest entering another person's email cannot claim that person's previous credits.

The encrypted email outbox supports retries with Resend idempotency keys. Paid generation reserves one credit before supplier submission. Confirmed rejection releases it once; uncertain submission preserves the reservation and idempotency key for reconciliation. Recorded costs are expected costs, not verified supplier charges.

Configure `.env.example` locally and apply `scripts/sql/001_payments_accounts.sql` to the selected database before enabling checkout. Checkout stays disabled when configuration/prices are absent. Image/edit retail prices await confirmation. No database, mail service or deployment has been provisioned; no real generation, payment or email has been sent.

## External acceptance

Run one real free image, edit and video; compare each supplier charge with the brief, then reconcile the day's supplier bills against request records. Verify the 4th image, 2nd edit and 2nd video rejection and independent pool breakers on production Redis. Any billing mismatch stops launch. Measure performance targets on the deployed Italian page.
