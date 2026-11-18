# TensorCat Lab V10

Implemented and verified locally on 2026-11-18. This release uses the existing
GitHub `main` to Cloudflare Pages integration; its release commit records the
production deployment result.

## Cartridge Regression

The production browser reproduced the single visible Cloth card. All six meshes
had `visible: true`, their normal shelf coordinates, and 20,013 nontransparent
pixels per slot in the 885 × 204 canvas. Five unselected buttons over that canvas
had computed background `rgb(17, 27, 26)`; only the selected button was
transparent. The global palette selector inherited the specificity of
`input[type=number]` inside `:is()`, beating the unselected transparent style.
The selected button's additional state selector won that conflict, which is
why one card was visible. There was no missing geometry or asset.

The palette now excludes shelf hit targets. The strip retains its desktop
590:136 proportions while fitting the available width on phones, so no slot is
hidden behind horizontal scrolling. Card poses, camera controls, the transfer
renderer, state machine, physical buttons, and experiment code are unchanged.

## Cover Art

| Exhibit | Original art | Deployed-format asset | Size |
| --- | --- | --- | --- |
| 02 | Generative Canvas | `static/img/lab/ai-image-studio-cover.webp` | 1664 × 936, 116,014 bytes |
| 03 | Inside Intelligence | `static/img/lab/neural-network-xray-cover.webp` | 1664 × 936, 119,008 bytes |

Both were generated separately with the built-in ImageGen tool. The 1672 × 941
outputs were inspected, cropped by a few edge pixels to exact 16:9, and encoded
using `cwebp -q 86 -m 6 -metadata none -crop 4 2 1664 936`. The images are
conceptual, not claims of restored-photo quality or actual model activations.

Generation briefs used:

- **Generative Canvas:** One white moth orchid on a continuous optical plate,
  damaged monochrome scan on the left and matching restored white petals and
  jade foliage on the right. A selective mask and lifted optical fragments
  communicate editing, with graphite lighting and no text or UI.
- **Inside Intelligence:** Four distinct glass neural layers with adjacent-layer
  fiber connections, restrained green activation paths, a triangular causal
  attention matrix, stacked convolution features and a small graph on a dark
  optical bench. No typography, dashboard, or artificial measurements.

The registry, preview template, and bilingual alt text point to the new images.
The existing gallery layout, motion timing, decoded-image preload, and live
hardware showcase remain in place. A failed artwork load opens a branded dark
placeholder at the same dimensions; the exhibit entry stays usable and retry
requests a fresh URL instead of reusing the failed browser cache entry.

## Files

- Cartridge fix: `static/styles/preferences.css`, `static/styles/lab-v3.css`.
- Cover wiring and recovery: `data/exhibits.toml`, `data/locales.json`, generated
  `static/js/locales/catalog.js`, `templates/macros/exhibit.html`,
  `static/styles/lab-exhibition.css`, `static/js/lab-gallery.js`.
- New art: the two WebP assets above. Existing application screenshots are
  retained as documentation and are not cover fallbacks.
- Tests: `tests/lab-gallery.test.mjs` and `tests/tc06-interactions.test.mjs`.

## Verification

- Local browser at 1440, 390, and 320 CSS pixels. All six cards rendered and
  fit without horizontal scrolling. Desktop insertion, keyboard A launch,
  pause, and touchscreen ejection were exercised for all six; the other slots
  stayed visible and each ejected card returned. Front/back drags retained the
  shelf positions and the rear logo.
- Gallery switched 01 → 02 → 03 → 01; both 16:9 covers retained their entire
  composition. Browser clicks opened both application routes, and X-Ray
  completed its initial CPU computation. Theme and language switching preserved
  the dark Lab, current preview, and one Matrix rain canvas.
- Browser request blocking produced an identified placeholder; unblocking and
  pressing Retry restored the WebP. Automated tests cover aborted preparation,
  fallback recovery, and asset dimensions.
- 219 Node tests passed; Zola build and localization validation passed
  (426 messages, 23 pages). This Zola/native JavaScript project has no
  application TypeScript build or separate type-check script.
- Desktop/mobile screenshots and test output: [QA artifacts](qa/lab-v10/).
