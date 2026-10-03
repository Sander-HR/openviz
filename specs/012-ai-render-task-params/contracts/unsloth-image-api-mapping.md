# Contract: Unsloth / OpenAI-Compatible Image API Mapping

**Feature**: `012-ai-render-task-params` | **Date**: 2026-09-24

Maps `ResolvedRenderParameters` (task-record.schema.json → `resolved`) onto the Unsloth OpenAI-compatible image route. Source of truth for supported fields: the installed Unsloth Studio inference API schema (per PRD); capability tolerance per research R4 — fields the endpoint rejects are dropped, never fatal.

## Endpoint

`POST {endpoint}/images/generations` (endpoint includes `/v1`), `Authorization: Bearer <key>` unless keyless. Synchronous response; progress/cancel are out-of-band (`/api/inference/images/generate-progress`, `/generate/cancel`) per existing capability probing.

## Field mapping

| Resolved field | Request field | Notes |
|----------------|---------------|-------|
| (model from settings) | `model` | selected in AI compute settings; never chosen per-task at MVP |
| `prompt` | `prompt` | template-rendered incl. preservation clauses |
| `negativePrompt` | `negative_prompt` | optional; omitted when null (model-dependent support) |
| `width` × `height` | `size` (`"WxH"`) | multiples of 16 via existing `normalizeImageApiSize` |
| `strength` | `strength` | edit workflows only; 0–1, lower = closer to source |
| `steps` | `steps` | vendor default or advanced override |
| `guidance` | `guidance` (or `true_cfg_scale` per model family) | single value only — **`guidance_2` is never emitted** (FR-002) |
| `referenceResolution` | `reference_resolution` | 512 / 1024 / 2048; default 1024 |
| `seeds[0]` | `seed` | one request per output for batches (unique seeds, FR-014) |
| — | `batch_size` | used only where the provider supports it; otherwise N sequential requests under one task |
| reference image(s) | `init_image` / `reference_images` | base64 data URI(s); `workflow: 'edit'` ⇒ init-driven edit, `'reference'` ⇒ subject guidance |
| — | `workflow` | `'edit'` \| `'reference'` (image-conditioned only) |

## Never emitted (FR-002)

`guidance_2`, quantization, offload policy, memory mode, attention backend, transformer cache, `allow_oversized`, model-specific flow/schedule parameters. These are runtime/model controls and have no place in the OpenViz request path.

## Video (Animate)

Not served by this route. Animate routes to ComfyUI (`wan-2.2` family workflow) per research R1; the mapping above applies to image workflows only. The coordinator surfaces a capability error when the active protocol is `openai-image` and the task kind is `animate`.

## Failure semantics

- 401/403 → actionable API-key error (existing adapter behavior).
- Non-2xx → preserve server error text in `TaskRecord.error`; task ⇒ `failed` (retryable with same inputs + seed list).
- Timeout while pending → `interrupted` on reload; never auto-replayed (existing queue-plan semantics).
