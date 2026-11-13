# Kevin Ray Scott Portfolio

Static personal portfolio website for Kevin Ray Scott (雷凯文 / LEI KAIWEN), built with [Zola](https://www.getzola.org/) and the [Kodama theme](https://github.com/adfaure/kodama-theme).

The site is designed as a clean academic and professional portfolio for internship, job, and future PhD or research applications. It includes a homepage, project experience page, about page, blog/notes section, and contact page.

Blog bookmark and share controls are lightweight frontend interactions. Blog likes use a Cloudflare Pages Function at `/api/likes` with a D1 database binding, so public like counts can update across browsers and devices after deployment. The visitor's browser still uses `localStorage` only to avoid repeated likes from the same browser.

## Local Setup on macOS

Install the required tools:

```sh
brew install zola git
```

Open the project root:

```sh
cd /Users/kevin/PycharmProjects/TensorCat/ray-kevin-portfolio
```

## Required Tools

- Zola
- Git

Check that they are available:

```sh
zola --version
git --version
```

## Run Locally

```sh
zola serve
```

Zola will print a local URL, usually `http://127.0.0.1:1111/`.

## Check and Build

```sh
zola check
zola build
```

The production static site is generated in:

```text
public
```

## Cloudflare Pages Deployment

Use these settings for Cloudflare Pages:

```text
Build command: zola build
Build output directory: public
```

Deployment steps:

1. Push this project to GitHub.
2. Open the Cloudflare Dashboard.
3. Go to **Workers & Pages**.
4. Select **Create application**.
5. Select **Pages**.
6. Select **Connect to Git**.
7. Select the GitHub repository.
8. Set build command to `zola build`.
9. Set build output directory to `public`.
10. Add environment variable if Cloudflare requires it:

```text
ZOLA_VERSION = 0.22.1
```

11. Deploy.
12. After deployment, copy the generated `*.pages.dev` URL.
13. If the URL is not `https://kevinrayscott.pages.dev/`, update `base_url` in `config.toml` and push again.

After Cloudflare Pages creates the real URL, update `base_url` in `config.toml` if the final URL is different.

## Cloudflare D1 Blog Likes

The blog like counter is backed by a small Cloudflare Pages Function:

```text
functions/api/likes.js
```

The function expects one D1 binding. Use this binding name:

```text
DB
```

Recommended setup in Cloudflare Dashboard:

1. Open **Cloudflare Dashboard**.
2. Go to **Workers & Pages**.
3. Open the Pages project for this portfolio.
4. Create a D1 database, for example `ray-kevin-portfolio-likes`.
5. Open the Pages project's settings.
6. Add a D1 database binding.
7. Set the binding variable name to `DB`.
8. Select the D1 database you created.
9. Save and redeploy the Pages project.

The function automatically creates the `blog_likes` table if it does not exist. The initial counts are seeded from the current blog note defaults the first time each post is requested.

Behavior:

- `GET /api/likes?posts=post-a,post-b` returns public counts.
- `POST /api/likes` with `{ "postId": "post-a", "action": "like" }` increments that post count.
- `POST /api/likes` with `{ "postId": "post-a", "action": "unlike" }` decrements that post count without going below zero.
- Open blog pages refresh cloud counts on load, when the tab becomes visible again, and about every 30 seconds while visible.
- If D1 is not bound yet, the page gracefully falls back to the static Markdown count and local browser state.

## Base URL Reminder

The current temporary Cloudflare Pages base URL is:

```text
https://kevinrayscott.pages.dev/
```

If the final Cloudflare Pages URL or a custom domain changes, update `base_url` in `config.toml` before building or deploying.

## Editorial Presentation

The presentation layer in `static/styles/editorial.css` follows the owner's
supplied editorial reference: serif headings, restrained green accents, fine
rules, and alternating paper/white surfaces. WebsiteBench was inspected as a
website-reconstruction benchmark, not installed as a Zola theme. No third-party
reference-site content or benchmark environment is included.

Existing navigation transitions, cursor behavior, blog actions, and Lab input
handlers are retained. The underlying site remains Zola with Kodama templates.

## TensorCat Lab

The `/lab/` route is a data-driven exhibit collection. Exhibit 01, TensorCat / Interactive World Simulator,
lives at `/lab/world-simulator/`. Entries are defined in `data/exhibits.toml`;
the gallery renders a real CPU-rendered preview without loading the simulator.
The collection uses a 28% project index and a full remaining-width showcase.
Its native Web Animations transition moves outgoing and incoming project presentations
together over 760 ms, with overlap, directional slides and a latest-request-wins controller.
Only available registry entries can be selected. The three reserved slots are disabled
and automatically disappear when a registered exhibit uses their number.

Add real exhibits to `data/exhibits.toml` with a unique `id` and `number`, numeric `order`,
`status = "Available"`, a real `route`, title, subtitle, description, `technology_tags`
and `cover`. Optional `index_subtitle`, `index_tags`, `cover_fit`, `cover_width` and
`cover_height` customize presentation. No client registry or transition code needs editing.
The preview frame is 16:9; choose `cover_fit = "contain"` when cropping is inappropriate.
The current TensorCat cover is a 1440x810 export of the actual High-quality CPU scene
and cartridge framebuffers, framed without cutting any hardware. It remains the
loading/error/no-JavaScript fallback. Exhibit 01 adds `preview_component = "tensorcat-showcase"`:
an independently controlled, real-geometry 360-degree hardware tour replaces the
fallback after its first rendered frame. It does not start a robotics session.

Horizontal wheel/trackpad gestures and pointer dragging progressively drive one
unwrapped 0-to-360-degree tour; vertical scrolling and browser pinch zoom retain
their normal behavior. Eight composed poses share an exact critically damped
spring, bounded release inertia, and independent camera/transform state. Compact
arrows and focused Left/Right/Home/End use the same controller. Returning from
another project resets the tour to its original front composition.
The six cartridges use an unchanged, separately cached geometry layer.
The main framebuffer renders only while changing, then restores idle high-DPI
quality; it stops offscreen, on hidden documents, and when leaving the project.

The gallery keeps the active preview during image preparation, preloads adjacent
available entries, reserves the tallest metadata layout, supports keyboard selection,
and keeps at most two live preview layers during motion. It does not initialize robotics.
Matrix rain is independent and is neither remounted nor reset when projects change.
At 800px and below, the index becomes horizontally scrollable above the full-width preview.
Reduced motion switches previews without a large slide. Internal browser fixtures
live only in `tests/fixtures/` and are never copied into the deployed site.
It remains static Zola: no service, model weights, inference requests, or new
runtime package installation. Three.js r170 supplies geometry and math only;
projection, clipping, depth testing, UV interpolation, geometric sampling and
rasterization execute on the CPU with Canvas 2D / ImageData. cannon-es supplies
fixed-step physics, not a trained world model.

Console mode opens by default without an external control sidebar. Click a cartridge in the upper gallery;
it inserts automatically. Wait for READY,
then press A to run the real experiment inside the handheld screen. Start opens
the pause menu; it is not a launch requirement. A/B, D-pad, joystick, Start/Select and the screen
are independently selectable 3D geometry, with keyboard input on the canvas.
Six front-facing cartridges occupy uniformly spaced, screen-anchored
slots above the handheld. The chosen card leaves its slot empty while the other
five stay put; ejecting returns it to that exact slot. The actual transfer card
aligns over the slot and descends into the internal bay. Transparent gallery
pixels and a depth-aware foreground pass prevent any white rectangle or gallery
card from hiding it. Only the housing naturally occludes the seated cartridge.
Replacing a cartridge ejects the old one first; rapid requests queue the latest
choice without restarting an in-flight movement. Lab mode is an explicit expanded presentation of the same cached
experiment world, not an automatic destination after pressing A.

Cartridges have critically damped pointer-relative 3D hover capped at 16 degrees yaw / 14 degrees pitch;
the handheld uses 8 / 7 degrees. The outer camera remains front-facing while the hardware transforms:
small drags return to the current face; deliberate flips snap to Front or Back
over 400 ms. The gallery does not rotate or zoom with the handheld. Front/Back
are the only Console view presets; the expanded Lab retains its free camera.

The physical lower-front OFF/ON slider is the Console power control.
Default is ON. OFF pauses the shared
runtime, clears captured input, darkens the screen and dims the existing LED;
mechanical insertion/ejection and hardware inspection remain available. ON shows
the inserted cartridge's ready screen and waits for A; it never silently resumes.

Six tasks share world state, sampling and inspection: cloth, peg insertion,
Push-T, box packing, slender-marker insertion and rope threading. Surface,
wireframe, real particles and full-scene sampled point clouds use actual
geometry. Inspect world/local/relative/camera XYZ; export point CSV/PLY,
world-state JSON, trajectory JSON and viewport PNG locally.

Drag outer empty space deliberately to flip; right/middle drag pans. Outer
two-finger scrolling uses the same magnetic face constraints; Ctrl+wheel or
Safari pinch zooms. Inner screen and expanded Lab use their separate free camera.
Touch pointers combine two-finger rotation/pinch. Drag actual grippers on the projected screen or in Lab mode; screen
input is ray-mapped into its local UV coordinates and never orbits the outer
handheld camera. Focus screen enlarges the same live framebuffer without
switching mode. D-pad Up zooms in, Down zooms out, and Left/Right are inactive
during the experiment. The physical analog joystick orbits the inner experiment
camera, like dragging its screen. Select opens arm, axis, tilt, sound
and auto-sequence tools. A toggles the gripper (Push-T triggers its push action),
B backs out through the pause menu, and Start pauses/resumes. Focus the
canvas for arrows, A/Enter, B/Escape and Space. Reduced motion starts physics
paused. Simulation rendering stops while hidden or offscreen. A separate lightweight
background pass remains active when scrolling through the visible Lab page.

The Lab collection and exhibit pages share a dark studio palette and full-page
Matrix-inspired code rain, including header gaps, outer margins and footer backgrounds.
Console mode also has a masked stage layer, so its opaque software-rendered viewport
does not interrupt the background treatment. Glyphs never intercept pointer events;
reading areas and projected hardware are cleared. The backdrop redraws at most 10 Hz,
pauses in hidden tabs and is disabled by reduced-motion preferences. Exhibit backgrounds
reuse the existing frame scheduler rather than starting another simulation loop.

The CPU renderer adds material-specific diffuse, roughness-dependent specular,
Schlick Fresnel, an analytic softbox highlight and approximate ground shadow.
These are software shading approximations, not a physically validated PBR pipeline.
Screen reflections are bounded to preserve experiment readability. Hard model edges
and smooth side surfaces use Blender corner normals; static hardware shading is cached.

The shared touchscreen system overlay has a vector Eject icon at the top right
in Ready, Running and Pause states. It uses the physical screen ray/UV mapping,
not an external page hitbox. Ejection parks the shared session, releases input,
cancels previews/replay, returns the card to its gallery slot and stays in Console.
It is unavailable during boot/transfer and when powered off. The neighboring
in-screen expand icon opens Focus; its Eject action uses the same lifecycle.
Select opens sound/quality settings before launch; the experiment Tools menu
retains sound configuration after launch.

Research Inspector is a native keyboard-operable disclosure, initially collapsed
in Console and expanded in Lab. Each mode remembers its disclosure preference.
It contains Coordinates, World state, Timeline, Prediction, rendering/sampling,
view presets, reset and exports. Collapsing preserves selections and world state
and skips inspector table/statistic refreshes, not physics. Lab retains its
standalone controls and top representation toolbar. No duplicate external
Console D-pad, Power, Launch or Eject controls are mounted.

The embedded scene has an independent 1024x576 backing store (1280x720 at High,
up to 1536x864 in Focus). Outer rendering follows CSS size and device pixel ratio
with tier-specific safety caps, real supersampling, bilinear alpha-aware texture
sampling and mipmaps. Stationary handheld geometry is depth-cached while the live
screen is rerasterized. The rear badge is a circular mesh using the unchanged
original artwork; only the small lower-left front decal was removed.

Timeline records bounded snapshots for scrubbing/replay. Prediction compares
two cloned physical rollouts with target/tilt actions, terminal geometry samples,
paths and measured outcomes. Applying commits an action, not the predicted
terminal state. Previewing does not advance the live world. "Pause at goal"
stops after eight consecutive valid evaluations; disable it to study subsequent
instability. Goal detection is not a guarantee of sustained physical stability.

Source map: `templates/{lab,lab-gallery}.html`, `templates/macros/exhibit.html`, `data/exhibits.toml`,
`static/styles/{lab-v3,lab-exhibition}.css`, `static/js/{lab-rain,lab-gallery,lab-showcase,lab-showcase-motion,lab-showcase-scene}.js`,
`static/js/lab-v3/{app,graphics,studio,console,session,mechanics,motion,gallery,power,inspector,embedded-display,experiment-view,robot,simulation}.js`, and
`static/lab/tc06/experiments.json`. Old cloth/SVG files are retained but not loaded.
Licenses remain in `static/vendor/` and `static/img/lab/icons/LICENSE`.

Reproduce assets and checks from the repository root:

```bash
python3 tools/tc06/process_assets.py /Users/kevin/Desktop/TensorCat.png
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/tc06/generate_console.py -- --render
node --test tests/*.test.mjs tests/*.test.cjs
node tools/tc06/benchmark.mjs
zola check
zola build
zola serve
```

Asset preparation requires Pillow; only model generation requires Blender 4.x.
Neither is required by visitors or Cloudflare Pages. The editable, packed-texture
`.blend` lives in `assets/tc06/`. GLB, CPU mesh JSON, original logo, derived badge,
labels and twelve CPU previews live in `static/lab/tc06/`. The original logo is
copied byte-for-byte; only exterior-connected white pixels become transparent
in the derived badge. Provenance is recorded in `branding.json`.

See [V5 hardware showcase architecture, measurements and limits](docs/lab-showcase-v5.md),
[V4 gallery architecture and validation](docs/lab-gallery-v4.md),
[exhibition, studio and background validation](docs/lab-exhibition-studio.md),
[minimal Console workspace refinement](docs/tc06-minimal-workspace.md),
[earlier interaction refinement and validation](docs/tc06-interaction-refinement.md),
[earlier console integration](docs/tc06-console-refinement.md),
[initial V3 implementation ledger](docs/lab-v3-status.md) and
[measured benchmarks](docs/lab-v3-benchmark.json) for features, validation,
approximations and remaining V3 requirements. This is a runnable local prototype,
not full V3 acceptance or a validated robot system. Production releases deploy from
GitHub `main` through Cloudflare Pages; check the deployment status for the latest commit.
The [3D World Simulator](https://jwang771.github.io/3dworldsimulator/) provides
research inspiration; its neural model and service are not embedded.

## Language and Appearance (V6)

The header includes an EN / 中 selector beside the brand and a sun / moon
selector after Contact. English and Light are the first-visit defaults. Explicit
choices persist in `tensorcat.language` and `tensorcat.theme` in localStorage,
including navigation, refresh and other open tabs. No account or database is
needed for these preferences. Changing them does not restart a Lab experiment.

Interface messages and article metadata live in `data/locales.json`. English
articles remain in `content/`; independently authored Chinese bodies live in
`locales/zh-CN/` with matching names. Add both message languages, then regenerate
the checked-in browser catalog:

```sh
node tools/build-locales.mjs
node tools/build-locales.mjs --check
node --test tests/*.test.mjs tests/*.test.cjs
zola check
zola build
python3 tools/check-localized-build.py
```

Node.js and Python 3 are development-validation tools only. Cloudflare Pages
still builds with `zola build` and publishes `public`; no new runtime dependency
or server is required. A future article without a Chinese body explicitly shows
its English original with a Chinese notice instead of claiming a translation.
Original research figures, formulas, technical identifiers and downloaded data
are not automatically translated or recolored.

See [V6 implementation, validation and limitations](docs/portfolio-v6-preferences.md)
for the architecture, responsive behavior and actual regression results.

## GitHub Preparation

If this project is not already committed to GitHub, run:

```bash
cd /Users/kevin/PycharmProjects/TensorCat/ray-kevin-portfolio
git init
git add .
git commit -m "Build Kevin Ray Scott portfolio website"
git branch -M main
git remote add origin https://github.com/KevinRayScottUM/ray-kevin-portfolio.git
git push -u origin main
```

If Git is already initialized, skip `git init`. If a remote already exists, check it with:

```bash
git remote -v
```

Then commit and push with:

```bash
git add .
git commit -m "Update Kevin Ray Scott portfolio for Cloudflare Pages"
git push
```
