# V6.1: Header, Lab Appearance and Contact Motion

## Scope

Precision refinements on top of published V6 commit `04ec0fb`.
No framework, router, animation dependency or rendering engine was added.
English/Chinese content, routes, icons, original imagery, cursor, navigation
animations, physical geometry and scientific implementation remain unchanged.
This report records implementation and pre-release verification. Production
publication was approved on 2026-11-13 through the existing GitHub `main` to
Cloudflare Pages connection. The release commit's Cloudflare check records its
deployment outcome.

## 1. Shared Header Alignment

### Root Cause

`home-layout.css` still declared a Home-only 1240 px maximum width, 32 px horizontal
padding and additional mobile header/brand overrides. Its `body:has(...)`
specificity beat the common layout. The interior header used 1440 px instead.
At a 1440 px viewport, the measured Home appearance switch began at x=1228,
while Project Experience began at x=1332: a 104 px route-dependent displacement.

The old active-link weight also differed from inactive links and could alter
intrinsic text widths. Contact/short pages could have different scrollbar needs.

### Correction

Removed the four Home-only header rules, rather than compensating with offsets
on other pages. The existing shared header grid now owns full available width,
no independent max-width, 48 px desktop gutters and stable control tracks.
Brand/language occupy the left tracks; the links are right-aligned in the flexible
navigation track, followed by the appearance selector. No wrapper or new router
was necessary. Main content containers are not changed.

Links have a consistent 600 weight, so the active state changes color/underline
without changing text measurement. Root `scrollbar-gutter: stable`, with a scroll
fallback where unsupported, protects against scroll-induced width changes.
Existing responsive arrangements and the mobile horizontal navigation remain.

At 1440 px, every tested route now has an 83 px header, with the appearance switch
at x=1312 and its right edge at x=1392. All measured brand/control/link rectangles
were exactly identical within a language across routes and global appearances.

## 2. Permanent Lab Appearance

### Root Cause

V6 applied its global Light palette to the entire document, including Lab.
It explicitly set Light Lab bodies to `#eaf0eb`. The same global tokens also
colored the header, controls and overlays, washing out the Matrix background.

### Boundary and Preference Separation

The shared Zola base layout declares:

- `/lab` or a path starting with `/lab/`: `data-appearance-scope="lab"`.
- Other paths: `data-appearance-scope="portfolio"`.

This is an exact path-segment boundary, not a substring search for `lab`.
Future exhibits under `/lab/` inherit the same base layout behavior. It is
present in built HTML before JavaScript executes.

`data-theme` remains the visitor's stored preference. `data-effective-theme`
owns the rendered appearance. The pure `effectiveAppearance(scope, preferred)`
function returns Dark for Lab and otherwise the saved preference. Both the
blocking bootstrap and live updates apply this rule, including native
`color-scheme`. Entering Lab does not write a new preference to localStorage.

CSS uses effective appearance for palette and icon rendering. Initial selector
thumb placement still uses the *preferred* theme, so the Light option honestly
remains selected when that is the saved setting. An English/Chinese screen-reader
description explains Lab's independent dark presentation without a visible banner.

The Lab boundary owns its original near-black/teal family: page `#090b0e`, header
`#101516`, light text, dark surfaces/inputs and restrained teal accents. Header,
body, footer, dialogs, dropdowns and future body-level overlays inherit the same
root tokens. No component-by-component `!important` patchwork was added.

The Matrix implementation is untouched. No new loop, reset, mask change or image
inversion is introduced. Scientific materials and an explicitly selected
simulation viewport background are intentionally not recolored by a theme change.

## 3. Contact Hover Choreography

### Root Cause

Contact previously animated `padding-left`, changing layout. V6's broad appearance
transition then overrode that transition, causing the padding to snap. The label,
icon and arrow did not have coordinated independent motion.

### Correction

All three links share `.editorial-contact-link`, with stable icon, label and
arrow elements. The anchor's box and padding never move. A subtle pseudo-element
highlight sits behind the contents; motion occurs only on the child transforms.
The Contact rows are excluded from the broad palette transition selector so their
own timings cannot be overwritten again.

| Element | Entrance | Delay | Motion | Exit |
| --- | --- | --- | --- | --- |
| Background/border | 380 ms | 0 | Highlight opacity and border color | 380 ms |
| Icon/label | 420 ms | 50 ms | 4 px right | 340 ms, no delay |
| Arrow | 460 ms | 80 ms | 6 px right and 6 px up | 340 ms, no delay |
| Ink/arrow tone | 300-340 ms | 0 | Theme-aware contrast/opacity | 300-340 ms |

All use `cubic-bezier(.22,1,.36,1)`. Native CSS transitions reverse from their
current interpolated positions, without JavaScript timers or animation queues.
Focus-visible receives the same feedback and a 2 px semantic outline.
Reduced motion removes transforms/transitions but retains focus and color cues.
The original GitHub, Hugging Face and Kaggle artwork, URLs and target behavior
are unchanged.
The title's accent color is now scoped only to its decorative period, avoiding
the old broad `h1 span` selector coloring the entire localized title too dark.

## Validation

### Browser Checks Executed

- Seven routes: Home, Project Experience, About, Blog, Contact, Lab gallery and
  World Simulator. At 1440 px, all four language/appearance combinations were
  measured: 28 route-state cases. Header geometry was identical within each language.
- Both languages at 1920/1440/1280/1024/768/390 px across all seven routes:
  84 additional cases. No document horizontal overflow; controls remained inside
  the viewport. Header shell/brand/switch tracks were stable. At 390 px, individual
  link viewport positions legitimately change as the existing navigation scrolls
  the active item into view; this is not a change in header geometry.
- Additional English widths 1101/1152/1180/1200/1250/1280 px: all desktop labels
  remained visible before the responsive breakpoint.
- Actual navigation round trips for both saved Light and Dark: Lab was Dark,
  while returning Home restored the unchanged saved preference.
- Gallery Light/Dark/Light and language changes preserved the same scene UUID,
  progress 0.088889, camera, quaternion, showcase canvas and Matrix canvas.
  Body/header colors were identical before/after. A sampled Matrix frame contained
  745 green pixels under the test's subsampling rule, confirming live nonblank rain.
- Actual showcase canvas pixels were nonblank at desktop (1206 x 679 backing
  store, 12865 non-background sampled pixels) and mobile (440 x 248, 1445 samples).
  The pixel hash changed after the Next-view interaction, with the expected
  progress from 0 to 0.088889, rather than showing a static or blank canvas.
- World Simulator cartridge insertion and launch worked with global Light while
  the page/header remained Dark. Cloth time advanced from 0.0667 s to 2.3167 s
  through preference changes, without replacing host/canvas/rain or changing camera.
- Paused exact-state comparison preserved the entire physics snapshot, both
  cameras, session, point-cloud representation, 2546 samples, selected
  `worktable.surface.sample-0` and 180 timeline entries. Time remained 53 s.
- Each of the three Contact links was sampled frame-by-frame on entry and exit
  in Light and Dark: six complete sequences. Intermediate arrow positions were
  observed, ending at (6,-6); labels ended at (4,0). All returned to zero. Anchor
  rectangles were identical for every sampled frame.
- Rapid movement through six row changes left no hovered/highlighted row behind.
  Keyboard focus showed the same settled motion and a visible outline. Emulated
  reduced motion produced no translation and a 0 s transition duration.
- Dark Contact title text was verified as RGB(233,238,233), with the period alone
  using the accent RGB(156,202,176). The title no longer inherits the old low-contrast green.
- All three links were actually clicked and opened their original destinations
  in new tabs; only those test-created tabs were closed.

### Automated Checks

- 164 unit/regression tests passed, including six new precision-refinement tests.
- All 408 bilingual message pairs validated; generated browser catalog matched.
- Blocking bootstrap tested in a VM for Lab/portfolio and saved Light/Dark,
  retaining language and performing no storage writes.
- Built HTML checked for known keys, one control pair, unique live IDs,
  early initialization and correct route-owned appearance attributes.
- Existing navigation tests, six-task physics tests, point exports, hardware
  rendering, gallery lifecycle and independent input-state checks remained passing.
- Node syntax validation passed for all five changed JavaScript/module files.
- `zola check` and `zola build` completed with exit 0 using Zola 0.22.1.
  The built-page validator passed for all 21 generated pages.

See `qa/portfolio-v61/validation.json` for recorded browser measurements and
`qa/portfolio-v61/` for screenshots.

## Modified Files

- `templates/base.html`: route-owned appearance and shared header arguments.
- `templates/macros/nav.html`: accessible Lab appearance description.
- `templates/contact-page.html`: shared stable Contact child classes.
- `static/styles/home-layout.css`: remove route-specific header overrides.
- `static/styles/preferences.css`: canonical header, stable gutters, effective
  theme tokens, permanent Lab palette and removal of Contact transition overrides.
- `static/styles/editorial.css`: shared Contact motion and focus/reduced-motion rules.
- `static/js/preferences-core.js`: pure effective-appearance helper.
- `static/js/preferences-init.js`: early route-aware paint.
- `static/js/preferences.js`: maintain preferred/effective separation live.
- `data/locales.json`, `static/js/locales/catalog.js`: one bilingual description.
- `tests/preferences.test.mjs`: six focused regression checks.
- `tools/check-localized-build.py`: verify built route appearance.
- `README.md`, this report and QA evidence.

## Known Limits

There is no TypeScript or repository-level ESLint configuration; no such checks
are claimed. Mobile checks use browser viewports, not physical iOS hardware or a
screen reader. Manual physics preference checks used Cloth; the automated suite
covers all six tasks. The existing explicit experiment viewport background and
original hardware/artwork colors remain user/content choices, not theme leakage.
Future Lab routes are covered by the layout rule but were not fabricated as
public exhibits solely for testing. Publication uses the existing deployment
connection; no Cloudflare configuration or database binding is changed.
