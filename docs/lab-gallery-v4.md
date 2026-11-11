# TensorCat Lab V4: Interactive Exhibition Gallery

## Scope and Release State

Implemented in the existing Zola/Kodama project, without a framework migration,
new runtime dependencies, database or backend. The original V4 validation was
local-only. On 2026-11-11 the user requested publication of V4 together with the
V5 hardware showcase. This document records the earlier V4 scope; see
`lab-showcase-v5.md` for the current interactive preview and validation.

Only one genuine exhibit is registered: **TensorCat — Interactive World Simulator**,
at `/lab/world-simulator/`. Slots 02–04 are explicitly reserved, disabled and
non-navigable. Multi-project motion was verified using temporary local browser
fixtures, not fabricated public projects. All fixtures were removed before delivery.

## Files

Added:

- `templates/macros/exhibit.html`: reusable server-rendered preview presentation.
- `static/js/lab-gallery.js`: transition lifecycle, image preparation, layout sizing,
  selection, keyboard interaction and cleanup.
- `tests/lab-gallery.test.mjs`: transition/controller and integration contracts.
- `tests/fixtures/lab-gallery-browser.mjs`: development-only browser fixtures.
- `tools/capture-gallery-preview.mjs`: reproducible real-framebuffer preview export.
- `docs/lab-gallery-browser-qa.json`: observed animation frames, measurements and layout checks.
- `docs/lab-gallery-desktop.png`, `docs/lab-gallery-mobile.png`: final real-exhibit screenshots.
- This implementation report.

Modified:

- `templates/lab-gallery.html`: index/showcase shell, availability filtering,
  disabled reservations and inert preview templates.
- `data/exhibits.toml`: reserved numbers, index metadata and media geometry.
- `static/styles/lab-exhibition.css`: responsive 28/72 layout and presentation states.
- `static/js/lab-rain.js`: new foreground reading masks, stable resize handling,
  reused stream state, capped DPR and reduced mobile density.
- `static/img/lab/world-simulator.png`: new actual CPU-rendered preview.
- `tests/lab-exhibition.test.mjs`: rain identity, resize and density regression checks.
- `README.md`: architecture, registration and verification instructions.

No files in `static/js/lab-v3/` were changed. Console mechanics, six experiments,
navigation animations, Contact selection, TensorCat cursor, D1 likes and blog content
were not rewritten.

## Layout

The collection is capped at 1720px overall, with 32px desktop padding and a 24px
column gap. The grid uses:

```css
grid-template-columns: minmax(240px, 28%) minmax(0, 1fr);
```

Both children have `min-width: 0`; there is no second width cap inside the right
showcase. The preview occupies its full grid track. It is one framed presentation,
not nested floating cards: a compact availability header, 16:9 visual, metadata,
description, tags and Enter Exhibit link.

At 800px and below the index becomes a horizontally scrollable strip above the
full-width preview. At 540px the heading and copy become more compact. Typography
uses fixed breakpoint sizes, not viewport-scaled text. Keyboard focus, selection,
hover and disabled states are distinct; selection also has a left-edge accent.

Final measured responsive geometry:

| Viewport | Index / preview tracks | Page overflow |
| --- | --- | ---: |
| 390 x 844 | stacked / 354px | 0px |
| 768 x 1024 | stacked / 720px | 0px |
| 1280 x 900 | 340.48px / 851.52px | 0px |
| 1440 x 1000 | 385.27px / 966.73px | 0px |
| 1920 x 1080 | 463.68px / 1168.32px | 0px |

At 1280px and 1440px the right edge is exactly 32px from the viewport edge. At
1920px the intentional overall max-width produces 132px outer margins.

## Transition Architecture

`ExhibitSwitcher` serializes the lifecycle independently of DOM effects:

`IDLE -> PREPARING_NEXT -> TRANSITIONING -> SETTLING -> IDLE`

It tracks active, requested and outgoing IDs plus direction and phase. A new
selection acknowledges the row immediately. Superseded preparation is aborted.
During motion only the latest subsequent request is retained, not every click.
At completion that request is compared with the committed project and processed.
Same-project and unavailable requests do not start a transition.

`ExhibitGallery` handles presentation:

1. Import the selected inert template into the active document.
2. Load/decode its visual while keeping the old presentation visible.
3. Mount an incoming layer alongside the outgoing layer.
4. Animate both with Web Animations API on a shared document-timeline start time.
5. Commit the new layer, remove the outgoing layer, cancel finished animation
   effects and release their references.

Normal timing is **760ms**, easing **`cubic-bezier(0.22, 1, 0.36, 1)`**. Forward
motion takes the outgoing layer upward and the incoming layer from below;
registry order reverses this for earlier projects. Travel is 55% of the visual
height on desktop and 32% on compact layouts. Scale ranges only from 1 to 0.985
outgoing and 1.01 to 1 incoming. Opacity curves overlap throughout. The entire
presentation, including title and entry action, moves as a unit without a text stagger.

Preview geometry is measured in a batched hidden probe at initialization, font
readiness and actual width changes. Probe images have their sources removed, so
measuring metadata does not load all project imagery. The tallest presentation
sets the viewport height. Height is never animated; only transform and opacity
change during motion. `will-change` is limited to the two transitioning layers.

Adjacent available previews and pointer/focus targets are warmed when Save-Data
is not enabled. Image failures keep the old project and expose a live status
message; retry/another selection remains available. Reduced motion makes the
selection nearly immediate. Enabling reduced motion or hiding the document
finishes active motion. Disposal aborts preparation, removes listeners and
observers, cancels scheduled measurement/animations and clears preloader references.

## Matrix Background

The existing code rain remains a separate module and canvas. The gallery controller
never creates a `CodeRain` instance or starts a second background frame loop.
Project selection only changes the foreground preview and row states.

The original colors, speed and character language are retained. Resize now exits
without touching buffers or streams when viewport geometry has not changed;
actual resizes reuse existing column objects. Phone columns are spaced 40px
instead of 28px, and backing-store DPR is capped at 1.5. Reading masks protect
index text and preview copy. Pointer events remain disabled. Hidden-tab and
reduced-motion behavior remains supported.

## Preview Media

The 1440 x 810 PNG is approximately 138KiB. It was composed directly from the
existing Console's High-quality CPU framebuffer (2064 x 975) and transparent
cartridge-gallery framebuffer. A 960 x 540 CSS-pixel crop removes empty border
space, not hardware. All six cartridges, the complete housing and original
branding remain visible. No generated replacement illustration was introduced.

## Tests Executed

- **125 Node tests passed**, including the original physics/mechanics, Inspector,
  power/Eject and navigation suites.
- `zola check`: exit 0, Zola 0.22.1.
- `zola build`: exit 0; `public/` generated.
- Native JavaScript syntax and Git whitespace checks passed.
- Browser: real gallery entry/return, real cloth insertion and running lifecycle,
  browser Back/Forward and absence of physics-module loading in the gallery.
- Browser with three local fixtures: forward, reverse, rapid selection,
  same-project no-op, keyboard focus/Enter, missing-image fallback, reduced-motion
  selection, reduced motion enabled during an active slide, and phone transition.
- Responsive checks at all five viewport sizes listed above.

Frame observations in the in-app browser:

| Test | Observations | Max layers | Blank samples | Frame interval median / P95 |
| --- | ---: | ---: | ---: | --- |
| Reverse | 50 | 2 | 0 | 16.7 / 17.0ms |
| Forward | 51 | 2 | 0 | 16.7 / 17.2ms |
| Rapid selection | 115 | 2 | 0 | 16.7 / 17.2ms |
| Phone forward | 50 | 2 | 0 | 16.7 / 16.8ms |

The preview height had a single value throughout each sampled test. The same
rain canvas and buffer dimensions persisted during selection. Forward samples
showed negative outgoing Y and positive incoming Y converging toward zero.
At rest only one preview layer remained, with no retained animation effects.

These are observed `requestAnimationFrame` intervals with QA instrumentation,
not a guarantee of compositor FPS, GPU timing, cross-device performance or absence
of every possible dropped frame. The intentionally missing fixture produced an
expected local image-load error; it is not in the public registry.

## Known Limits

- Public multi-project browsing cannot be demonstrated until another real exhibit
  is registered. The reserved slots intentionally do nothing.
- There is no duplicate live 3D simulation in the gallery; the preview is a genuine
  rendered image. The fully interactive experience remains inside the exhibit.
- Native iOS Safari, physical touch hardware and non-Chromium engines were not
  independently tested. Responsive and reduced-motion tests used the in-app browser.
- Hidden-tab cleanup is implemented and covered by lifecycle reasoning/tests;
  physical operating-system tab suspension was not separately benchmarked.
- V4 is included in the V5 release requested on 2026-11-11.
