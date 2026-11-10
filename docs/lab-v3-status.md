# TensorCat Lab V3 Implementation Ledger

Historical first-pass ledger. For the subsequent shared-session Console Mode,
upper cartridge rack, A-button launch, embedded screen interaction, resolution
and logo fixes, use [the current refinement report](tc06-console-refinement.md).
The first-pass measurements and outstanding physics limitations below are
retained as dated evidence, not descriptions of every current console behavior.

The V3 specification takes priority over the supplied V2 baseline. Work is scoped
to the existing Zola `/lab/` route. No change to portfolio navigation, identity,
cursor, publishing URL or existing likes service is required.

## Audited Baseline

- Zola/Kodama; native ES modules; Three.js r170 math and SVGRenderer.
- cannon-es provides the existing cloth dynamics.
- Existing Lab is one cloth concept, not six completed experiments.
- Blender 4.4.1 is available locally; no visitor-side Blender dependency.
- Shared physics uses meters, seconds, radians and right-handed Y-up coordinates.
- Reference: [Hybrid Particle-Voxel Dynamics](https://jwang771.github.io/3dworldsimulator/).
  This application is a simplified physical simulator, not its trained neural model.

## Acceptance Scope

All six tasks, CPU depth rendering, the exact original logo, genuine 3D controls,
cartridge state transitions, real geometry sampling, coordinate-frame inspection,
snapshot replay, isolated physics rollouts, exports and measured validation remain
required. Generated assets and implementation progress do not by themselves prove
that a requirement has passed.

## Current Delivery: Runnable Local Prototype

This is not a claim of complete V3 acceptance. The major architecture and six
physical scenes are implemented; outstanding requirements below are retained
explicitly. Production remains on its previously verified release. No Git push,
Cloudflare deployment or database change was performed in this update.

### Implemented

- Default Console / Lab modes; shared renderer, camera, geometry sampling and
  inspector infrastructure, with separate console and physical-world state.
- Programmatic Blender 4.4.1 chassis: shell, trim, grips, screen depth, speaker
  slots, screws, LED, port, boolean cartridge cavity, connector contacts, and
  independent A/B/D-pad/joystick/Start/Select controls. Six distinct cartridges.
  Final runtime mesh: 132 nodes, 9,380 triangles. This is a simplified visual
  model, not verified manufacturing CAD; reference dimensions are illustrative.
- Untouched original logo; derived exterior-only transparency; source SHA-256
  recorded in `static/lab/tc06/branding.json`. Original marks on screen, front,
  rear and cartridge labels. No generated replacement logo.
- Packed-texture editable `assets/tc06/TensorCat-TC06.blend`, runtime GLB and CPU
  mesh JSON, twelve CPU Cycles renders, inspection contact sheet.
- Real mesh picking of physical controls; depression/release and independent
  joystick tilt/return; accessible mirror controls; dynamic screen UI.
- Guarded cartridge FSM: EMPTY, SELECTING, ALIGNING, INSERTING, LATCHING,
  BOOTING, READY, EJECTING. Switching inserted cartridges ejects before loading.
- CPU homogeneous projection/clipping, z-buffer triangle rasterization,
  perspective-correct UV lookup, wireframe/depth lines and point rasterization.
  Three.js is used for math/geometry only. No application WebGL/WebGPU context.
  Browser Canvas compositing may still be hardware-accelerated by the browser;
  this is not a claim that operating-system graphics acceleration is disabled.
- Perspective presets, orbit/pan/pinch handlers, damped orbit continuation,
  reduced motion, adaptive aspect ratio, three quality tiers and offscreen pause.
- Cannon fixed 1/60 s physics, analytic connected-link robot IK/FK, genuine
  proximity grasps, release constraints and bounded end-effector controls.
- Cloth structural/shear/bending links; hollow peg socket and insertion guard;
  contact-driven compound Push-T; three-box packing; long tilted-marker insertion;
  particle-chain rope, ring collider and directed aperture-crossing validation.
- Surface, wireframe, real particles and whole-scene sampled point cloud. Stable
  object/sample IDs and barycentric samples follow actual geometry; particle
  IDs expose actual particle positions. Local/world/relative/camera transforms,
  object/reference selection, point picking and XYZ cross-selection.
- World state/metrics, point count, centroid and extent; JSON, CSV, ASCII PLY,
  trajectory and Canvas PNG exports. CSV/PLY include export timestamps and frames.
- Bounded 180-snapshot timeline at 10 Hz of simulated time; exact pose restore,
  velocities, forces, sleeping bodies, grasp pivots/frames, task/controller state
  and fixed-step counter. Cannon's iterative constraint solver has no persistent
  warm-start lambda cache to serialize. Cross-browser bitwise identity is not
  claimed.
- Independent cloned future rollouts across all tasks; two target/tilt actions,
  sampled terminal-geometry ghosts, gripper paths and outcome comparison. Apply
  an action to current live state, not a teleported predicted state. Branches are
  disposed after computing. Preview is explicitly physics-based, not neural.
- Real gravity/friction/damping/constraint-force/contact-stiffness/solver/speed
  controls, cloth resolution, scene grid/axes/background and sampling controls.
- Optional pause after eight consecutive valid goal evaluations. This intentionally
  pauses the solver; it does not assert that a goal would remain stable if resumed.

## Validation Performed

- `node --test tests/lab-v3.test.mjs tests/nav-motion.test.cjs`: 31 passed.
  Includes all six fixed-step/clone/snapshot journeys, rigid-grasp frame retention,
  IK/FK, aperture/containment tests, deterministic sampling, four coordinate frames,
  exports, depth occlusion/picking, cartridge interlocks, joystick clamping and
  nine existing navigation/Contact regression tests.
- A stationary rigid-grasp regression confirms that an object wakes and follows
  a new target after a long hold, and wakes for gravity after release.
- Zola check and build completed successfully using the existing temporary
  Zola 0.22.1 binary; `public/lab/index.html` and the new modules were generated.
- In-app Chromium checks: 1440x1000 desktop and 390x844 mobile; mobile document
  width exactly 390 px, canvas bounds x=16..374; complete console/cartridge framing.
- Console insertion reached READY; Open lab launched the physical cloth scene.
  A click on projected real A-button geometry selected `a_label.sample-0`.
- A real projected joystick drag produced normalized input (0.59992,0.34995),
  then (0,0) after release. Cloth Auto with pause-at-goal stopped at t=1.53333 s,
  fold progress 0.83980, two grasps, success=true, without modifying its physical
  coordinates to manufacture a success.
- All six scene selectors rendered nonblank software buffers with physical state.
  Whole-scene cloth cloud rendered 2,386 surface samples before explicit particle
  samples were added; current cloud also includes 160 actual cloth nodes.
- Recorded 94 snapshots in a browser session; scrubbing restored t=1.15 s and
  `cloth.node-0.particle` world XYZ=(-0.32000,0.59996,0.03000) while local XYZ=(0,0,0).
  A final downloaded CSV at t=0.25 s was inspected and retained as
  `docs/lab-v3-sample.csv`, including UTC export timestamp, frame and sRGB color.
- Browser branch comparison: live t=1.38333 s stayed unchanged while both
  independent branches advanced to t=2.88333 s and produced different physical
  centers/constraint errors. Earlier browser errors from the initial missing
  trailing asset-path slash were fixed; those earlier logs are not passing tests.
- Final mobile recheck: 390x844, document width 390, six cartridges, native
  `CanvasRenderingContext2D`, no captured runtime errors. Browser proof images
  are retained in `docs/lab-v3-console-*.jpg` and `docs/lab-v3-lab-desktop.jpg`.

## Measured Performance

`node tools/tc06/benchmark.mjs` writes `lab-v3-benchmark.json` with environment,
protocol and raw results. Apple M4 / arm64 / Node 24.19.0; 5 warmups + 20 measured
frames per profile. This includes CPU sampling and rasterization, but not browser
Canvas upload/compositing, and is not an end-to-end browser FPS guarantee.

| Tier | Nominal Buffer | Median CPU Frame Range (cloth/box/rope) |
| --- | --- | --- |
| Low | 480x270 | 5.56-6.73 ms |
| Balanced | 960x540 | 19.19-22.26 ms |
| High | 1280x720 | 33.26-37.10 ms |

Measured physics medians were approximately 0.14-1.56 ms per step in this short
run. Browser spot readings after grid optimization included 12.5 ms at 988x525
for cloth surface and 2.5 ms for point cloud; these are individual samples, not
sustained FPS benchmarks. High tier can exceed the 30 Hz render budget. Mobile
defaults to Low; the renderer caps drawing at 30 Hz, with bounded catch-up physics.

## Numerical Boundaries and Outstanding V3 Requirements

1. **Automatic policies are heuristic, not robust task solvers.** Continuous
   30-second runs reached each geometric goal at least once, but only box packing
   remained successful at the end. Plug/marker can drift out after release; rope
   can slip back or lose valid aperture intersection; cloth fold progress can
   relax; Push-T translation can be close while orientation drifts. Pause-at-goal
   is an explicit UI pause, not a hidden stability correction. Persistent success
   and perturbation recovery remain open acceptance items.
2. Cloth/rope lack self-collision, calibrated constitutive materials and knot
   topology. Sphere particles interact with the table/rigids but not one another.
   Only grippers, not every robot link, have collision bodies. Analytical insertion
   rejection projects invalid penetrations out of the socket and is an explicit
   approximation, not a force/tactile assembly model. Push-T uses a planar constraint
   plus explicit Coulomb-like drag because constrained Y motion lacks normal force.
3. Object-dimension editing for every task, arbitrary collision-shape editing,
   optional task-specific obstacles, full three-axis tool orientation, manipulable
   non-gripper object dragging, and per-task configurable success thresholds are
   not implemented. Existing controls do not pretend to provide them.
4. Prediction ghosts are sampled terminal surfaces, not translucent solid ghost
   meshes. Future contacts are reported as physical counts, not visual per-contact
   arrows. Full per-object future path visualization and editable multi-step action
   sequences remain outstanding. Counterfactual inputs currently edit one arm's
   target X and tool tilt; other coordinates use its current target.
5. Coordinate inspection has centroid/extent and an object selector, not a
   collapsible full hierarchy/tree UI or rendered bounding-box gizmos. The point
   list shows up to 300 entries per filter; picking or narrowing the object filter
   provides access to other points. Point export is not limited to those 300.
6. Native Safari, physical touchscreens, real trackpad gestures, audio on every
   browser, and screen readers were not fully hardware-tested. Touch/pinch handlers
   exist; the in-app CDP bridge does not support synthetic touch dispatch, so that
   must not be reported as passed. Actual fullscreen and every camera preset need
   broader cross-browser testing. No hardware-acceleration-disabled run was made.
7. No neural world model, perception model, training, inference, CUDA, robot hardware
   control, or real-world safety claim is part of this prototype. No long-duration
   heap profile or exhaustive browser endurance test has yet been performed.

## Reproduction and Acceptance

Follow the Lab commands in the root README. Asset generation is offline; visitors
only receive static files. Zola and Git are enough for deployment; Node is for
tests/benchmarks, Python/Pillow for artwork preparation, Blender 4.x for rebuilding
the optional model source and CPU previews.

The next acceptance pass should prioritize stable post-release insertion,
orientation-aware Push-T completion, rope retention and perturbation tests, then
the remaining inspector/geometry controls and real-device gesture verification.
Keep this ledger and the benchmark alongside the code; do not silently lower the
supplied V3 requirements or label this prototype a completed research simulator.
