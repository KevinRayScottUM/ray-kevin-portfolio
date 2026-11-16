# TensorCat AI Image Studio V8.0

Engineering report, 2026-11-16. This records the original local V8 acceptance.
Subsequent authorized cloud configuration and publication are tracked separately
in [the deployment ledger](image-studio-deployment.md). No paid plan is used.

## Scope and File Ledger

The V7.1 basketball implementation was present as uncommitted local work. V8
removes it, rather than retaining a hidden simulator. Exhibit 01 runtime, geometry,
cartridges, input, physics, exports and source modules were not modified.

Deleted from the V7 working implementation:

- `static/js/image-studio/physics.js`: solver, score detection, net/rim contacts,
  prediction, trajectories, playback and mechanics exports.
- `static/js/image-studio/render.js`: physical stage, vectors, basket/net graphics,
  coordinate overlays and shot interaction.

Replaced or modified:

- `templates/image-studio.html`: actual upload/editor workspace, five-tool rail,
  contextual inspector, history, comparison, export and mobile disclosure.
- `static/styles/image-studio.css`: dark responsive workspace and motion styling;
  obsolete physical stage/inspector styles removed.
- `static/js/image-studio/{studio,files,editor,messages}.js`: image lifecycle,
  lazy editing, validation, local tools and complete studio EN/zh-CN labels.
- `functions/api/image-studio/[[path]].js`: removes the game-score header check;
  keeps security, validation and quotas.
- `tests/image-studio.test.mjs`: replaces physical tests with image lifecycle,
  validation, transfer, motion, localization and removal tests.
- `tests/image-studio-server.test.mjs`: accepts valid authorized uploads without
  the removed score header; retains backend contract/concurrency coverage.
- `data/exhibits.toml`, `content/lab/ai-image-studio/_index.md`,
  `data/locales.json`, generated `static/js/locales/catalog.js`: image-focused
  metadata and descriptions. The cover is a real 1262x660 workspace capture.
- `README.md`, `docs/image-studio-feasibility.md`, `docs/image-studio-v71.md`:
  current guidance and explicit historical-report labeling.

Added in V8:

- `static/js/image-studio/session.js`: versioned image selection, explicit transfer
  state machine, nested drag-depth handling.
- `static/js/image-studio/motion.js`: thumbnail-to-canvas shared-element animation.
- Lucide `eraser`, `scan`, `scan-face`, `undo-2`, `redo-2` SVG assets in
  `static/img/lab/icons/`, under the existing Lucide license.
- This report and real browser captures in `docs/qa/image-studio-v8/`.

No new runtime dependency was added. Exhibit 02 no longer imports cannon-es,
Three.js or any physical loop. Vendored libraries remain because Exhibit 01 uses
them. Shared header/gallery changes and the Pages backend added during V7 remain;
they were not discarded by this refactor.

## Upload and Motion Architecture

The lifecycle is `EMPTY -> DRAGGING -> VALIDATING -> LOCAL_IMAGE_READY -> EDITING`.
Browse Files, external file drop and image paste share the same selection path.
Nested drag-enter/leave events are counted to avoid boundary flicker; window
drop/end/blur clear the feedback. Drag glow and scale use 260 ms easing. The
pointer only updates highlight coordinates; it does not start a render loop.

Selection versions protect asynchronous decoding and bitmap cloning. A newer
selection wins, stale bitmaps close, obsolete failures cannot overwrite a newer
image, and disposal invalidates pending work. A failed replacement keeps the
existing image/history. The editor ES module loads only after validation.

The actual selected image becomes a small decoded thumbnail near the drop point
or upload center. A 580 ms Web Animations transform carries it into the aspect-fit
canvas bounds, with a restrained settling scale. The canvas fades in during the
same timeline; the upload surface fades out. There is no blank full-page overlay
or header fade. A new selection, preference change or disposal cancels the prior
flight and releases its object URL. Reduced motion shows the image directly.
The obsolete upload surface becomes inert and aria-hidden after selection.

## Validation and Local Editing

- Supported: PNG, JPEG and WebP, maximum 10 MiB, 8192px per side, 16 million pixels.
- Signature and MIME agreement are required; no SVG, remote URL or arbitrary data
  input. Known header dimensions are checked before native bitmap allocation.
- Browser decoding is real, with EXIF orientation. Empty, corrupt, unsupported,
  overlarge or mismatched input yields a localized error and permits retry.
- Local decoding is not claimed as a replacement for server-side trusted decode.

The original bitmap remains immutable. The editor draws only when image state,
pointer input, controls or size changes. Pan/zoom, fit, actual pixels, image
undo/redo/reset, before/after, source-coordinate mask paint/erase, hardness,
opacity, mask history and clear are real local operations. The original is
contained, not stretched, when comparing to a differently shaped result.

Standard resize (2x/4x) and solid-color compositing are explicitly non-AI. Resize
obeys output limits. Masks do not pretend to remove an object without inference.
PNG/WebP preserve existing alpha; JPEG uses a white matte. Export preserves source
or edited resolution, not the scaled on-screen canvas.

## AI, Privacy, Security and Quotas

Five tool interfaces remain: Generative Edit, Object Eraser, Background Removal,
Image Enhancement and Face Swap. Each opens only relevant settings and reports
real capability status. Face-reference and permission controls are an interface,
not a working face detector or face-swap model.

Only Generative Edit has a candidate pinned FLUX multipart adapter. It was tested
with isolated transport doubles, not real inference. Four specialized transports
remain unavailable. No provider is silently replaced, no paid fallback is used,
and no unavailable button is reported as functional AI.

Local selection, preview, masks and export never POST image contents. Explicit AI
invocation requires consent and capability availability. Only then is the current
edited image prepared as a metadata-free, aspect-preserved PNG reference with a
maximum side of 512px. A SHA-256 hash reuses a receipt only for matching bytes;
changed local state requires a new accepted reference. The original stays local.

Transfer states are `TRANSFERRING`, `SERVER_ACCEPTED` and `TRANSFER_FAILED`.
Measured XHR byte progress stays below 100 until an accepted response with a valid
receipt. Inference is indeterminate, not a fake percentage. Failure retains the
local file and allows retry. A preview is never described as a server upload.

Preserved backend components:

- `functions/_studio/security.js`: same-origin POST, streaming body caps, image
  signature plus trusted bounded full-decode contract, Turnstile action/hostname,
  daily keyed visitor hashes, expiring visitor/image-bound HMAC receipts.
- `functions/_studio/quota.js` and `migrations/studio/0001_reservations.sql`:
  atomic D1 reservations, idempotency, UTC reset and conservative failed-attempt
  consumption. Policy limits: 3 edits/visitor/day, 1000 reserved neurons/site/day,
  40 reserved per edit, 20 uploads/visitor/day and 200/site/day. This is a local
  site budget, not a verified account-wide free-tier allocation.
- `functions/_studio/providers.js`: pinned model, bounded output, timeout and
  fail-closed unavailable services. No images, prompts or faces are logged/stored.

Production remains blocked until `IMAGE_VALIDATOR`, `STUDIO_DB`, Turnstile secrets,
`STUDIO_SECRET`, `AI`, free-plan verification and explicit enable flags are supplied
and live-tested. Keep `STUDIO_AI_ENABLED`, `STUDIO_FREE_PLAN_CONFIRMED` and
`STUDIO_MODEL_VERIFIED` unset/false. See the V7 report's production checklist and
the provider feasibility audit. No account or billing settings were changed.

## Layout, Language and Performance

The shared header, TensorCat pointer, route transitions and Lab gallery remain.
Lab always uses dark appearance even with a saved Light portfolio preference.
All studio labels, statuses, errors, tool settings and exports have English and
Simplified Chinese entries. Switching language retains image/history/masks.

Desktop uses a compact tool rail, large central canvas and contextual inspector.
At phone/tablet widths tools scroll horizontally and settings become a measured,
keyboard-operable disclosure; opening/closing does not reset edits. Empty state
has no inspector track. No page sections are decorative nested cards.

Matrix rain is one independent 10 Hz timer and one canvas. Reading areas are
masked; switching tool or image does not restart the rain. Hidden documents stop
the timer; reduced motion hides it and bypasses large UI animations. There is no
editor idle RAF, physical runtime, second simulation or GPU/AI call on entry.
Object URLs, bitmaps, observers, challenge callbacks and listeners are disposed.

## Verification Actually Executed

- 194 Node tests passed: 164 existing portfolio/Exhibit 01 tests plus 30 current
  image-studio tests. This includes all six original robotics tasks, hardware
  rendering, gallery lifecycle, navigation, preferences, file/motion state,
  stale selection, signature/size limits, source-mask coordinates, receipts and
  real SQLite concurrent quota reservations. Provider contracts use test doubles.
- Browser on the actual local preview handler: PNG and WebP local selection,
  JPEG replacement; immediate editor, immutable original, 2x resize from
  1049x1499 to 2098x2998, image undo/redo, comparison at 50%, real pointer mask
  stroke, mask undo/redo/clear, all five contextual inspectors, invalid Markdown
  rejection without losing edits, translated error with history retained.
- Actual PNG (1049x1499 RGBA), JPEG (2098x2998) and WebP downloads, identified
  from file signatures rather than a UI success label.
- Network observation for local PNG selection: lazy editor module GET and local
  blob image only; no image POST or external provider call.
- Layout checks at 390, 768, 1280 and 1440 CSS pixels: document overflow zero.
  Phone inspector opens and local canvas remains nonblank. Desktop/mobile images
  are in `docs/qa/image-studio-v8/`.
- Reduced-motion emulation: selection still enters EDITING, no reveal animation,
  no rain timer, rain hidden and sampled canvas pixel nontransparent. Temporary
  viewport/media emulation is restored before delivery.
- Original gallery switches 01 -> 02 -> 01 with the existing presentation. Direct
  Exhibit 01 opens, renders a nonblank CPU console (181 bright sparse samples),
  and the cloth cartridge reaches `INSERTED_READY` after a real button click.
- `zola build`, `zola check --skip-external-links`, locale catalog freshness,
  generated-localization checks (22 HTML pages) and `git diff --check` passed.
  Built Exhibit 02 HTML/JS/CSS has no obsolete physics/game terms or imports.
- Full `zola check` did not pass: the pre-existing TensorTalk Hugging Face URL
  could not be reached. A separate HEAD request timed out after 20 seconds with
  zero received bytes. This does not establish that the remote repository was
  deleted; the URL was left unchanged.

## Remaining Limits

- Native Finder drag/drop could not be automated: this browser tool rejects
  native external-file drag events. Drag-depth/state and animation geometry have
  tests, but real OS drag-in/out/drop remains a manual acceptance item. Clipboard
  image paste, real Safari trackpad/touch hardware and screen readers also need
  manual validation; responsive emulation is not hardware testing.
- No live cloud upload/provider acceptance, exact free-tier/license entitlement,
  Turnstile interaction or Cloudflare-runtime deployment is claimed.
- Mask history uses source-size snapshots with a memory-dependent cap; two large
  snapshots can still use substantial memory. Image history is capped at nine
  states. This is not a measured memory or FPS guarantee.
- Model reference/output resolution is limited; a future enabled cloud result
  must not be marketed as preserving original fine detail or aspect ratio.
- Header dimension screening is a resource guard, not a complete image security
  decoder. Server acceptance stays blocked without the trusted full decoder.

## Local Preview

Run Zola on 1111 and `node tools/preview-image-studio.mjs` on 1112. Open
http://127.0.0.1:1112/lab/ai-image-studio/ . The helper runs the real Pages handlers
with empty cloud bindings; it does not mock successful uploads or inference.
