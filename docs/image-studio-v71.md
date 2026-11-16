# TensorCat AI Image Studio V7.1

Historical report. Superseded by [V8.0](image-studio-v8.md), which removes the
Exhibit 02 physics system and replaces the upload flow. The V7 verification below
records the earlier local implementation, not the current UI or acceptance state.

Local engineering report, 2026-11-16. **Not deployed.** This is a verified local
physics/editor implementation with fail-closed cloud integration, not a claim
that five public AI services are operational.

## Fully Implemented and Tested

- Registry entry 02 and `/lab/ai-image-studio/`, retaining Exhibit 01 and the
  existing serialized gallery transitions. The gallery explicitly says
  “Local preview · cloud pending”. Cover is an actual local workspace capture.
- Dark Zola/Tera workspace; original header/preferences/cursor remain shared.
  No React, build-system migration, GPU host or package dependency was added.
- JPEG/PNG/WebP selection and internal pointer throwing; actual image decoding
  in the browser, signature/MIME/10 MB/8192px/16 MP checks. File selection itself
  sends no image bytes. Retry retains the local source.
- Cannon-es authoritative rigid-body solver, SI/Y-up world, responsive
  world-to-screen mapping, fixed 1/120 s advancement with bounded catch-up.
  High-DPI changes pixels, not world dimensions. Cannon uses semi-implicit
  integration; adaptive collision substeps bound ball travel below half a radius.
- Gesture launch estimation uses least-squares fitting of the last 100 ms of
  world-coordinate samples, ignores invalid samples and caps speed at 16 m/s.
  An immutable launch record owns initial position/velocity/angle. The assisted
  shot computes a ballistic launch and goes through the same collision/score path.
- Gravity `F_g=(0,-mg)`, linear aerodynamic drag `-k(v-v_air)`, no second arbitrary
  wind force, resultant external force, acceleration, kinetic and ground-referenced
  potential energy. Dissipation is never advertised as conservation.
- Velocity decomposition, signed angle arc, instantaneous vectors, gravitational
  acceleration/force, aerodynamic force, air velocity, resultant force and
  acceleration consume solver snapshots. Velocity/force/acceleration/impulse have
  independent SI display scales, documented in the inspector. Zero arrows vanish.
- Three separate paths: analytical gravity-only reference, cloned numerical
  collision-aware prediction (10 Hz maximum refresh), real recorded history.
  Apex is detected through the sign change of vertical velocity. Prediction does
  not mutate the live state and excludes flexible-net response.
- Bounded backboard and spherical rim contacts. Contact normal, incoming/outgoing
  velocities and collision momentum residual are recorded. The transient impulse
  is not mislabeled as a persistent force. Rim spring displacement updates both
  visible and collision geometry. It is a small quasi-static coupled approximation.
- A 42-node constrained net: upper nodes fixed, distance constraints, restoring
  springs, damping, wind and side-strand collisions. Lower nodes deform through
  contact/constraints. The center of the projected mesh is not a solid sheet.
- Swept downward crossing inside the radius-adjusted opening followed by net
  entry is necessary for score. Single scoring event, miss/retry handling.
- Pause, playback rates, one-step advance, read-only recording review, return to
  live, vertical-velocity graph and CSV of actual snapshots. Scrubbing cannot score.
- Local immutable original, bounded editing history, pan/zoom/fit/actual pixels,
  undo/redo/reset, aligned comparison control, PNG/JPEG/WebP export (JPEG white
  matte), alpha-compatible checkerboard, non-AI resize and background compositing.
- Source-coordinate paint/erase mask, adjustable brush size/hardness/opacity,
  bounded stroke-state undo/redo and clear. It does NOT pretend to erase objects
  without a model. Face reference/consent interface does NOT perform a face swap.
- Bilingual studio dictionary supplements the existing global preference store.
  Preferences do not remount the engine, clear images, or restart the rain.
  Fixed sidebar becomes a stacked mobile inspector. Reduced motion removes UI
  animation and code rain, not the numerical physics experiment.
- Atomic D1 quota statements tested against actual SQLite, with simultaneous
  request attempts. Three edit attempts per daily visitor hash, 1000 reserved
  neurons/site/day, 40 neurons reserved per bounded edit, 20 uploads/visitor/day,
  200 uploads/site/day. Reset is UTC. These are conservative local policy values,
  not an assertion about available account-wide quota.

## Implemented but Pending API Configuration

Pages Functions endpoints: `capabilities`, `quota`, `upload`, `edit`, `inpaint`,
`remove-background`, `upscale`, `face-swap` under `/api/image-studio/`.

Only `edit` has a candidate inference transport. Specialized endpoint adapters
return an honest unavailable response. The FLUX multipart binding transport is
contract-tested using isolated test doubles, **not live inference-tested**.

The upload state machine separates local selection, flight, score, upload attempt,
failure, acceptance and editor opening. XHR reports measured byte transfer only;
the indicator stays below 100 until a server acknowledgment. A failed transfer
can be retried without another shot. A separately labeled local-editor path never
increments the accepted counter. Valid server receipts authorize only the exact
accepted reference bytes; each successful AI output gets its own new receipt.

Images are processed ephemerally, with no R2 bucket, public image URL or image
database. Client reference preprocessing strips metadata, preserves aspect ratio
and limits the reference to 512px per side; original resolution remains local.
The cloud model output is not claimed to preserve original detail or resolution.

Security layers: same-origin POST checks, streaming request-size caps, strict image
signatures and trusted decoder contract, Turnstile action/hostname verification,
daily keyed IP hashes (no stored raw IP), HMAC receipts with expiry and visitor
binding, idempotent quota reservations, conservative settlement even after
provider failure/timeout, 45-second inference timeout and no alternative model.
No image/face data is logged. Blob URLs and image buffers are released on disposal.

A successful solver score is UX gating, **not an anti-bot authentication proof**:
clients can forge a score header. Turnstile and server quotas provide the actual
abuse controls. API calls are disabled without the required server bindings.

## Blocked by Free-Tier or Licensing Restrictions

See [feasibility audit](image-studio-feasibility.md) for official sources and
verification date. FLUX is not activated without account free-plan and live-model
verification. No sustainable authorized free provider was established for
mask-aware inpainting, background removal, AI upscaling or face swap. Their buttons
remain disabled; local alternatives are explicitly labeled non-AI. No credits,
paid plan, provider license or security permission was activated.

## Not Yet Implemented / Limits

- A trusted production `IMAGE_VALIDATOR` decode service has **not** been supplied.
  It must enforce pixel/dimension limits before allocation and fully decode safely.
  Therefore real public upload acceptance is blocked, not quietly weakened to
  header-only inspection. Browser decoding is real but not a substitute for this.
- Turnstile/Workers AI/D1 bindings and actual provider calls have not been tested
  in the Cloudflare runtime. Network acceptance/provider contract tests use clearly
  isolated test doubles, never a public mock API. No public deployment occurred.
- No live face detection/selection, specialized inference transport, edge-matting
  model, 3D ball rotation, full volumetric net, exact future net simulation, or
  graphical force charts beyond the vertical-velocity graph.
- Mask undo uses source-size image snapshots with a memory-dependent history cap;
  this is heavier for large images. Image history holds at most nine states.
- Cloud edits start from the accepted reference or most recent cloud result, not
  arbitrary local resize/composite states. The candidate adapter requests a 512px
  square output; before enabling it, confirm native aspect-ratio behavior and
  improve comparison registration for changed model output aspect ratios.
- No guaranteed-score prediction; rim/net contacts can change actual outcomes.
  The net is a CPU-friendly 2D approximation, not calibrated basketball mechanics.
- No asserted FPS/performance result. Physical 120 Hz and text 12.5 Hz are update
  targets, not measured display refresh guarantees. Native Safari/iPhone hardware,
  VoiceOver, real trackpad gestures and live-provider latency remain untested.

## Verification Executed

- 197 Node tests (164 existing + 33 new): deterministic trajectories, vectors,
  forces, units, collision normals/impulses, no tunneling at the clamped speed,
  downward-only score, net damping/wind, reset, non-mutating prediction, 30/60/120Hz
  frame scheduling, file/upload gates, receipt integrity, source coordinate mapping,
  provider contracts, unavailable bindings, concurrency/idempotency/daily quotas.
- Existing six-experiment, hardware renderer, navigation, gallery lifecycle and
  preference tests included in that run. One old single-exhibit-count assertion
  was updated to require the two real routes; no original simulation tests removed.
- Browser: real PNG/JPEG/WebP selection, invalid Markdown rejection, scored shot
  with accepted count remaining zero when cloud unavailable, local editor opening,
  2x resize to 2880×1620, undo to 1440×810, redo, comparison slider, mask drag,
  actual PNG download verified as RGBA, bilingual paused-state preservation,
  1440px/390px no page overflow, gallery 01→02→01 transitions and dark Lab under
  saved Light preference. Physics canvas had 337 non-background samples on a
  960×575 backing canvas using a sparse stride-128 pixel check.
- `zola check`, `zola build`, generated localization validation and unique IDs.
  22 built HTML pages; 417 shared bilingual messages plus studio-specific pairs.
- Screenshots: `docs/qa/image-studio/desktop.jpg` and `mobile.jpg`.

## Local Preview

```sh
cd /Users/kevin/PycharmProjects/TensorCat/ray-kevin-portfolio
zola serve --interface 127.0.0.1 --port 1111
# Separate terminal: actual Pages handlers, intentionally empty cloud bindings
node tools/preview-image-studio.mjs
```

Open http://127.0.0.1:1112/lab/ai-image-studio/ . The helper does not simulate
successful upload or AI responses. Zola-only preview also works on port 1111,
but its server does not execute Pages Functions.

## Production Prerequisites

1. Review the local exhibit and this report. Do not push main merely to test it:
   this repository's main branch triggers an existing public Pages deployment.
2. Keep all three inference flags unset/false until verified:
   `STUDIO_AI_ENABLED`, `STUDIO_FREE_PLAN_CONFIRMED`, `STUDIO_MODEL_VERIFIED`.
3. Verify Workers **Free** plan, current model license/schema and shared account
   neuron usage. Do not enable a paid plan. The site budget is not an account-wide
   budget coordinator; the free account hard stop remains necessary.
4. Provision a separate `STUDIO_DB`, then apply
   `migrations/studio/0001_reservations.sql`. Do not repurpose the likes `DB`.
5. Add a private `IMAGE_VALIDATOR` service binding. Contract: `POST /decode`, raw
   image bytes plus Content-Type; return `{decoded:true,type,width,height}` only
   after a successful bounded full decode. No image storage/logging. Review its
   resource/billing behavior; no such service is provisioned automatically here.
6. Configure `TURNSTILE_SITE_KEY` (public), `TURNSTILE_SECRET` (encrypted),
   `STUDIO_SECRET` (encrypted, >=32 random characters) and the `AI` binding. Never
   put secrets into `config.toml`, JavaScript, Git or local storage.
7. Verify a real upload, malformed/decompression-bomb rejection, failed-network
   retry, Turnstile failures, real inference/output decode, native aspect-ratio
   behavior, concurrent requests, account quota enforcement and privacy handling
   in an appropriately isolated environment. Set `STUDIO_MODEL_VERIFIED=true`
   only after actual success; contract mocks do not satisfy this gate.
8. Inspect D1 states and prune daily-hash records after a documented retention
   period (for example seven days). No automatic retention job is installed.
9. Only then enable the verified provider and request public release. Other tools
   remain unavailable unless separately verified under sustainable free terms.

## File Ledger

New: `content/lab/ai-image-studio/_index.md`, `templates/image-studio.html`,
`static/styles/image-studio.css`, six ES modules under `static/js/image-studio/`,
three helpers under `functions/_studio/`, catch-all Pages handler under
`functions/api/image-studio/`, dedicated SQL migration, two new test suites,
local preview helper, actual cover capture, two Lucide assets with existing license,
feasibility/report documents and QA screenshots.

Modified: `data/exhibits.toml`, `data/locales.json`, generated JS locale catalog,
`templates/base.html` (new route title only), gallery/index preview templates,
`tests/lab-exhibition.test.mjs` (two-exhibit route contract), and README.
No Exhibit 01 engine, hardware, experiment, code-rain or cursor source was changed.
