# Portfolio V6: Language and Appearance

## Scope and Release Status

Implemented locally on the existing Zola/Kodama site, based on commit `9676411`.
No router, frontend framework, database, neural service or animation dependency
was added. Production publication was approved on 2026-11-13 and uses the existing
GitHub `main` to Cloudflare Pages connection. This report records the implementation
and pre-release verification; the commit's Cloudflare Pages check records its
deployment outcome.

The original English content, URLs, project links, research metrics, uploaded
figures, physical model, physics implementation, navigation motion and cursor
artwork remain in place. Translation updates presentation, not scientific state.

## Shared Controls and Header

`templates/macros/nav.html` contains two instances of the same segmented-control
pattern. Shared CSS and one event handler own their appearance and behavior.

Desktop order:

1. Kevin Ray Scott | TensorCat
2. EN / 中
3. Home, Project Experience, About, Blog / Notes, TensorCat Lab, Contact
4. Sun / Moon

Both controls use a real sliding thumb with a 320 ms
`cubic-bezier(.22,1,.36,1)` transition, muted inactive options, selected-state
contrast, a subtle press response and visible keyboard focus. Sun and Moon are
local Lucide SVGs, not platform-dependent emoji. Contact retains its persistent
pill, active fill and no-underline behavior. Ordinary tabs retain their existing
slide and repeat-click animations. Locale changes remeasure the active underline.

The header fits a single row at the tested 1920, 1440 and 1280 px widths. At
1024 and 768 px, controls share the brand row and navigation has its own row.
At 390 px, the brand, preference controls and existing horizontally scrollable
navigation occupy three compact rows. There is only one instance of each
control. Mobile tracks are 44 px tall. The original mobile navigation was kept;
a new hamburger menu was not introduced.

## Preference State and Initial Rendering

`preferences-core.js` owns validated language/theme values and subscriptions.
Only `en` / `zh-CN` and `light` / `dark` are accepted. Defaults are English and
Light, independent of the operating system. Local storage failures are caught.
Invalid values are ignored and no-op selections do not trigger updates.

`preferences-init.js` is a blocking external script before every stylesheet.
It restores the root `lang`, `data-language`, `data-theme` and `color-scheme`
before content styling can paint. Templates include both static label languages;
CSS selects the saved one while modules load. JavaScript subsequently replaces
marked labels with their selected plaintext. There is no deliberate white overlay
or whole-document fade for a preference change.

`preferences.js` binds the controls, title, marked metadata and storage events.
Changes apply in the current document without reload. Cross-tab storage events
update existing controls without writing the same setting back. `pageshow`
restores preferences when navigating through browser history.

Language changes use a restrained 180 ms content opacity/3 px motion. Theme
changes transition semantic colors over 320 ms. Existing navigation, photo,
quote-card and cursor animations are not replaced. Reduced-motion users receive
immediate preference transitions and no additional language animation.

## Translation Architecture and Coverage

`data/locales.json` is the canonical dictionary: **407 paired English/Chinese
messages**. Keys describe meaning rather than matching English text in the DOM.
`tools/build-locales.mjs` validates key syntax, language completeness and matching
interpolation arguments, then generates `static/js/locales/catalog.js`.
The Python standard JSON parser additionally rejects duplicate keys. The browser
catalog is checked in, so Cloudflare still needs only `zola build`.

`i18n.js` safely updates only explicitly marked text/attributes using textContent
and setAttribute. It does not scan English prose or inject translated HTML.
Dates use Intl with explicit locale and UTC handling. Page titles, descriptions,
Open Graph labels and research-figure alternative text also update.

The translation includes Home, Project Experience, About, Contact, the complete
Blog index, 13 existing notes, 404, gallery descriptions, hardware-tour labels,
console menus, task objectives, simulator controls, tooltips, inspection tabs,
status text and export feedback. Model names, units, coordinates, physical A/B
labels, object/sample IDs and raw JSON keys remain stable technical identifiers.

English Markdown is untouched. Separate Chinese bodies are in:

- `locales/zh-CN/home.md`
- `locales/zh-CN/about.md`
- `locales/zh-CN/project-experience.md`
- `locales/zh-CN/blog/coordinate-circles-and-curvature.md`
- `locales/zh-CN/blog/forecast-horizon-dependence.md`
- `locales/zh-CN/blog/rankings-and-feedback-rounds.md`
- `locales/zh-CN/blog/when-rubrics-cannot-decide.md`
- `locales/zh-CN/blog/possible-state-greedy-search-for-game-strategy.md`
- `locales/zh-CN/blog/weight-space-is-curved.md`
- `locales/zh-CN/blog/federated-learning-beyond-data-sharing.md`
- `locales/zh-CN/blog/why-harness-engineering-matters.md`
- `locales/zh-CN/blog/retrieval-is-not-grounding.md`
- `locales/zh-CN/blog/agent-evaluation-beyond-task-success.md`
- `locales/zh-CN/blog/reward-design-for-grounded-agents.md`
- `locales/zh-CN/blog/medical-ai-needs-explainable-failure.md`
- `locales/zh-CN/blog/multimodal-interfaces-for-robotics.md`

`templates/macros/i18n.html` renders the variants. All existing mathematical
blocks are preserved exactly, with original references and project links.
Canonical English project anchors also reveal the corresponding Chinese heading
when Chinese is selected. If a future Chinese article body is absent, the
English original appears with an explicit Chinese notice and correct `lang`.
Missing interface keys retain the original text/attribute and warn in the console.

## Semantic Appearance System

`static/styles/preferences.css` defines tokens for page, surfaces, text,
secondary/muted text, borders, accent, inputs, buttons, focus, shadow, quote card
and selector track/thumb. Light preserves the established off-white/forest-green
identity. Dark uses near-black green-neutral surfaces, soft light text and muted
sage accents. Formula blocks, code, contact controls, footer and Lab controls use
the same tokens.

The original photos, scientific figures, hardware materials, textures, physical
display and chosen experiment viewport background are not inverted or recolored.
Only monochrome UI icons receive an icon-scoped dark filter. The gallery's dark
media panels and code rain remain intentional, including in Light mode.

## Preserving Lab State

`lab-v3/locale-ui.js` binds explicit selectors to semantic labels. It owns separate
label slots and never replaces inputs, native select values, event listeners or
physical state. Options keep plaintext content. Language notifications repaint
the console screen and refresh textual inspection values without calling reset,
activateLab, syncWorldUI, rebuildObjects or clearing a timeline.

The showcase repaints its home-screen labels without rebuilding the model. The
gallery does not mount another showcase, start another simulation or add a new
rain loop when preferences change.

## Actual Validation

Executed on the local development site with Zola 0.22.1 and the in-app browser:

| Check | Observed result |
| --- | --- |
| Unit/regression suite | 158 tests passed, including 13 preference tests and 10 existing navigation tests |
| JavaScript syntax | 20 changed JavaScript/module files checked with Node `--check` |
| Locale validation | 407 complete pairs; duplicate keys and placeholder mismatches rejected; generated catalog matches source |
| Original articles | All 13 have separate Chinese bodies; mathematical blocks match originals exactly |
| Zola check | Exit 0 |
| Zola production build | Exit 0; `public/` generated |
| Built HTML validation | 21 pages checked for known locale keys, one pair of controls, early initialization and unique live IDs; inert templates excluded from live-ID checks |
| Responsive header | EN and Chinese tested at 1920/1440/1280/1024/768/390 px; document scroll width equals viewport width |
| Keyboard | Arrow selection, selected semantics and visible focus verified in the browser |
| Reduced motion | Browser-emulated reduced motion works; thumb duration becomes 0 s while controls remain functional |
| Representative contrast pairs | Light: body 15.02:1, muted 5.01:1, navigation 8.84:1, quote 7.05:1, inactive selector 4.80:1. Dark: body 16.27:1, muted 9.15:1, navigation 10.10:1, quote 8.76:1, inactive selector 6.40:1. These are measured palette pairs, not a claim of a full accessibility audit. |
| Persistence | Chinese/Dark retained on navigation, refresh, deep links, Back and Forward |
| Cross-tab | A second tab restored Chinese/Dark, then synchronized a change to English/Light |
| Running experiment | Cloth remained running; simulation time advanced from 14.9333 s to 17.2833 s through preference changes; same canvas/host/rain nodes |
| Paused exact-state comparison | Entire physics snapshot, session, cameras, render mode, timeline and selected sample identical before/after language plus theme changes |
| Paused inspection values | 60.2667 s; 180 timeline entries; 2546 samples; `worktable.surface.sample-0` retained in Point Cloud mode |
| Gallery | Same scene UUID, progress 0.088889, camera and quaternion after changing both preferences; same host/canvas/rain |
| Contact | Active fill retained, underline hidden with width 0; links remain original GitHub/Hugging Face/Kaggle URLs |
| Chinese canonical anchor | Ordinal-query project link lands on its visible Chinese heading |
| Long-form math | Dark formula backgrounds and text verified; original notation and figures unchanged |
| Runtime logs | No warnings/errors observed during the console state-preservation sequence |

The unit suite covers all six scientific tasks; the new manual live preference
state-preservation sequence used the Cloth task, not a fabricated six-task
manual result. Source checks were updated only where literal English labels
became semantic translation bindings. Existing behavioral assertions remain.

No repository-level TypeScript compiler or ESLint configuration exists. Type
checking and linting are therefore not reported as executed. Node syntax checks,
the actual unit suite, browser checks and Zola validation were used instead.

Screenshots are under `docs/qa/portfolio-v6/`:

- `home-en-light.png`
- `home-zh-dark.png`
- `mobile-zh-dark.png`

## File Ledger

New infrastructure: `data/locales.json`, `static/js/locales/catalog.js`,
`preferences-core.js`, `preferences-init.js`, `preferences.js`, `i18n.js`,
`lab-v3/locale-ui.js`, `static/styles/preferences.css`, `templates/base.html`,
`templates/404.html`, `templates/macros/i18n.html`, Lucide sun/moon assets,
Chinese content listed above, `tests/preferences.test.mjs`,
`tools/build-locales.mjs`, `tools/validate-locale-json.py`,
`tools/check-localized-build.py`, this report and QA screenshots.

Modified templates: `index.html`, `page.html`, `contact-page.html`,
`blog-page.html`, `section.html`, `lab.html`, `lab-gallery.html`, plus
`macros/nav.html`, `macros/head.html`, `macros/blog.html`, `macros/exhibit.html`.

Modified runtime: `nav-motion.js`, `home-layout.js`, `blog-actions.js`,
`lab-gallery.js`, `lab-showcase.js`, `lab-v3/app.js`, `lab-v3/console.js`,
`lab-v3/session.js`, `lab-v3/home-screen.js`.

Modified maintenance files: `README.md`, `tests/lab-gallery.test.mjs`,
`tests/lab-showcase.test.mjs`, `tests/fixtures/lab-gallery-browser.mjs`.
The vendored Kodama theme, original English content, image sources, physics
engine and existing cursor assets were not edited.

## Limitations and Maintenance

- This is a client-side language preference on the existing URLs, not separate
  search-indexed `/zh/` URLs. The server-rendered default and search fallback are
  English. Localized titles/descriptions update for visitors in the browser.
- Chinese bodies are authored translations, not an automatic translation API.
  Future content needs matching keys and an independently maintained body.
- Embedded image text, manuscript figures, raw scientific exports, physical
  cartridge branding and object IDs intentionally remain original.
- A saved-theme refresh was observed dark from the available browser snapshot;
  initialization order is also validated structurally. A high-speed first-paint
  video was not captured because the browser adapter does not expose the required
  new-document paint probe. No universal browser/no-flash claim is implied.
- Native iOS Safari, physical touchscreen, actual MacBook pinch gestures and a
  screen reader were not available for direct hardware testing. Mobile viewport,
  keyboard, ARIA state and reduced-motion checks were executed in-browser.
- Existing CPU-rendered experiments remain research approximations. This change
  does not add trained models, GPU inference, robot safety guarantees or improve
  the pre-existing rendering performance envelope.
- No Cloudflare settings or production like counts were changed. Publication uses
  the existing deployment connection, without changing database bindings.

For future releases, regenerate/check the catalog, run the commands above,
review the diff, then use the existing GitHub-to-Cloudflare Pages workflow.
