# Quickstart: AI Render Task Parameters

**Feature**: `012-ai-render-task-params` | **Date**: 2026-09-24

Runnable validation scenarios proving the feature works end-to-end. Implementation details live in `tasks.md`; this is a validation/run guide only. Contracts: [render-task-request](./contracts/render-task-request.schema.json) · [task-record](./contracts/task-record.schema.json) · [Unsloth mapping](./contracts/unsloth-image-api-mapping.md) · [extraction output](./contracts/extraction-output.schema.json). Data model: [data-model.md](./data-model.md).

## Prerequisites

- `pnpm install`
- A reachable image endpoint configured in AI Compute Settings — either an Unsloth-compatible server (`http://host:port/v1`, Qwen image edit + text-to-image models loaded) or a ComfyUI instance for video tasks.
- For mock/offline runs: `NEXT_PUBLIC_USE_MOCK_RENDER=true` (existing mock protocol).
- Postgres running with Drizzle migrations applied (task_records, extraction_records, project_assets).

## Setup

```bash
pnpm run dev                # Next.js dev server
pnpm exec drizzle-kit migrate   # apply this feature's migrations
```

Configure endpoint + model in Settings → AI Compute. Verify "AI ready" indicator.

## Scenario 1 — Modify (P1, spec US1)

1. Open the generation node with one connected product image (use a benchmark-set image).
2. Type `Make the base matte black`, submit.
3. **Expected**: task record created (`kind: modify`, `resolved.workflow: 'edit'`, preservation clauses in prompt, 1 seed); result changes only the base; task record inspectable with exact parameters + seed (FR-019).
4. Lock the seed on the result and regenerate → visually identical output (SC-008).
5. Submit a second Modify while the first runs → it shows `Queued · position 1` and starts FIFO (FR-022); cancelling it before start sends no provider request.

## Scenario 2 — Instant Render (P1, spec US2)

1. Same connected reference; write a scene prompt; pick `3:2`.
2. **Expected**: `resolved.workflow: 'reference'`, dimensions 1216×816 (multiple of 16); output matches the ratio (SC-005) with product recognizable.
3. Disconnect the reference → mode shows "connect an image" state, Generate disabled.

## Scenario 3 — Variation batches (P2, spec US3)

1. Form: preset `organic`, magnitude mid, count 4 → exactly 4 distinct outputs, each a same-concept product; task record stores 4 unique seeds (FR-014).
2. Color: palette of 3 hex swatches, count 2 → 2 colorways using only palette colors; geometry unchanged.
3. Locked seed + count 4 → rejected with a clear message (R6 rule).

## Scenario 4 — New View (P2, spec US4)

1. Select `Front view` via the cube or dropdown → generate.
2. **Expected**: named viewpoint in prompt, geometry/component preservation constraints present; Generate disabled until a view is selected (FR-016).

## Scenario 5 — Animate (P3, spec US5)

1. With a ComfyUI endpoint active: start frame connected, duration `4s`, turntable motion → video of correct length, stable product (SC-006).
2. With the OpenAI-image protocol active: capability error "video requires a ComfyUI endpoint" — no silent mis-routing.

## Scenario 6 — Extract (P3, spec US6)

1. Attach a product image; run Color / Material / Parts once each.
2. **Expected**: structured records per [extraction-output.schema.json](./contracts/extraction-output.schema.json) — hex values from deterministic sampling, observations separated from inferences, background excluded; each result saved as a project asset (FR-023). No image pixels are generated.

## Scenario 7 — Advanced panel & hidden internals (FR-002/FR-003)

1. Open the advanced panel: exactly quality/steps, prompt adherence, reference resolution (+ seed core control).
2. **Expected**: no mask/LoRA/control/upscale controls; no `guidance_2`, quantization, offload, memory, attention, or cache fields anywhere in UI or request payloads (inspect a task record's `resolved`).

## Automated validation

```bash
pnpm exec vitest src/services/ai/renderTaskResolver.test.ts        # per-task parameter mapping + seed uniqueness
pnpm exec vitest src/services/ai/renderTaskPromptRegistry.test.ts  # preservation-clause contracts (FR-005..011)
pnpm exec vitest src/services/ai/renderTaskCoordinator.test.ts     # FIFO, one-active-task, cancel semantics
pnpm exec vitest src/services/ai/extractionService.test.ts         # structured output + hex sampling
pnpm test && pnpm run lint && pnpm exec tsc --noEmit               # full gates (coverage floor must not regress)
```

## Benchmark gate (launch requirement — FR-021, SC-010)

1. Load the ≥ 20-image benchmark set (assets flagged `benchmark: true`).
2. Run each active task type across the set with current defaults; record human ratings against SC-002/003/005/006/007 thresholds.
3. Flip each task type's default set to `benchmarkStatus: 'validated'` in the resolver DEFAULTS once thresholds pass.
4. **GA check**: coordinator blocks general availability while any active task type is still `'starting'`.

## Rollback

- Disable the render-task facade per protocol (feature flag in settings) — existing ComfyUI/product-design flows are untouched.
- Revert to status-message mockup behavior by pointing the generation-lab `onGenerate` handlers back at the stub; no schema rollback needed until migrations ship (migrations are additive tables only).
