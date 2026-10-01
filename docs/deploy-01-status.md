# OVANTO-DEPLOY-01 status

Date: 2026-10-01  
Project: ovanto.ai  
Status: **PENDING external configuration and production evidence**

This file records the execution boundary for the AI model integration closeout. It intentionally contains no API keys, tokens, Redis URLs, prediction IDs, or fabricated generation results.

## Required environment variables

The owner must configure these in the server-side production environment before any real generation is attempted:

| Variable | Required scope | Status |
| --- | --- | --- |
| `REPLICATE_API_TOKEN` | Server only | PENDING owner configuration |
| `FAL_KEY` | Server only | PENDING owner configuration |
| `TURNSTILE_SECRET_KEY` | Server only | Configured in production and preview; verification pending |
| `IP_HASH_SECRET` | Server only, IP hashing | PENDING owner configuration |
| `UPSTASH_REDIS_REST_URL` | Server only, independent Redis service | PENDING owner configuration |
| `UPSTASH_REDIS_REST_TOKEN` | Server only, Redis authentication | PENDING owner configuration |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Browser site-key only | Configured in production and preview; verification pending |

As of the latest 2026-10-01 Vercel project environment check, **2/7 required variables were configured** in production and preview (the two Turnstile entries). The other five remain absent. No `REDIS_URL` exists on Vercel. Values were not printed or copied into this repository.

`IP_HASH_SECRET` is required for production IP hashing and must never be exposed through a `NEXT_PUBLIC_` variable. `REDIS_URL` is a prohibited legacy name: the application must neither create nor read it. It remains in the audit denylist only so an accidental old configuration is detected. `TURNSTILE_HOSTNAME` is retained as a legacy/compatibility name for audit coverage; it is not counted in the seven required variables above.

All server-sensitive names must not use a `NEXT_PUBLIC_` prefix and must not be embedded in client source or serialized browser artifacts. The audit covers both current sensitive names and replaced provider names (`REPLICATE_API_KEY`, `FAL_API_KEY`). The official Upstash URL and token names remain unchanged. Run the following after the final production build:

```text
node scripts/audit-client-secrets.mjs
```

The audit scans every file under `.next/static`, serialized App Router output, and client/build manifests. It reports relative paths and counts only. A non-zero artifact or client-source hit is a release blocker. The static audit deliberately reports the compiler dependency graph as `not-inferred`; it does not claim a complete Next.js graph proof.

## External acceptance evidence

Real provider calls and billing-console checks are intentionally pending. No test order, prediction, request ID, or cost is invented here.

| Task | Provider | Prediction / request ID | Expected cost | Actual cost | Status |
| --- | --- | --- | ---: | ---: | --- |
| `image.free` | Replicate | PENDING | $0.003 per image | PENDING billing evidence | NOT RUN |
| `edit.free` | Replicate | PENDING | $0.023 estimate per image | PENDING GPU-time billing evidence | NOT RUN |
| `video.free` | FAL | PENDING | $0.25 per 5-second video | PENDING billing evidence | NOT RUN |

The expected values in the production model configuration are checked by `tests/deploy-contract.test.ts`; provider-console actuals must still be recorded after each real generation and reconciled before release.

## Redis and circuit-breaker evidence

Production Redis connectivity and atomic reservation behavior remain pending. The following cases must be exercised against the production Redis instance after configuration:

| Check | Expected result | Evidence |
| --- | --- | --- |
| Same IP, fourth `image.free` request | Blocked after 3/day | PENDING |
| Same IP, second `edit.free` request | Blocked after 1/day | PENDING |
| Same IP, second `video.free` request | Blocked after 1/day | PENDING |
| One pool reaches its daily cap | Only that free pool stops | PENDING |
| Overall daily cap reaches `$10` | All free pools stop | PENDING |
| Upstream failure | Reserved quota is rolled back | PENDING |
| Concurrent requests | Redis atomic protection prevents bypass | PENDING |

## Local validation tooling

`tests/deploy-contract.test.ts` dynamically loads `src/lib/models.ts` when that production configuration exists. It validates the six model entries, provider/unit/cost fields, fixed five-second video settings, the explicit `video.paid.price` of `$0.99` for a full five-second generation, and the absence of paid-model references in client source. Optional `price` fields for image/edit remain intentionally unasserted pending owner confirmation; a present value must still be numeric or `null`. If the model file has not yet been created, the contract test is reported as an explicit skipped/pending test rather than a false pass.

The client-secret audit and model contract test do not call Replicate, FAL, Turnstile, Redis, Stripe, or any paid endpoint. They must be rerun after the final implementation build and before deployment.

The final local build passed. The complete automated test suite passed 62/62 tests. The expanded secret audit scanned 169 browser-facing build files with zero matches, plus direct client-source and forbidden public-prefix checks with zero matches. Seven-page HTTP validation also found zero sensitive-name matches in returned HTML/Flight payloads. These checks do not replace real provider billing or production Redis acceptance.

`video.paid.price` is $0.99 per complete generation and remains separate from `cost: 0.07` per second. Image/edit price fields await owner confirmation. Free budget accounting reads procurement cost, never customer price.

Payment behavior remains closed: local `/api/stripe/catalog` returned HTTP 200 with `enabled: false` and no products; `/api/stripe/checkout` returned HTTP 503 with `PAYMENT_CONFIGURATION_UNAVAILABLE`. Checkout/webhook code, switches, and retail-price calculation were not changed. Payment/provider regression tests passed.

## Seven legacy fixes

| Item | Status | Evidence / remaining work |
| --- | --- | --- |
| 1. Same-language tools-summary links | COMPLETE | Seven-page HTTP checks pass; unavailable language/task links are hidden |
| 2. Workbench modes | COMPLETE | Real anchors with matching routes; no mode-switch buttons |
| 3. Video price trust point | COMPLETE | IT/FR third trust point matches the supplied exact price text |
| 4. Future video-price prose | COMPLETE | Authorized IT/FR neutral price copy; no future/unavailable wording |
| 5. Third video FAQ | COMPLETE | Daily free quota plus extra-generation price; FAQPage synchronized; all three answers remain distinct |
| 6. Quota-label | PARTIAL | Separate quota-only label; shows unknown while config is absent; production remaining counts need verification |
| 7. Inner-page trailing-slash normalization | PENDING | Await exception to the instruction protecting canonical/sitemap; current SEO configuration preserved |

After the authorized copy changes, the fresh production build passed and the expanded secret audit again reported zero matches across 169 browser artifacts. Seven-page HTTP verification has zero failed assertions, but exits non-zero because the three inner-page trailing-slash corrections are still pending. Protected Titles, Descriptions, H1/H2, locale, seven routes, existing schema scope, robots, sitemap, same-language links, quota-label structure, video copy and FAQ checks pass.

## Decisions and external prerequisites still required

- Confirmation that the three inner-page canonical/sitemap corrections are an exception to the protected SEO configuration rule.
- Image/edit customer price placeholders or exact prices.
- Failure accounting: the requested policy for quota refunds with uncertain upstream billing remains awaiting a reply. Existing uncertain submission and asynchronous failure paths still retain the quota; this boundary is not yet complete.
- Configure the seven variables and register both Turnstile hostnames, then perform three real generations, production quota/pool checks, and per-request provider billing reconciliation.

The owner authorized Git publication of the implemented scope on 2026-10-02. This publication does not mark the work order or external acceptance complete. Vercel may deploy automatically from the Git push; live generation and billing are still unverified. Evidence is recorded in `docs/validation/deploy-01-client-secrets.json` and `docs/validation/deploy-01-local.json`.

To run the contract test without changing the repository test runner, bundle this standalone test into the ignored `.test-build` directory and execute it:

```text
node -e "require('esbuild').buildSync({entryPoints:['tests/deploy-contract.test.ts'],outfile:'.test-build/deploy-contract.test.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',sourcemap:false,logLevel:'silent'})"
node --test .test-build/deploy-contract.test.cjs
```

