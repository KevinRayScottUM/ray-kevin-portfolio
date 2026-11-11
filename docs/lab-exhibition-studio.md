# TensorCat Lab: Exhibition and Studio Refinement

## Delivery

This is a static-Zola release deployed from GitHub `main` through Cloudflare Pages.
Production: https://kevinrayscott.pages.dev/lab/.
The local preview runs at http://127.0.0.1:1111/lab/.
The validation below was performed before release; the GitHub commit's Cloudflare
Pages check records the deployment outcome.

- `/lab/` is a collection rendered from `data/exhibits.toml`.
- `/lab/world-simulator/` contains Exhibit 01, **TensorCat / Interactive World Simulator**.
- The collection loads a rendered preview and lightweight background code, not the physics runtime.
- The parent Lab navigation remains active inside the exhibit, but clicking it returns to the collection.
- The original navigation, Contact behavior and TensorCat cursor are retained.

## Page-Wide Code Rain

`static/js/lab-rain.js` supplies a fixed, viewport-sized background for both routes.
It covers the heading area, page margins, space between sections and footer.
The shared header is translucent only on Lab pages. Other portfolio pages are unchanged.

Console mode has an additional stage-local layer because the software-rendered scene
has an opaque backing store. Its mask follows the projected chassis and each visible
cartridge, including during motion. The scientific Lab canvas remains an unobscured
data visualization; its surrounding page uses the same animated background.

The current palette uses green tails and brighter mint heads: tail alpha 0.42,
head alpha 0.55, 13 px glyphs, 28 px columns, nominal speed 30 CSS px/s.
Glyphs redraw at most every 100 ms. Reading masks protect navigation labels,
headings, descriptions, Inspector controls/tables and footer text. Canvas layers
have `pointer-events: none` and `aria-hidden`.

The exhibit reuses its existing animation scheduler. Scrolling the experiment out
of view pauses expensive simulation/render work while keeping the page backdrop
alive. Hidden tabs stop scheduling. Reduced-motion preferences hide the rain;
restoring normal motion restarts it. Viewport resize updates the full-page buffer,
and disposal removes canvases and observers/listeners.

## Studio Rendering and Interaction

The CPU pipeline adds world-normal Lambert diffuse, roughness-dependent Blinn-Phong
specular, bounded Schlick Fresnel and an analytic softbox highlight. Eight material
families distinguish housing, rubber, buttons, cartridges, metal, recesses, labels
and glass. Screen specular is capped at 0.065 and diffuse remains at least 0.82.
An elliptical ground-shadow approximation anchors the handheld. These are software
shading approximations, not ray tracing or a validated physical PBR implementation.

Vertex lighting deduplicates identical position/normal pairs; the static hardware
cache still allows the live display to update independently. Blender corner normals
retain hard cap edges and smooth shell/cylinder side surfaces. Editable Blender,
GLB, CPU mesh and previews were regenerated. Visitor-facing obsolete model names
were removed; internal `tc06` paths and asset filenames remain for compatibility.

Cartridge hover limits are 16 degrees yaw / 14 degrees pitch, handheld limits
8 / 7 degrees, with damped settling. Front/back magnetic snaps retain the existing
400 ms duration and 110-degree drag threshold. Slot positions, transfer/ejection,
power, D-pad/joystick, embedded experiments and minimal Console Inspector behavior
are preserved. The Frameboy reference was visually inspected; no assets were copied.

## Validation

- 110 Node tests passed across all six test files, including background masking,
  throttling, reduced motion, disposal, offscreen scheduling, lighting and existing mechanics.
- `zola check` and `zola build` returned exit code 0 with Zola 0.22.1.
- Generated HTML contains both routes and production asset URLs.
- In-app browser checks covered collection entry/return, the active parent nav,
  native page refresh, and leaving Lab without retaining a rain canvas on Home.
- All six experiments were exercised through insertion, run and Eject during the
  studio refinement; cloth insertion/run was repeated with both background layers.
- Expanded Lab point cloud produced 2,546 real geometry samples with Inspector open.
- At 390 x 844, document width equaled viewport width. Both rain buffers resized
  correctly; scrolling to Inspector/footer kept the page backdrop active.
- Browser reduced-motion emulation hid both rain layers and paused physics.
  The override was removed after testing.
- Native Safari/MacBook gestures were not independently verified on physical hardware.

Final background-enabled runtime measurements are saved in
`lab-exhibition-performance.json`: M4/in-app browser, 617 x 556 CSS viewport, DPR 2,
Balanced cloth simulation, 878 x 690 outer and 1024 x 576 inner buffers, 40 distinct
embedded-frame observations. All 40 outer frames used the hardware cache.

| Component | Median | P95 |
| --- | ---: | ---: |
| Outer renderer | 6.5 ms | 7.1 ms |
| Embedded renderer | 23.8 ms | 24.8 ms |
| Physics | 6.0 ms | 8.5 ms |
| Measured frame work | 47.4 ms | 53.6 ms |

The sampled FPS diagnostic was approximately 19.3. This is one local measurement,
not a fixed frame-rate guarantee. Components are sampled independently and should
not be summed as if they were a single synchronized trace.

Screenshots: `lab-exhibition-gallery.png`, `lab-exhibition-studio.png`,
`lab-exhibition-mobile.png`. The original logo remains byte-for-byte unchanged.
