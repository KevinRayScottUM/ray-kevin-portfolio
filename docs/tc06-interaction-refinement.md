# TC-06 Interaction Refinement

2026-11-10. Incremental changes to the existing static Zola `/lab/` route. No
React, service, neural inference, WebGL or WebGPU dependency was introduced.
Portfolio navigation, cursor and all six physical experiment implementations
are retained. This report supersedes the earlier upper-rack interaction notes.

## Final Interaction Contract

The user's subsequent corrections take precedence over the pasted initial brief:
the selected cartridge must **leave an empty gallery slot**, not leave a display
copy behind. Other slots keep their centers. Ejection returns the same cartridge
to its original slot. The gallery's viewing camera stays fixed; the physical
cartridge must visibly travel into the actual handheld bay. No white gallery
background may hide any part of that travel.

## Modified Files

- `static/js/lab-v3/console.js`: canonical auto-insertion, latest-request queue,
  deferred face alignment, physical transfer poses and power-aware controls.
- `static/js/lab-v3/gallery.js`: independent orthographic cartridge gallery,
  hover transforms, stable hit regions, vacant slots, screen-to-world transfer
  mapping and depth-visible foreground composition.
- `static/js/lab-v3/motion.js`: frame-rate-independent critically damped springs,
  hover and a constrained front/back hardware-pose controller.
- `static/js/lab-v3/power.js`: canonical ON/OFF state, two-endpoint slider and
  cancellation policy.
- `static/js/lab-v3/session.js`: shared runtime observes the same power object;
  launching, dispatch and physics-running state are power gated.
- `static/js/lab-v3/app.js`: input ownership, modal/input cleanup, lifecycle,
  gallery rendering in the existing RAF, physical power dragging and diagnostics.
- `static/js/lab-v3/graphics.js`: optional alpha-enabled renderer and correct
  source-over alpha writes for transparent gallery compositing; the main CPU
  renderer remains opaque and retains DPR, supersampling and texture mipmaps.
- `static/js/lab-v3/mechanics.js`: smooth portal-to-slot approach without routing
  through an imaginary central gallery gap.
- `static/styles/lab-v3.css`: stable upper gallery, mobile horizontal scrolling,
  noninteractive foreground canvas and accessible power toggle.
- `templates/lab.html`: removes obsolete visible control instructions.
- `tools/tc06/{generate_console,process_assets}.py`: compact recessed physical
  slider, grip ribs, separate OFF/ON labels, relocated existing LED and uniform
  source cartridge spacing. Packed Blender, GLB, CPU mesh JSON, labels and twelve
  inspection previews were regenerated.
- `tests/tc06-interactions.test.mjs`: auto-insertion, springs, snapping, portal
  mapping, empty slots, alpha/depth composition and all-six power guards.
- `tests/tc06-console.test.mjs`: source-rack expectations now reflect independent
  gallery rendering rather than collisions against decorative display copies.

## Insertion and Replacement

Both the top gallery and sidebar call `requestCartridgeInsertion(index)`. There
is no normal Insert-button step. The compatibility command is hidden. A click
does not launch: the experiment still waits for A, not Start, and stays in Console.

The mechanical FSM adds ORIENTING before the established ALIGNING / INSERTING /
READY / EJECTING path. It waits for the actual hardware to settle front-facing
before creating a transfer, including when requested from Back. Replacement
closes active input/session presentation, ejects the previous card, and inserts
the requested card. While busy, only the latest request is queued; a same-card
request never restarts the current movement. Power is independent of this FSM.

The orthographic gallery is not parented to the handheld. Six centers are
`(index - 2.5) * 0.045`, with no special middle gap. A moving/inserted card is
hidden in the gallery, not removed from layout; its stable HTML hit slot becomes
inactive until it returns. Remaining cards never reflow or change viewing angle.

The transfer starts from the current gallery hover orientation and projected
center. Its perspective depth is solved from physical height, desired pixel
height, viewport height and camera FOV. A camera ray intersects that depth plane;
the result and quaternion are transformed into the handheld root's local frame.
No hardcoded browser-pixel destination or physical card scaling is used. The
existing internal bay dimensions determine the final seated pose.

The gallery canvas has an actual alpha-enabled 2D context and zero-alpha clear
pixels. A foreground canvas copies only the moving cartridge's **already
depth-tested** pixels from the main renderer, using its object-ID buffer. It
introduces no second mesh or simulation. This makes travel visible above nearby
gallery cards while still respecting occlusion by the real housing at the slot.
It is hidden outside mechanical transfers and receives no pointer events.

## Hover and Face Snapping

Stable button bounds normalize pointer offsets to [-1,1]. Gallery yaw/pitch
limits are 10/8 degrees; body limits are 4/3 degrees. Geometry is reused; only
quaternions change. The critical spring integrates its displacement and velocity
analytically with exponential decay, so 30 Hz and 144 Hz agree. No extra physics
solver or RAF drives decoration. Leaving returns to neutral without layout shift.

Hardware state separates committed Front/Back, active drag yaw/pitch, hover
offsets and the snap tween. The camera itself stays front-facing. Unwrapped yaw
and shortest equivalent face targets avoid discontinuities at +/-180 degrees.
Vertical drag is limited to 12 degrees; final pitch is exactly zero and roll
is not independently controllable. The 400 ms snap uses quintic easing.

The deliberate flip threshold is 110 degrees. A flick additionally needs at
least 62 degrees, 120 CSS pixels and 850 px/s smoothed horizontal velocity.
Crossing the threshold latches the opposite-face target for that gesture, so
jitter cannot toggle it repeatedly. Small or side-on releases return to the
committed face. Console presets are only Front/Back; Lab preserves its free views.

Screen/physical-control pointer ownership locks outer hover and snap motion.
Dragging an actual gripper modifies its world target, not the hardware pose.
The prior Up/Down zoom and analog inner-view rotation mappings remain in place.
Gallery clicks, power dragging, physical buttons, inner touchscreen and outer
rotation are mutually exclusive gesture owners. Blur, cancellation, visibility
changes and mode changes clear capture/held inputs safely.

## Power Lifecycle

`PowerSwitch.state` is the single ON/OFF source used by the physical knob, sidebar
switch, session guards, screen and LED. Default is ON. The recessed track and
slider are real pickable geometry, with fixed readable OFF-left / ON-right
labels and tactile ribs. Endpoints can be clicked; dragging snaps to the nearest
endpoint (an exact midpoint chooses ON). Cancellation restores the committed
state. Slider easing is independent of electrical state.

OFF clears active capture and held inputs, returns the session to a menu state,
stops physics advancement and embedded drawing, fills the screen dark and dims
the existing LED. It does not hide the handheld or disable mechanical card
changes or inspection. ON restores the ready/menu screen and requires A again.
The cached world may be resumed by that explicit A press, but never implicitly
by switching ON. The sidebar's native switch supports keyboard activation. Sound
remains opt-in and is invoked only by user gestures.

## Verification

Automated suite: **88 tests pass** across the existing Lab, console integration,
new interaction suite and portfolio navigation regression suite:

```bash
node --test tests/lab-v3.test.mjs tests/tc06-console.test.mjs tests/tc06-interactions.test.mjs tests/nav-motion.test.cjs
```

Browser checks exercised all six one-click insert/replace -> READY -> A ->
embedded experiment journeys, with no automatic launch or Lab navigation. All
six hover responses and neutral returns were observed. Small drags returned to
Front; deliberate positive/negative flips reached precise stable Front/Back;
gallery bounds stayed unchanged. Physical power-slider dragging turned OFF,
blocked an actual A-cap click and froze both physics time and embedded frame
count. Replacing a card while OFF remained functional; ON returned to ready
without running until A.

The user's vacancy correction was verified by observing a moving physical card,
an empty source slot, unchanged neighbor centers and full restoration on eject.
The white-occlusion correction was verified by an alpha-enabled gallery context,
transparent background pixels and a nonempty foreground transfer buffer, plus
visual inspection of the moving card in front of the gallery.

Rapid-click regression: removed the canvas double-click reset listener shared by
the main workspace and enlarged touchscreen. Explicit reset controls remain.
Eight consecutive clicks on the console preserved its committed Back pose and
camera distance of 0.7311422947 m. Six consecutive clicks in Lab preserved the
inner camera's theta (0.48), phi (1.05), target and nondefault distance
(1.7305812943 m). No browser console errors were observed. The source regression
test guards against reintroducing a double-click or click-count reset shortcut.

Final `zola check`, `zola build` and `git diff --check` passed. Generated output
is in `public/`. Browser evidence includes `tc06-no-double-click-reset.jpg`,
`tc06-interaction-transfer.jpg` and `tc06-interaction-power-off.jpg`.

## Limitations

- Real MacBook trackpad feel and physical phone multi-touch need manual hardware
  testing. Browser pointer/wheel and mathematical tests are not those device tests.
- Front/Back motion is inspired by the supplied interaction specification. No
  Frameboy branding, model, code or artwork is copied; its live renderer was not
  available for a complete visual-motion comparison in this testing environment.
- The six existing physical scenes retain their documented approximation and
  controller-stability limits. This is not a trained world model or a validated
  robot-control research benchmark.
- CPU frame rate depends on scene, hardware, quality and motion. Existing
  resolution safety caps remain; no new forced quality reduction is used to hide
  animation cost. Browser composition may use platform acceleration independently
  of this application's CPU rasterizer.
- This local refinement does not itself deploy to Cloudflare Pages.
