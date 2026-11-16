# Neural Network X-Ray: Architecture and Upstream Audit

## Integration Plan

The host is Zola/Tera, native ES modules and a TOML exhibit registry, not React.
Keep that architecture. Add one independent route and one module worker. A pinned,
locally bundled TensorFlow.js CPU backend performs tensor operations and automatic
differentiation. KaTeX renders equations. No WebGPU, cloud inference, new API
endpoint or changes to the first two exhibits are required.

All eleven adapters produce one typed trace contract: operation steps, tensor
records, graph edges, numerical summaries and provenance. SVG renders the network;
Canvas renders tensor grids/2D distributions. Inspector values, color encodings
and timeline state consume the same trace, never independent animation data.

Use small, explicitly untrained analytical networks for interactive custom input.
Train dense/GAN models locally with actual gradients. For Transformer, also expose
the authentic upstream GPT-2 cached attention/logit trace as a separate lazy-loaded
fixed-prompt source. The cached source contains no Q/K/V or embedding tensors;
those values must not be fabricated. Full GPT-2 assets total roughly 630 MB across
63 ONNX chunks; do not include or automatically download them in the portfolio.
Live full GPT-2 is a separate unsupported capability unless actually implemented
and tested. Preserve honest labels for every execution mode.

## Source Inspection

### Transformer Explainer

Source: https://github.com/poloclub/transformer-explainer
Audited commit: `bfe50afba10b9b560b84143ee1107d977defa74f`.

Read package.json, routes/+page.svelte, store/index.ts, utils/data.ts,
utils/fetchChunks.js (the current file is JS, not the suggested TS path),
components/AttentionMatrix.svelte, QKV.svelte and the structure of ex0.js.

Svelte 5/SvelteKit, D3 7, GSAP, Xenova tokenizer and ONNX Runtime Web. Page mount
loads a tokenizer; desktop requests 63 chunks and merges them into an ONNX model.
ONNX input is int64 token IDs; named outputs feed the visualizations. Stores keep
model, head, block, token, sampling and presentation states separate. Attention
uses genuine raw/scaled/masked/softmax tensors. Sampling acts on final logits, not
hidden activations. Cached examples are replayed while the session loads. Our
recorded mode explicitly identifies this behavior, rather than using the
upstream function name `fakeRunWithCachedData` as a claim of live inference.

Reuse: authenticated numerical example and interaction concepts, not Svelte UI or
an iframe. MIT, copyright 2022 Polo Club of Data Science. Preserve its license and
source hash alongside the extracted trace.

### CNN Explainer

Source: https://github.com/poloclub/cnn-explainer
Read package.json, src/utils/cnn-tf.js and detail-view/KernelMathView.svelte.
The model outputs are extracted into channel-oriented nodes with real weights,
biases and feature maps; detailed views expose kernel multiplication and pooling.
Reuse the overview-to-operation interaction concept, not source code. New CNN
computes actual convolution/pooling on a small local image. MIT, copyright 2020
Polo Club of Data Science.

### GAN Lab

Source: https://github.com/poloclub/ganlab
Read package.json and demo/ganlab_models.ts, including separate variable sets,
generator/discriminator forward passes, optimizers and loss definitions.
Its TensorFlow.js implementation alternates two actual optimization objectives on
2D distributions. New implementation uses separate SGD updates and a documented
non-saturating logistic objective, without copying its legacy Polymer app.
Apache-2.0. Credit the original Georgia Tech/Google Brain/PAIR contributors.

### Diffusion Explainer

Source: https://github.com/poloclub/diffusion-explainer
Read LICENSE, js/function.js, js/denoise_l3expl.js, architecture/controller paths.
The selected prompt, seed, guidance and timestep address precomputed latent/image
JPG assets; their visual progression is not browser Stable Diffusion inference.
New implementation uses a fully specified analytical 2D Gaussian-mixture score
and deterministic DDIM-style reverse updates, not pretend image generation.
MIT, copyright 2022 Polo Club of Data Science.

### GNNExplainer

Primary research page: https://snap.stanford.edu/gnnexplainer/
The post-hoc method learns graph/feature masks that explain a trained model's
prediction. It is not ordinary message passing. New GCN explicitly visualizes
normalized forward messages; neighborhood contributions are not called universal
causal explanations or a reimplementation of GNNExplainer.

## Scope Boundaries

No upstream Svelte/Polymer application is embedded. No pretrained capability is
ascribed to an untrained model. Primary papers and all research projects will be
linked in a compact bilingual Credits panel. TensorFlow.js and KaTeX licenses
travel with their local bundles. Numerical tests, resource cleanup, responsive
screenshots and regression results are recorded in the final implementation report.
