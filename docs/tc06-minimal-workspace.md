# TC-06 Minimal Console Workspace

## Scope and Files

This is a local UI refinement of the existing Zola TC-06. No hardware geometry,
cartridge dimensions, colors, textures, physics solvers, task definitions or
navigation/cursor animations were replaced. No dependency was added.

- `templates/lab.html`: single workspace plus native Research Inspector disclosure;
  technical controls, performance output, methods and assumptions sit behind it.
- `static/js/lab-v3/app.js`: removes Console sidebar markup and its DOM dependencies;
  retains Lab controls, reparents the one toolbar, wires touchscreen Focus and
  canonical ejection cleanup, and gates inspector-only refreshes.
- `static/js/lab-v3/console.js`: shared vector touchscreen system buttons; safe
  boolean-returning ejection; physical Select settings and post-eject empty menu.
- `static/js/lab-v3/session.js`: optional system settings appended to the existing
  Select menu without changing the original experiment-control ordering.
- `static/js/lab-v3/inspector.js`: mode-specific disclosure preferences independent
  of runtime state.
- `static/styles/lab-v3.css`: full-width Console grid, responsive viewport and
  restrained disclosure styling with focus and reduced-motion support.
- `tests/tc06-minimal-ui.test.mjs`: eleven new interaction/layout regression tests.
- `README.md`: current controls, module map and reproducible test command.

## Console Layout

The duplicated cartridge bay, Insert/Eject/Launch/Focus buttons, external D-pad,
A/B/Start/Select buttons, Power switch and Sound checkbox are not mounted.
The shared sidebar now contains Lab-specific controls only and is removed from
Console layout via the native `hidden` attribute. The Console grid is genuinely
one column; no empty sidebar track, border, padding or drawer is retained.

The viewport uses the full available width, with a 650px desktop height, 590px
laptop height and 460px narrow-screen height. The existing centered CameraRig
resizes to that viewport; geometry, front/back constraints and zoom behavior
are unchanged. The independent fixed-slot gallery stays centered above the shell.
Narrow screens retain a bounded, horizontally scrollable cartridge row instead
of overflowing the page. The initial HTML already declares Console mode so the
old technical toolbar does not flash while the model loads.

The single representation/view/reset/export/fullscreen toolbar lives inside
Research Inspector in Console and above the standalone viewport in Lab. It is
reparented, not cloned. Rendering/sampling settings remain inside the Inspector.

## Touchscreen Eject and Focus

`ResearchConsole.systemButtons()` is shared by Ready, Running and Pause screens.
Eject is drawn at the top right, inside the actual screen texture, using Canvas
vector paths for the triangle and bar. Its logical hit rectangle is 58 by 42 in
the 512 by 288 screen coordinate space. Drawing uses the current 1024px or higher
backing store, not a new low-resolution raster icon. The adjacent expand icon
is available during embedded experiments and opens the existing Focus dialog.

Browser pointer -> nearest visible screen geometry -> screen-local UV -> logical
screen coordinates -> `screenActionAt()` -> `ResearchConsole.eject()` is the
input path. The existing `screen-ui` input owner takes priority over robot
manipulation and camera orbit, locks the outer pose while pressed, and requires
a matching release without a drag. Focus uses the same logical hit rectangles.
There is no separate hardcoded page-coordinate Eject hitbox.

Eject is enabled only with an inserted, ready cartridge and power ON. It is
absent during boot/transfer and when the screen is OFF. All six tasks share the
same overlay. A repeated request is rejected by the existing machine guard.

The canonical ejection path parks the cached session, clears its cartridge ID,
releases controls and pointer capture, cancels prediction/replay, clears the
physics accumulator, closes Focus if open, and requests the established physical
ejection sequence. Other gallery slots remain fixed; the card returns to its
original slot. Completion returns to the empty menu, without navigating to Lab.

Physical A still launches after insertion, Start pauses/resumes and B backs out.
The real OFF/ON slider remains the primary power control. Select accesses
sound/quality settings before launch; the running experiment's existing Tools
menu also exposes sound without replacing arm, axis or tilt controls.

## Research Inspector

The native `details`/`summary` disclosure is initially closed in Console and
initially open in Lab, with independent remembered preferences for each mode.
Keyboard Enter/Space, native expanded semantics, visible focus and a restrained
chevron are retained. Closed content takes no expanded height or tab stops.

Coordinates, World state, Timeline and Prediction remain the original mounted
panels, not placeholders or remounted copies. Toggling does not call world
creation, reset, mode change, selection rebuilding or camera functions. It
preserves object/point/reference/frame selections, timeline and preview inputs.
On expansion, fresh samples and values are read from authoritative state.

When closed, coordinate-table/statistic/world-JSON updates and periodic
inspector-only surface sampling are skipped. Physics and mechanical animation
do not depend on disclosure state. Point-cloud rendering still samples when
needed. Inspector selection highlights are hidden while collapsed so stale
inspection marks do not clutter the hardware view; selections are retained.
The pre-existing offscreen/document-hidden scheduling policy is unchanged.

## Verification

Automated command:

```sh
node --test tests/lab-v3.test.mjs tests/tc06-console.test.mjs tests/tc06-interactions.test.mjs tests/tc06-minimal-ui.test.mjs tests/nav-motion.test.cjs
```

99 tests passed, including eleven new cases for six-task Ready/Running/Pause
Eject, duplicate guards, OFF/boot suppression, in-screen settings, mode-specific
Inspector preferences, removal of Console controls, and real perspective UV
mapping under resize, hover and zoom. Prior power, camera, cartridge, physics,
sampling, exports, timeline and site-navigation regressions remain in the suite.

Browser checks actually performed:

- All six cartridges: gallery insert -> Ready Eject -> reinsert -> physical A ->
  Running Eject. All twelve Eject cases completed; mode stayed Console and
  physics stopped with no retained pointer owner.
- Eject from Focus closed the dialog and returned the card through the same
  physical mechanism.
- Clicking Eject on a hovered/tilted shell preserved the outer camera and
  released input without dragging a robot or orbiting the hardware.
- Physical Select opened settings; OFF blocked A, ON returned to Ready without
  automatically running; physical A and Start then launched and paused Box.
- Inspector object `Chassis`, point `Rear_Grip_-1.sample-1`, local frame, paused
  time 0.3833333333 s and camera were identical before/after keyboard collapse
  and reopen. All four research tabs were accessible; World state contained real
  Box data, Timeline controls were visible, and Prediction was enabled.
- Lab opened with its sidebar, top toolbar and expanded Inspector. Real point
  cloud rendering produced nonzero points; returning to Console restored its
  collapsed preference and single-column layout.
- At 390 by 844, document width was exactly 390px; viewport width 358px; gallery
  scroll width 450px inside a 338px container; no page horizontal overflow.
  Ready Eject also succeeded at that size.
- At High, outer backing store was 2064 by 975 and inner backing store 1280 by
  720. Existing quality caps were not reduced. Balanced was restored afterward.
- No browser console errors were observed during the final checks.

Evidence: `tc06-minimal-browser-qa.json`, `tc06-minimal-desktop.png`, and
`tc06-minimal-mobile.png`. An initial batch browser run exceeded the automation
timeout; the checks above were rerun in bounded batches with explicit results.

Build checks actually executed:

- All thirteen Lab JavaScript modules passed `node --check`.
- `zola build` passed and generated `public/`; the built app, console, Inspector
  module and stylesheet were byte-compared against current source assets.
- `zola check --skip-external-links` passed; `git diff --check` passed.
- Full `zola check` was attempted twice. Existing GitHub links intermittently
  failed with `error sending request`, not an HTTP 404: the first run reported
  the rainfall dashboard and house-control repositories; the second reported
  `panzhzh/beyond-time-distance` in two pages and the rainfall dashboard.
  Independent HTTP HEAD checks of the two KevinRayScottUM project repositories
  returned 200. No project links or link-checker configuration were changed to
  suppress these network failures. Full external-link validation remains limited
  by that connectivity issue.

## Limitations and Release

Native MacBook trackpad feel and real phone multi-touch were not hardware-tested.
Mouse pointer mapping, responsive emulation and mathematical UV tests are not
substitutes for those device tests. Small projected screen controls can be made
larger through the existing console zoom or Focus once an experiment is active.
The six illustrative physics scenes retain their existing approximation and
stability limits. CPU frame rate remains dependent on scene, quality and device.

This change is prepared locally; it does not automatically push to GitHub or
deploy to Cloudflare. Run `zola check` and `zola build` before release.
