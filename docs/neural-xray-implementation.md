# Exhibit 03: Neural Network X-Ray

Implementation and verification, 2026-11-16. The owner authorized production
publication after local acceptance. Route: `/lab/neural-network-xray/`.
The release uses the existing GitHub `main` to Cloudflare Pages integration;
the deployment check on the release commit records its live outcome.

## Implemented and Numerically Verified

The existing Zola/Tera site now registers Exhibit 03 through `data/exhibits.toml`.
The first two exhibits, cursor, navigation transitions and cloud image service
are unchanged. Gallery previews use an actual screenshot of the running exhibit.

The native-ES-module workspace includes eleven architecture choices, Explore and
Deep Dive modes, operation playback, bilingual explanations, KaTeX formulas,
parameter/iteration counts, numerical trace export and a collapsible inspector.
The inspector exposes tensor shapes, finite-value statistics, channels, flattened
element indices and paginated values. Heatmap colors are calculated from the
same numeric records as the labels, with an explicit per-tensor scale.

MLP and DNN train on all four XOR examples using actual TensorFlow.js CPU
autodiff/SGD. Neurons, connection signs, predictions, MSE and per-layer weight
gradient norms derive from the current variables. Width, depth, activation,
initialization, weight scale, bias and learning rate are adjustable.

GAN uses trainable 2-12-2 and 2-12-1 networks, logistic discriminator loss and
non-saturating generator loss. Each iteration updates D only, then G only.
Real/generated scatter points and the decision field share world coordinates.
Loss tensors evaluate the current fixed display probes; history records the
training minibatches. This is a 2D distribution experiment, not image generation.

Structural comparisons use independent seeded models with default settings.
Dense and recurrent pairs share the edited input. Comparisons expose structures,
state representations and parameter counts, not misleading cross-task scores.
Both sides can send actual tensors to the inspector. No device benchmark claim
is made from the one-run CPU timings.

## Implemented with Recorded Real Traces

Transformer has an explicit, lazily fetched GPT-2 Small recording from the audited
Transformer Explainer commit. It preserves the fixed prompt's six BPE IDs,
12 blocks x 12 heads of attention matrices and 50,257 logits. The source URL,
commit, SHA-256, non-finite encoding and MIT license accompany the data.

The recording contains no embeddings, Q/K/V projections or MLP activations.
Those tensors are therefore absent from recorded mode. Temperature, top-k and
top-p resample its logits; resampling is explicitly not a fresh inference.

## Implemented as Analytical Demonstration

These modules perform real browser CPU arithmetic, but use seeded, untrained
weights or an analytical score, not a pretrained task model:

| Architecture | Actual computation and inspection |
| --- | --- |
| Transformer | Two-block/two-head causal decoder; token/position embeddings, pre-LN, head-specific Q/K/V weight slices, dot products, masking, softmax, multi-head concatenation, residuals, GELU MLP, final LN/unembedding and sampling. Custom text uses an explicitly small word vocabulary, not GPT-2 BPE. |
| CNN | Local 12x12 grayscale input, actual 3x3/5x5 cross-correlation, stride/padding, bias, activation, 2x2 max/average pooling and two-channel features. A movable output-pixel selector highlights the corresponding input window and lists its exact products/sum. |
| U-Net | 16x16 convolutional encoder, pooling, bottleneck, nearest-neighbor upsampling, channel concatenation, skip ablation and sigmoid pixel activations. Skips are replaced by zeros when disabled. |
| RNN | Shared-weight recurrence, local hidden-state Jacobians and autodiff of the final hidden-state sum with respect to the input sequence. |
| LSTM | Independently parameterized input/forget/output/candidate gates, explicit previous cell state and an honestly labeled post-update retention intervention. |
| GRU | Independently parameterized reset/update/candidate computations, with the reset-before-matrix-multiplication convention stated explicitly. |
| GNN | Editable undirected graph/features, one self-loop per node, symmetric degree normalization, selected-target message contributions, aggregation, nonlinear updates and input Jacobian sensitivity. |
| Diffusion | Closed-form Gaussian-mixture forward noising, numerically stable exact mixture score and deterministic DDIM reverse updates. Reverse begins at the forward-noised mixture sample, not a falsely claimed pure-noise generator. |

## Blocked or Not Yet Implemented

- Full live pretrained GPT-2 inference and its roughly 630 MB upstream ONNX
  download are not integrated. There is no fake loading control or hidden
  heavyweight download on page entry.
- CNN has no trained classifier. Its spatial means are not labeled probabilities.
- U-Net has no trained semantic/medical segmentation capability.
- Diffusion has no trained neural denoiser, text conditioning or image synthesis.
- The GNN module is not the learned-mask GNNExplainer method, a trained graph
  classifier or causal attribution.
- MLP/DNN and GAN start untrained. Local training does not assert convergence,
  generalization or pretrained-model quality.
- Production status is established by the release commit's Cloudflare Pages
  check and public-route verification, not by the local screenshots alone.

## Runtime and Resource Boundaries

One module worker owns the selected model; a separate worker exists only while a
comparison is open. Architecture changes terminate the previous worker. Model
settings and requests use latest-result guards; worker requests are serialized.
All retained trainable variables are disposed by the adapter. Numerical tests
confirm zero remaining tensors after repeated switching and disposal.

No GPU backend, cloud API or paid inference is required. The locally bundled CPU
runtime is about 464 KB on disk; the optional recording is about 1.4 MB. KaTeX,
fonts and licenses are local. Image inputs reuse the existing validated local
decoder (10 MB, 16 MP, bounded dimensions); they are never submitted to a server.
Superseded decoded bitmaps are closed. Text and sequence inputs are bounded.

One independent code-rain instance is throttled to 10 Hz, respects reduced motion
and pauses when hidden. Playback/training timers and workers are released on
non-cached page exit. Language changes only relabel/repaint existing state.

## Verification

- `node --test tests/*.test.mjs tests/*.test.cjs`: 216 tests pass, zero failures.
  Twenty new numerical/integration groups cover all eleven architectures, all
  144 recorded attention heads, finite-difference gradients, convolution/pooling,
  recurrent gates, message sums, alternating GAN updates, DDIM and skip shapes.
- `node tools/build-locales.mjs --check`: 424 shared bilingual messages valid.
  Exhibit-local controls, labels, explanations and formula bindings have their
  own complete bilingual checks.
- `npm audit --omit=dev` in `tools/neural-xray`: zero reported vulnerabilities.
- Production `zola build`: successful. All code/data/font/image assets are static
  Cloudflare Pages-compatible files; no new Functions binding is needed.
- In-app browser testing used 1440x1000, 390x844 and 320x740 viewports. There was
  no page-level horizontal overflow or captured console warning/error.
- Every architecture rendered. Rapid switching settled on the final requested
  U-Net, with zero retained tensors. GAN training advanced from 20 to 385 actual
  iterations before being stopped. Language switching preserved MLP iteration
  20 and the inspected element, and preserved a CNN window selection of 65.
- Custom sequence edits changed operation counts (four values -> five steps;
  three values -> four steps). Compared recurrent inputs updated together.
- Local image selection produced real downsampled grayscale values. CNN stride
  2 produced a 6x6 convolution map; its blur coefficients were 1/9. The kernel
  texture was verified as a real 3x3 layout, not a flattened strip.
- Invalid input recovered after correction. Comparison tensors selected the
  comparison model in the inspector and restored the primary model on close.
- Canvas pixel reads confirmed nonblank plots; gallery loading confirmed the
  actual 1440x1100 preview and successful entry through Exhibit 03.

Evidence is in `docs/qa/neural-xray/`; upstream source inspection and license
decisions are in `docs/neural-xray-audit.md`.

## Rebuilding Vendor Assets

From the repository root:

```sh
npm ci --prefix tools/neural-xray
node tools/neural-xray/build.mjs
node tools/build-locales.mjs
node --test tests/*.test.mjs tests/*.test.cjs
zola build
```

Vendor bundles are checked-in deployment inputs; a normal Zola build does not
need npm or network access. To regenerate the recording, supply a clean clone at
the exact audited commit to `node tools/neural-xray/extract-trace.mjs <clone>`.
The extractor rejects a different HEAD or a modified source recording.
