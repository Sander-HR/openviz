# Research: AI Render Task Parameters

**Feature**: `012-ai-render-task-params` | **Date**: 2026-09-24

Phase 0 output — resolves the technical unknowns from `plan.md` Technical Context. No NEEDS CLARIFICATION items remain after this document.

---

## R1. Animate routing: which protocol serves image-to-video?

**Decision**: Route Animate to the **ComfyUI protocol** with a `wan-2.2` model-family workflow (the `ProductModelFamily` union already includes `'wan-2.2'` and `ProductWorkflowDefinition.type: 'video'` exists). The Unsloth OpenAI-compatible image API (`/v1/images/generations`) is image-only — the prior plan (`unsloth-openai-image-api-plan.md`) explicitly kept "video generation … ComfyUI-only".

**Rationale**:
- `RenderService.capabilities()` already gates operations per backend; `openAIImageRenderService.animate()` currently returns an explicit unsupported error. Keep that contract: the task coordinator checks capabilities and surfaces "video requires a ComfyUI endpoint" when the active protocol is `openai-image`.
- `src/services/ai/productAnimationGeneration.ts` already exists for the product-design flow; the render-task facade reuses it (or its underlying workflow submission) instead of duplicating video logic.
- Duration → frames/fps resolution happens in the resolver: duration choice {2s, 4s, 8s} × model-family default fps → `num_frames`; width/height from the family's documented resolution preset.

**Alternatives considered**:
- *LTX via Unsloth*: not exposed by the current OpenAI-compatible image route; would require a new protocol adapter — rejected for MVP (spec FR-020 only requires "an image-to-video model family").
- *Dual video routing with auto-fallback*: adds capability-probe complexity for a single supported path; revisit if a second video backend lands.

## R2. Extraction pipeline architecture (FR-018, FR-023)

**Decision**: Two-stage hybrid, no new infrastructure:
1. **Structured vision analysis** — call the configured OpenAI-compatible endpoint's chat/vision route with a structured-analysis prompt (per extraction kind: color / material / parts) and require JSON output matching `contracts/extraction-output.schema.json`. The vision model supplies component identification, semantic roles, region boxes (normalized 0–1 coordinates), material observations/inferences, and confidence.
2. **Deterministic color analysis** — for Color extraction, sample pixels inside each returned region box on the client (canvas) to compute representative hex values + dominant-color clustering. This makes hex output reproducible and cheap; the vision model's color read is used only as a sanity check/label.

Extraction results are persisted as `extraction_records` + `project_assets` rows (Drizzle migration) — "saved project assets" per clarification Q5. Reuse-by-explicit-selection only (no auto-apply).

**Rationale**:
- The spec forbids generative diffusion for Extract; a vision chat call is analysis, not generation.
- Deterministic pixel sampling removes the weakest part of pure-vision color extraction (hex accuracy, SC-007 ≥ 90% within perceptual tolerance) and is fully unit-testable with synthetic canvases.
- Region/hierarchy "sample by" (FR-018) maps to prompt variants: hierarchy → "top-level product components"; region → "spatial regions of the image".

**Alternatives considered**:
- *Dedicated segmentation model service* (e.g., SAM-style): best accuracy but new serving infrastructure + model management — rejected for MVP; the schema keeps `region` as normalized boxes so a segmentation backend can replace stage 1 later without contract changes.
- *Server-side pixel analysis only*: cannot identify components semantically — insufficient for Parts/Material.

## R3. Task-level queue semantics vs. existing endpoint queue (FR-022)

**Decision**: Introduce a thin **task coordinator** (`renderTaskCoordinator.ts`) on top of the existing per-endpoint `generationQueue`:
- The coordinator enforces **one active *task* per user** (a variation batch of N is one task containing N outputs, not N tasks). New submissions become `queued` with a visible position (1-based FIFO index within the user's pending list).
- Internally, when a task acquires the slot, its outputs are submitted through the existing endpoint queue (which still caps concurrent provider requests at the configured 1–3). Batch outputs use per-output unique seeds (FR-014) — for the OpenAI-compatible route this means N sequential/slot-limited requests each with its own `seed`, grouped under one task record; `batch_size` is used only where the provider supports it.
- Cancel: queued tasks are removed before submission (no provider request sent); running tasks call the Unsloth cancel endpoint when capability probing (`openApiDiscovery.ts`) reports it supported, otherwise cancellation is reported as unsupported and the task runs to completion. Terminal states include `interrupted` (per existing queue plan semantics) for reload cases.

**Rationale**: The prior progress-queue plan already built per-endpoint FIFO + concurrency 1–3 + capability probing; FR-022's "one active task per user" is a *user-task* policy that composes cleanly above it without touching provider-level throttling. Server-wide cross-user coordination remains the documented future increment (Sprint 4 of that plan) — consistent with the single-user MVP scope.

**Alternatives considered**:
- *Reuse endpoint queue only (concurrency 2)*: violates FR-022 (two tasks could run simultaneously for one user).
- *Server-side semaphore now*: out of MVP scope per spec; adds Drizzle lease/heartbeat work the spec defers.

## R4. Parameter mapping source of truth & Unsloth payload fields

**Decision**: The resolver emits a **provider-neutral `ResolvedRenderParameters`** object (see data-model.md). Two translators map it to backends:
- **OpenAI-compatible / Unsloth**: extend `openAIImageTarget.ts` submit payload with the optional fields its current API schema supports — `negative_prompt`, `strength` (edit workflow), `seed`, `batch_size`, `init_image`, `reference_images`, `workflow` (`edit` | `reference`), `reference_resolution` (512/1024/2048). Fields the endpoint rejects are dropped by the target (capability-tolerant), never fatal. `guidance_2` and all runtime controls (quantization, offload, memory mode, attention backend, caches) are **never** emitted (FR-002).
- **ComfyUI**: map to existing product-workflow parameter roles (`preservation`, `structureStrength`, `batchSize`, seed node) via the workflow registry — the `qwen-image-edit-2511` family workflows already model these inputs.

Documented vendor defaults are used where known (e.g., Qwen-Image-2512 example: 50 steps, CFG 4.0 for text-to-image; reference preprocessing default 1024). All other values are **OpenViz starting ranges** and must pass the benchmark gate (FR-021) before becoming defaults — encoded as `DEFAULTS` with a `benchmarkStatus: 'starting' | 'validated'` flag so the UI/diagnostics can tell them apart.

**Rationale**: Keeps one mapping table testable in isolation (pure function, unit-tested per task), avoids duplicating prompt/parameter logic across backends, and makes the benchmark gate auditable (task records store `benchmarkStatus` of the defaults used).

**Alternatives considered**:
- *Per-backend request builders only*: duplicates preservation-prompt logic; harder to keep FR-005..FR-011 contracts consistent.
- *Full OpenAPI-schema-driven dynamic mapping*: over-engineered for two backends; static typed mapping with capability-tolerant dropping is simpler and fully typed (no `any`).

## R5. Aspect-ratio resolution (FR-013)

**Decision**: Resolver maps the 7 presets to pixel dimensions at a 1024-class base, rounded to multiples of 16 (Unsloth requirement — existing `normalizeImageApiSize` already does this):

| Preset | Base dims (w×h) |
|--------|-----------------|
| 1:1 | 1024×1024 |
| 4:3 | 1152×864 |
| 3:4 | 864×1152 |
| 16:9 | 1280×720 |
| 9:16 | 720×1280 |
| 3:2 | 1216×816 |
| 2:3 | 816×1216 |

Edit-workflow tasks (Modify, Variates, New View) keep the **source image's** dimensions as the default and treat a user-chosen ratio as an explicit override; Instant Render always uses the preset table. Video uses the model-family resolution preset (R1).

**Rationale**: Reuses the proven multiple-of-16 normalization; keeps product subject undistorted (spec edge case) by deriving both dimensions from the ratio rather than letterboxing.

**Alternatives considered**: *Long-edge normalization only* — loses exact ratio for presets like 3:2; rejected.

## R6. Seed strategy (FR-004, FR-014)

**Decision**:
- Default: random 32-bit seed per output, generated client-side and stored in the task record.
- Variation batches: N unique seeds (random-walk from one base or independent randoms — implementation detail; the contract only requires uniqueness within the batch, verified by a resolver unit test).
- Seed lock: regenerating a specific result re-submits with that exact seed + identical inputs (SC-008); locked-seed submission is single-output only (spec edge case) — the coordinator rejects "locked seed + count > 1".
- Task records persist the full seed list so any batch output is reproducible individually.

**Rationale**: Matches the PRD's per-image seed-list guidance and makes SC-004 (0% duplicates in 20 batches) testable at the resolver level without a live backend.

## R7. Prompt template placement & @-mention handling

**Decision**: Per-task prompt/negative-prompt templates live in `renderTaskPromptRegistry.ts` (mirroring the existing `stylePromptRegistry.ts` pattern), as pure functions `(taskInput) => { prompt, negativePrompt }`. The Modify @-mention tokens (`@1 Arc Lamp`) are resolved to reference-image attachments at submission time; the template receives the resolved reference name list so the backend prompt can name the subject. Template chips ("Make…", "Change…", "Insert…") stay client-side (UI), never part of backend templates.

**Rationale**: Keeps FR-005..FR-011 testable as string contracts (snapshot/unit tests assert preservation clauses are always present, e.g., regex for "Preserve the product's" + task-specific attribute list).

## R8. Benchmark gate mechanics (FR-021, SC-010)

**Decision**: The benchmark set is a **curated asset collection** (≥ 20 diverse product images) stored as project assets with a `benchmark: true` flag; a developer-run evaluation script/hook submits each task type across the set with current defaults and records human-rated outcomes against SC-002/003/005/006/007 thresholds. Defaults carry `benchmarkStatus`; general availability is blocked (feature-flag or settings gate) until every active task type flips to `'validated'`. This is an operational process + data flag, not new runtime infrastructure — the quickstart documents the runbook.

**Rationale**: Satisfies the launch-gate requirement with minimal code (status flag + gating check in the coordinator) while keeping tuning continuous post-launch.

## Open items deliberately left to tasks.md (not research)

- Exact Drizzle table shapes for `task_records` / `extraction_records` / `project_assets` → data-model.md + migration task.
- UI wiring order per mode component → tasks (behavior tests first per Constitution II).
- ComfyUI wan-2.2 workflow JSON authoring if no suitable template exists in the registry → task with preflight check.
