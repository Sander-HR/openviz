# Contract: Unsloth / OpenAI-Compatible Image API Mapping

**Feature**: `012-ai-render-task-params` | **Date**: 2026-09-24

Maps `ResolvedRenderParameters` (task-record.schema.json → `resolved`) onto the Unsloth OpenAI-compatible image route. Source of truth for supported fields: the installed Unsloth Studio inference API schema (per PRD); capability tolerance per research R4 — fields the endpoint rejects are dropped, never fatal. Full endpoint catalog (image + video routes, request/response schemas): [docs/architecture/openai-api.json](../../../docs/architecture/openai-api.json).

## Endpoint

`POST {endpoint}/images/generations` (endpoint includes `/v1`), `Authorization: Bearer <key>` unless keyless. Synchronous response; progress/cancel are out-of-band (`/api/inference/images/generate-progress`, `/generate/cancel`) per existing capability probing.

Per [openai-api.json](../../../docs/architecture/openai-api.json) the protocol exposes two image routes:
- **OpenAI-compatible** `POST /v1/images/generations` — accepts only `prompt`, `model`, `n`, `size`, `response_format`, `user`, `stream`; returns URLs or base64 PNGs. No steps/guidance knob (defaults per loaded model).
- **Native** `POST /api/inference/images/generate` (`DiffusionGenerateRequest`) — the richer surface: `negative_prompt`, `width`/`height`, `steps`, `guidance`, `seed`, `batch_size`, `init_image`, `mask_image`, `strength`, `reference_images`, `workflow`, `reference_resolution`, `loras`, `controlnet`.

The existing adapter ([openAIImageTarget.ts](../../../src/services/ai/targets/openAIImageTarget.ts)) probes capability and uses the native route when available, falling back to the OpenAI-compatible one.

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

Note: the OpenAI-compatible route (`/v1/images/generations`) accepts only `prompt`, `model`, `n`, `size`, `response_format`, `user`, `stream` per [openai-api.json](../../../docs/architecture/openai-api.json); the remaining rows apply on the native `/api/inference/images/generate` route. Per R4, fields the active route rejects are dropped, never fatal.

## Never emitted (FR-002)

`guidance_2`, quantization, offload policy, memory mode, attention backend, transformer cache, `allow_oversized`, model-specific flow/schedule parameters. These are runtime/model controls and have no place in the OpenViz request path.

## Video (Animate)

Served by this protocol — the OpenAI-compatible endpoint also provides video generation, not just images. Per [openai-api.json](../../../docs/architecture/openai-api.json):
- **OpenAI-compatible** `POST /v1/videos` — returns a `VideoJob` (`id`, `model`, `status` ∈ queued/in_progress/completed/failed, `progress`, `size`, `seconds`, `expires_at`); companion routes: `GET /v1/videos`, `GET /v1/videos/{video_id}`, `DELETE /v1/videos/{video_id}`, `GET /v1/videos/{video_id}/content`.
- **Native** `POST /api/inference/video/generate` (`VideoGenerateRequest`) — the richer surface: `prompt`, `negative_prompt`, `model`, `width`/`height`, `num_frames` (must lie on the family's temporal lattice), `fps`, `steps`, `guidance`, `guidance_2` (dual-expert MoE families, e.g. Wan2.2-A14B), `seed`, `first_frame` / `last_frame` (image-to-video, base64/data-URL), `reference_images` (≤9), `reference_videos` (≤3), `reference_audios` (≤3), `flow_shift`. Progress/cancel are out-of-band (`/api/inference/video/generate-progress`, `/generate/cancel`).

Animate therefore routes to the active protocol's video route (native when available, OpenAI-compatible otherwise) instead of ComfyUI-only per research R1; the image mapping above still applies to image workflows only.

## Failure semantics

- 401/403 → actionable API-key error (existing adapter behavior).
- Non-2xx → preserve server error text in `TaskRecord.error`; task ⇒ `failed` (retryable with same inputs + seed list).
- Timeout while pending → `interrupted` on reload; never auto-replayed (existing queue-plan semantics).
