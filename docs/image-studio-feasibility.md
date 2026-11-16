# AI Image Studio: feasibility gate

Audit date: 2026-11-16. This is a local implementation, not a production release.
The provider audit originated in V7.1; [V8.0](image-studio-v8.md) retains its
fail-closed provider policy while replacing the physics upload interface.

## Existing architecture

Zola/Tera, browser ES modules, shared EN/zh-CN preferences, a TOML exhibit registry,
Pages Functions for likes, locally vendored cannon-es and Three.js. No framework
migration, GPU service, paid-plan change, or changes to Exhibit 01 are required.

## Provider decisions

- Cloudflare Workers AI FLUX.2 Klein 4B supports editing through multipart input.
  Official pricing lists 5.37 neurons per input 512px tile and 26.05 per output
  tile. Workers Free has a 10,000-neuron daily allocation resetting at 00:00 UTC.
  This is an ACCOUNT-wide allowance, not a dedicated site allowance. No account
  plan, remaining budget, binding, license acceptance, or live inference has been
  verified in this task. Generative inference must remain disabled by default.
- Runway inpainting retires 2026-11-20; it is not a sustainable new integration.
- remove.bg lists 50 free API calls/month and a forthcoming API migration. No key
  or recurring public allocation was verified. Disabled.
- BRIA RMBG-2.0 has noncommercial license conditions requiring review. Disabled.
- Cloudflare Images `upscale=generate` is real ESRGAN, not interpolation. The
  applicable account billing/private-origin arrangement was not verified. Disabled.
- Magic Hour signup credits are not a recurring public free entitlement. Disabled.
- Cloudflare Images binding `info(stream)` is documented as free, but metadata
  inspection alone is not a full decode validation. Server acceptance therefore
  requires a separately configured trusted `IMAGE_VALIDATOR` service binding that
  fully decodes a bounded image, without storing it. No binding is auto-created.

## Implementation policy

All cloud services fail closed until explicitly configured. Local image editing
is separately labeled and never represents a successful cloud operation. Upload
validation uses a stateless signed receipt, retains no image on disk/R2, and
receives image bytes only after an explicit AI action and user consent. There is
no solver, score header or game gate in V8.
Turnstile, same-origin checks and coordinated D1 quota reservations protect cloud
operations. No paid fallback, remote image URL ingestion, or hidden credentials.

## Official sources

- https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/changelog/post/2025-11-25-flux-2-dev-workers-ai/
- https://developers.cloudflare.com/workers-ai/models/stable-diffusion-v1-5-inpainting/
- https://developers.cloudflare.com/images/optimization/binding/
- https://developers.cloudflare.com/images/optimization/features/
- https://www.remove.bg/api
- https://huggingface.co/briaai/RMBG-2.0
- https://magichour.ai/api/face-swap

These sources establish candidate availability, not successful account integration.
