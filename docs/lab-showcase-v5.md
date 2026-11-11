# V5 interactive hardware showcase

## Scope

Exhibit 01 in `/lab/` now presents the actual TensorCat mesh rather than rotating
a screenshot. The 28/72 gallery, project index, metadata, Enter Exhibit route,
760 ms vertical project transitions and independent Matrix rain are retained.
The full simulator remains at `/lab/world-simulator/`.

The original front composition is reproduced with its original camera crop,
screen artwork and six cartridge transforms. The PNG remains a loading, error
and no-JavaScript fallback; it is removed only after a successful canvas paint.
No physics session, robot, cloth solver or learned model is initialized here.

## Files and reuse

- `static/js/lab-showcase.js`: lazy asset bank, independent view lifecycle,
  wheel/pointer/keyboard adapters, render scheduling, quality and diagnostics.
- `static/js/lab-showcase-motion.js`: horizontal intent, normalized deltas,
  bounded inertia, exact critically damped spring and eight tour landmarks.
- `static/js/lab-showcase-scene.js`: lossless attribute indexing, independent
  hardware clone/pivot, and dedicated `ShowcaseRig`.
- `static/js/lab-v3/home-screen.js`: shared original home-screen composition.
  `console.js` delegates only its existing menu painting to this helper.
- `static/js/lab-v3/graphics.js`: opt-in projected-vertex reuse and clipping
  fast path. Defaults remain unchanged for the full simulator.
- `static/js/lab-gallery.js`: mounts the showcase only on the real first entry,
  pauses outgoing views and disposes them after existing project transitions.
- `data/exhibits.toml`, `templates/macros/exhibit.html` and
  `static/styles/lab-exhibition.css`: component opt-in, accessible controls,
  separate 16:9 stage/footer and responsive styles.
- `static/img/lab/icons/chevron-{left,right}.svg`: Lucide arrow controls;
  license remains in the icons directory.
- `tests/lab-showcase.test.mjs`: interaction, geometry and raster regressions.

Geometry, texture assets, `SoftwareRenderer`, `studio.js`, `CartridgeGallery`,
Three.js math and the existing `Spring` are reused. No new runtime package is
required. The showcase does not instantiate the full console's `FaceController`
or share a mutable camera with it. Asset geometry and texture data are cached;
each mounted view owns its transforms, camera, renderer and input state.

## Camera and motion

| Landmark | Yaw | Camera distance | Target Y |
| --- | ---: | ---: | ---: |
| Front overview | 0 degrees | 0.500 | 0.045 |
| Front three-quarter | 32 degrees | 0.535 | 0.036 |
| Side profile | 90 degrees | 0.550 | 0.035 |
| Rear three-quarter | 140 degrees | 0.535 | 0.036 |
| Rear overview | 180 degrees | 0.500 | 0.045 |
| Opposite side | 235 degrees | 0.540 | 0.035 |
| Return to front | 310 degrees | 0.535 | 0.036 |
| Full circle | 360 degrees | 0.500 | 0.045 |

An unwrapped progress value in `[0,1]` maps continuously to yaw `[0,2*pi]`.
There is deliberately one bounded revolution, not infinite spinning. Reverse
input traverses the same path backward. Zero and one produce equivalent
orientations; Home/End and arrows use the same state, not another carousel.
Quaternion composition applies yaw and a restrained pitch; smoothstep blends
camera distance, target height and pitch between landmarks. The larger
intermediate distances prevent bottom-edge clipping without altering frame 01.

The progress spring uses the existing analytic critically damped solution with
frequency 17. Input starts moving the target immediately; it does not wait for a
gesture-end event. Release momentum is exponentially damped, velocity capped,
and limited to 0.035 additional turns before gently settling to a nearby pose.
The controller is timestep independent. No naive 359-to-0 interpolation occurs.

Wheel arbitration accumulates 6 px of horizontal intent, requires horizontal
dominance, normalizes pixel/line/page deltas and releases on vertical movement.
Only a captured horizontal gesture calls `preventDefault`. Ctrl/Meta wheel
gestures remain with the browser. Pointer capture is released on up, cancel,
lost capture, blur, page hide and project departure. Touch uses `pan-y pinch-zoom`
and defers ownership until horizontal movement is established. Reduced motion
resolves stage choices directly without a long sweep.

## Rendering and lifecycle

The handheld is real geometry with depth-tested surfaces, transformed normals,
perspective-correct textured screen and rear badge, material-dependent studio
illumination and a restrained ground shadow. The six cartridge meshes remain in
a separately cached geometry layer with unchanged positions and orientations.

Lossless indexing preserves every original position, normal and UV seam.
Vertex projection is reused within each frame. Triangles wholly inside the
frustum bypass unnecessary polygon clipping. An attempted blanket backface
culling optimization was removed after pixel comparison exposed missing side
surfaces on this intentionally double-sided model. Existing depth testing and
single-sided label visibility are retained instead.

Rendering is demand driven: movement/settling/resize paints, idle does not.
Moving quality adapts within a bounded scale and pixel budget; settling restores
the sharper idle backing store. The cartridge layer is redrawn on size changes,
not on every handheld rotation. Intersection and visibility checks stop inactive
work. Project transitions pause the outgoing showcase, then dispose its frames,
observers, listeners and private scene. Async mount guards prevent stale loads
from attaching to a newer project. Returning to Exhibit 01 resets to frame 01;
browser back-forward cache restoration deliberately preserves its own state.

## Validation

Executed locally on 2026-11-11 using Zola 0.22.1 and the in-app Chromium browser.

- All 145 repository tests passed, including 20 new showcase tests.
- Tests compare original and indexed vertex attributes; check independent
  transforms/cameras; front/rear occlusion; circular rear-badge projection;
  matching 0/360 framebuffers; optimized/reference raster output; and hardware
  margins at 41 points across the full revolution.
- Interaction tests cover delta units, axis noise, tiny input, reversal, bounded
  inertia, held-drag stale velocity, frame-rate independence, capture/release,
  touch-axis ownership, cancellation and reduced motion.
- Browser input validated horizontal wheel progression, reverse progression,
  small input, vertical page scrolling without progress changes, mouse dragging,
  release, arrows, Home/End and all eight settled real-geometry views.
- Desktop 1440x1000 and mobile-sized 390x844 screenshots were inspected. The
  mobile document width equals its viewport width; canvas pixels are nonblank.
- Local-only alternate-project fixtures verified overlapping upward keyframes,
  paused outgoing rendering, resource disposal, one committed preview layer,
  retained rain-canvas identity and a fresh front view on return. Fixtures were
  removed by reload; none is a public registered project.
- Offscreen preview reported `visible=false`, `frameScheduled=false`.
- Idle render count remained unchanged across a separate 2.4-second observation.
- Browser reduced-motion mode selected 32 degrees immediately with phase IDLE.
- Enter Exhibit loaded the original console menu; opening Lab loaded the
  original running cloth workspace. No browser warnings/errors were observed
  during this smoke check. This is not a full manual replay of all six tasks.

Raw snapshots are in `lab-showcase-browser-qa.json`. Final screenshots:
`lab-showcase-front.png`, `lab-showcase-side.png`, `lab-showcase-rear.png`, and
`lab-showcase-mobile.png`.

### Measured performance and limits

For the final eight-landmark browser sweep, the last 180 render samples had
median 23.9 ms and p95 25.4 ms. Eight action-to-painted-frame samples had median
36.0 ms and p95 55.4 ms. These are renderer/action timings, **not a claim of
60 fps**; adaptive resolution and browser scheduling affect actual presentation.
An earlier sweep in the same environment measured 40.0/63.9 ms median/p95,
illustrating warmup, load and angle sensitivity. Cold high-resolution paints can
take longer. Ordinary laptops may perform differently.

A short earlier repeated-interaction observation reported JavaScript heap use
from 17,017,380 to 17,403,336 bytes without forced collection. This is not a
long-duration leak proof or total browser/OS memory measurement. Idle zero
showcase frames does not mean zero page CPU: Matrix rain remains active.

The browser tool does not support native touch injection. Touch ownership was
unit tested and the mobile layout inspected, but real Safari pinch/pan and a
physical MacBook two-finger trackpad were **not** exercised. OS natural-scroll
settings can affect the user's perceived gesture direction. Those hardware
checks remain important before asserting identical feel on all devices.

This remains a static Zola/Cloudflare Pages build. Initial implementation and
validation were local-only. The user subsequently requested publication on
2026-11-11, including the V4 gallery and V5 showcase. Production delivery uses
the repository's existing GitHub `main` to Cloudflare Pages integration; the
deployment status attached to the release commit is the authoritative result.
