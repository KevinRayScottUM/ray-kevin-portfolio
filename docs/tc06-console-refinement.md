# TC-06 Console Mode Refinement

Historical console-integration pass. The later [interaction refinement](tc06-interaction-refinement.md)
supersedes its two-step insertion, camera and upper-rack behavior. Its physics
and source-resolution work remains in use.

Local implementation, 2026-11-10. The existing Zola/Kodama portfolio, navigation
transitions and vector cursor are unchanged. No production deployment is implied.

## Architecture and Modified Sources

- `static/js/lab-v3/session.js`: canonical experiment lifecycle and world cache
  access, independent of its Console or Lab presentation.
- `static/js/lab-v3/mechanics.js`: group-local cartridge bounds, internal bay
  travel, projected screen intersection and solid-geometry picking.
- `static/js/lab-v3/experiment-view.js`: shared gripper manipulation and inner
  camera gestures, used by both presentations and Focus screen.
- `static/js/lab-v3/embedded-display.js`: independent live CPU framebuffer using
  the existing scene, camera and simulator. No prerecorded or parallel mini sim.
- `static/js/lab-v3/console.js`: mechanical FSM, A launch, contextual physical
  controls, independently animated button caps, live display and menus.
- `static/js/lab-v3/graphics.js`: DPR-aware CPU buffers, texture mipmaps, premultiplied
  bilinear sampling, single-sided decals and cached outer geometry/depth.
- `static/js/lab-v3/app.js`: one animation/physics loop, input arbitration, Focus,
  inspector routing, lifecycle cleanup and measured timing diagnostics.
- `static/styles/lab-v3.css`: responsive Focus dialog only; no portfolio redesign.
- `tools/tc06/{generate_console,process_assets}.py`: editable source geometry,
  internal bay, circular rear badge, upper rack and sharper physical label assets.
- `assets/tc06/TensorCat-TC06.blend`, `static/lab/tc06/`: regenerated packed source,
  GLB, CPU mesh JSON, textures and twelve CPU Cycles inspection previews.
- `tests/tc06-console.test.mjs`: focused geometry, lifecycle, input and rendering
  regressions; `tests/lab-v3.test.mjs` uses the actual ejection duration.

## Cartridge Mechanics

All six cartridges retain their actual scale and dimensions. The presentation
row is above the housing at Y=0.135 m, at exactly the slot's Z=0.001 m depth.
Three cards sit on either side of a clear central insertion lane.
The approach first lifts clear of the rack, translates over the slot, then
descends on the slot axis. The reverse path restores the exact presentation pose.
Automated swept-bound sampling checks all six routes against neighboring cards.

The internal bay is a boolean cavity in all three shell layers, not an exterior
decorative slot. Its runtime bounds are X=[-0.023,0.023], Y=[0.001,0.079],
Z=[-0.007,0.009] m. The mouth is Y=0.073 m. The final seated position is computed
from each card's actual group-local bounds, with its top just 0.0005 m below the
mouth. Its colored top remains naturally visible through the opening. The mesh
stays visible at its real seated position: shell geometry provides occlusion,
not artificial hiding. There is no shutter, sliding lid or closing animation.
Ejection directly raises the same mesh and reverses its approach. It is never shrunk.

Mechanical states are EMPTY/SELECTING, ALIGNING (0.70 s), INSERTING (0.85 s),
READY and EJECTING (1.25 s). Repeated insert/eject inputs are
interlocked; replacement ejects the old card first. Runtime BOOTING (0.24 s)
begins only after A, not automatically during insertion.

## Shared Runtime and Input

`ExperimentSession` owns the active world and runtime state. A single cache holds
the six existing `WorldSimulator` instances. Switching presentation preserves
the same object, physical time, body poses and targets. Reset explicitly disposes
and recreates only that world; ejection pauses and closes its screen presentation.
Selecting a different Lab task cannot display it under the wrong cartridge.

The same fixed-step physics loop runs in Console and Lab. The embedded renderer
projects the actual scene into an independent 16:9 canvas, then uses that canvas
as the physical display's dynamic texture. Screen view modes and the experiment
inspector refer to real geometry/state. Focus magnifies this same framebuffer;
it creates neither a second simulation nor a new physics loop.

| Input | Ready / running behavior |
| --- | --- |
| A | Launch inserted experiment; toggle gripper/release, or Push-T push action |
| B | Open pause menu; a second B returns to cartridge menu without ejecting |
| Start | Pause menu / resume; never a required launch step |
| Select | Arm selection, XY/XZ plane, auto sequence, tilt and resume tools |
| D-pad Up / Down | Zoom the inner experiment camera in / out |
| D-pad Left / Right | Inactive during the experiment; no robot or camera movement |
| Analog joystick | Orbit the inner experiment camera like a screen drag |
| Screen gripper drag | Ray-pick actual palm/fingers and update the real arm target |
| Screen empty drag | Orbit inner experiment camera only |
| Screen wheel / pinch | Inner camera orbit or zoom; outer camera unchanged |
| Housing / empty outer area drag | Orbit outer handheld camera |
| Right/middle drag | Pan the corresponding camera |

Pointer routing prioritizes accessible UI, physical controls, projected screen,
then outer camera. Pointer capture preserves the owner until release/cancel;
blur, reset, dialog close and page disposal release held controls and dragging.
The screen mapping casts a camera ray, transforms it by the inverse physical
screen matrix, intersects its local plane, and normalizes its bounds into UV.
The normalized V axis is flipped for canvas coordinates. It is not a fixed
screen-space rectangle: rotation, pan, zoom, viewport resize and perspective are
accounted for. Back-facing screen rays and hits blocked by housing are rejected.

## Rendering and Branding

The scene uses Canvas 2D / ImageData software triangle rasterization. Three.js
provides geometry, matrices and ray intersection, not a WebGL renderer. No GPU
compute, WebGPU, neural inference, server or runtime dependency was added.

The embedded framebuffer is 1024x576 by default, 1280x720 at High and up to
1536x864 in Focus. The outer backing store follows CSS size and DPR, with real
supersampling and area caps (Balanced 1.8 MP, High 3.2 MP, Adaptive 1.6 MP).
High respects up to 2x DPR; Balanced up to 1.5x. Browser downsampling, bilinear
alpha-aware texture filtering and mip selection replace nearest-pixel enlargement.
Curves use denser geometry; cartridge label textures match their physical aspect.

When the handheld, view and selection are stationary, its image/depth/IDs are
cached. Only the live physical screen is rerasterized against retained occlusion;
camera or physical hardware animation invalidates that cache. Frame timing is
measured separately for outer renderer, embedded renderer and physics. A 30 Hz
draw cap and bounded physics catch-up prevent unbounded frame work. Adaptive
resolution keeps a redraw pending after resizing, including paused scenes.

The inner Surface scene also caches only when its exact visible mesh matrices,
material colors, deformable vertex coordinates and camera matrices are unchanged.
Moving bodies, cloth/rope deformation and camera gestures invalidate it; elapsed
time alone does not require rerasterizing stationary geometry. The HUD still
updates independently. This avoids freezing real motion to save work.

The rear mark is a true 128-sided circular mesh with equal X/Y diameter and
uniform UV mapping, backed by a circular disk. The original supplied cat image
is preserved; no replacement cat was drawn. `Logo_Front` alone was removed.
The front TensorCat wordmark, main screen branding, rear mark and cartridge
branding remain. The original asset SHA-256 remains
`4d5d469fc8ab09c62d5035b3d8565c0034b694b853307837b1170a1649c1c158`.

## Validation

Automated command:

```bash
node --test tests/lab-v3.test.mjs tests/tc06-console.test.mjs tests/nav-motion.test.cjs
```

56 tests pass, covering six internal fits, repeated replacement, upper-rack
clearance, A boot, no Start requirement, shared world identity, pause/back,
wrong-cartridge prevention, camera zoom/orbit without robot-target drift, grip, perspective/orthographic UV,
rear occlusion, DPR caps, live cached-screen updates, drag ownership, existing
physics/snapshots/exports and navigation regressions.

Browser journeys exercised all six cartridges: Insert -> READY -> A -> actual
physical time advancing on the embedded display -> Eject -> EMPTY. Each stayed
in Console, retained scale, and reached a wholly contained final seat. A physical
mesh click on the actual A cap also launched BOX. Projected palm dragging changed
its real target while both outer and inner camera poses remained unchanged.
The final browser pass also verified Up/Down zoom, inactive Left/Right, physical
joystick orbit, isolated outer view, pause time remaining constant, and exact
paused body positions across Console -> Lab -> Console. Surface, Wireframe,
Particles and Point cloud stayed in Console with an updating physical screen.
The 390x844 responsive check had document width exactly 390 px and a canvas at
X=16..374 px, with the upper rack and handheld fully framed. No captured runtime
errors were present.

### Measured Performance

Apple M4, in-app Chromium browser, 1440x1000 viewport, DPR 1, Balanced, BOX after
settling, stationary cameras, 40 observations of distinct embedded frames:

| Measurement | Median | 95th percentile |
| --- | --- | --- |
| Outer CPU render | 7.4 ms | 8.0 ms |
| Embedded CPU render | 3.4 ms | 4.0 ms |
| Total measured frame work | 20.3 ms | 22.3 ms |

Observed draw rate was approximately 21-24 FPS under the 30 Hz draw cap. Outer
buffer: 1365x725; inner: 1024x576. Both geometry caches were active. These are
settled-scene observations, not a claim about moving cloth, high-resolution
mobile performance or guaranteed 30 FPS. Camera movement and changing physical
geometry cost more. Raw samples and journey outcomes are in
`tc06-refinement-browser-qa.json`.

Browser proofs: `tc06-refinement-upper-rack.jpg`, `tc06-refinement-focus.jpg`,
`tc06-refinement-rear.jpg`, and `tc06-refinement-mobile.jpg`.

## Limits

These remain illustrative CPU robotics scenes, not validated research results or
a trained world model. Existing controller stability limits, analytic rejection
for tight insertion and missing cloth/rope self-collision are unchanged; refer
to the initial V3 ledger for the full physics caveats. Higher resolution costs
CPU time and cannot promise 30 FPS on every device. Native MacBook gesture feel
and physical mobile touchscreen hardware need a manual device check; automated
pointer/wheel and mathematical projection tests do not prove those hardware tests.
The browser compositor may use hardware acceleration independently of this app's
CPU-only scene renderer. Local validation does not imply Cloudflare deployment.
