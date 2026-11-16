# Image Studio Production Deployment

Release authorized by the owner on 2026-11-16. This ledger separates deployed
website code from actual AI service readiness. V8 UI acceptance is recorded in
[the engineering report](image-studio-v8.md).

## Release Preparation

- Existing GitHub `main` and Cloudflare Pages project `kevinrayscott` retained.
  No domain, audience, framework, likes database or Exhibit 01 changes.
- 195 portfolio/API tests and 5 real WASM decoder tests passed.
- Wrangler compiled Pages Functions and the standalone decoder Worker.
- Local workerd handled a real PNG `/decode` request successfully.
- Cloud references are capped at 504px per side, strictly below the documented
  FLUX reference-image boundary of 512px. Output stays fixed at 512x512, keeping
  the existing 40-neuron reservation conservative under the audited price table.
- Interactive challenge timeout increased to 120 seconds, allowing a visitor time
  to complete a challenge instead of timing out after 20 seconds.

## Private Decode Service

`workers/image-validator/` contains the service. It has no public Worker route,
workers.dev endpoint, preview URL, storage, logging or outbound image requests.
It accepts only POST `/decode` through `IMAGE_VALIDATOR` service binding. The
runtime enforces a roughly 1 MiB stream cap, checks headers before allocation,
rejects dimensions over 512px, fully decodes with pinned Photon WASM 0.4.0,
checks decoded dimensions and releases each native image allocation.

This cap applies to small cloud references/results, not local originals. Local
editing retains the original 10 MiB / 16 MP browser limits. This is actual full
decode, not Cloudflare Images metadata inspection or a successful header check.

```sh
npm ci --prefix workers/image-validator --ignore-scripts
node --test workers/image-validator/test/*.test.mjs
wrangler deploy --config workers/image-validator/wrangler.jsonc
```

Photon uses Apache-2.0 licensing, with source and package provenance in its lock
file. No Cloudflare Images transformation or billable decode API is used.

## Required Cloud Resources

- Dedicated D1 `STUDIO_DB` with `migrations/studio/0001_reservations.sql`.
- Private Worker `tensorcat-image-validator` bound as `IMAGE_VALIDATOR`.
- Workers AI binding `AI`, restricted by application code to the pinned model.
- Turnstile widget restricted to the portfolio hostname, action `image-studio`.
- Public `TURNSTILE_SITE_KEY`; encrypted `TURNSTILE_SECRET` and `STUDIO_SECRET`.
- `STUDIO_AI_ENABLED`, `STUDIO_FREE_PLAN_CONFIRMED`, `STUDIO_MODEL_VERIFIED` may
  become `true` only after account, model and production validation are recorded.

Preserve all existing Pages bindings and environment variables when adding these.
Never reassign the blog likes `DB`. Preview deployments must remain disabled for
inference unless separately reviewed. No secret belongs in source or screenshots.

## Authentication Recovery

The cached Cloudflare CLI token expired and refresh failed. Chrome currently
requires Cloudflare sign-in. The owner was asked to log in directly; no password,
verification code or API secret was requested in chat.

The owner completed sign-in and the official Wrangler authorization. Credentials
remain in Wrangler's local credential store, not source or logs.

## Verified Cloud Configuration

- Cloudflare Billing explicitly showed `Workers Free / Active`; no upgrade or
  billing method was added.
- Private decoder deployed successfully, version
  `f4177334-99e1-4676-9efb-7b808aad0747`, with no public targets.
- Dedicated `tensorcat-image-studio` D1 created and its migration applied. Existing
  `kevinrayscott-likes` / `DB` retained unchanged.
- Managed Turnstile created for `kevinrayscott.pages.dev`, with no clearance grant.
- Production Pages bindings `AI`, `STUDIO_DB`, `IMAGE_VALIDATOR` and encrypted
  secrets configured. Existing `ZOLA_VERSION` and likes binding preserved.
- A real authenticated FLUX edit used only the public 400x400 TensorCat logo,
  seed 42 and 512x512 output. It returned a 69,438-byte JPEG in 3471 ms. The output
  fully decoded through Photon as 512x512; visual inspection confirmed the actual
  logo on a sage background. This was real inference, not a test double.
- After the Free plan and live model check, the three production enable flags
  were set to `true`. Preview configuration has no AI bindings or secrets.

The four specialized providers remain unavailable under the audited recurring
free-use/licensing constraints; their controls must not imply operational AI.
The first model test used the REST transport. Production Pages service binding,
Turnstile and browser round-trip validation are separate release checks below.

## Sources

- [FLUX model and schema](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/)
- [FLUX reference input requirements](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/)
- [Workers AI pricing and Free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Photon author documentation](https://github.com/fineshopdesign/cf-wasm/tree/main/packages/photon)
- [Turnstile verification](https://developers.cloudflare.com/turnstile/get-started/)

These documents establish supported contracts, not account entitlement or a
successful live request. Production results must be recorded separately below.

## Production Release Checks

- Commit `3c66d1089ee7152fff071262860134c084035c59` pushed to GitHub `main`.
  Cloudflare deployment `7a6e9452-0346-4db1-a3a4-31af4d398650` completed its
  deploy stage successfully at 2026-11-16 07:10:17 UTC.
- Production `/api/image-studio/capabilities` reports `upload:true` and
  Generative Edit `EXPERIMENTAL`; specialized services remain unavailable.
- Production `/api/image-studio/quota` returns 3 remaining requests and UTC reset.
- Cross-origin upload is rejected with HTTP 403 before image processing.
- The original blog likes endpoint still returns the existing public count (149
  for the moving-number strategy note); the likes binding was not changed.
- Browser opens the public Studio, loads the public TensorCat logo locally,
  shows real quota/provider state and enables processing only after consent.
  No image was sent by selection. A stale provider explanation was identified
  and corrected; zero remaining quota also disables processing after refresh.
- Current automated suite: 196 portfolio/API tests plus 5 native-WASM tests,
  all passed. Zola production build, localization (22 HTML pages) and Pages
  Functions compilation passed.
- Final browser Turnstile/inference round trip requires the owner's explicit
  CAPTCHA confirmation. It is not yet reported as passed. The independent
  authenticated provider test above did pass; it does not substitute for this.
