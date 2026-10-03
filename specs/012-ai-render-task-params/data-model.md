# Data Model: AI Render Task Parameters

**Feature**: `012-ai-render-task-params` | **Date**: 2026-09-24

Entities from the spec (Key Entities) mapped to concrete shapes. TypeScript types live in `src/types/renderTask.types.ts`; persistence via Drizzle migrations (never hand-edited SQL). All IDs are strings (ULID); timestamps are epoch milliseconds.

---

## 1. RenderTaskKind (enum)

```text
'modify' | 'instant-render' | 'form-variate' | 'color-variate' | 'new-view' | 'animate' | 'extract'
```

`expression` is **not** a kind at MVP (deferred; UI shows disabled "Soon"). Adding it later = enum extension + registry entry, no schema change.

## 2. RenderTaskRequest (task-level, user-facing)

One object per submission; the resolver's input. Mirrors the generation-lab UI state (`GenerationPlaygroundState`) but backend-neutral.

| Field | Type | Applies to | Validation |
|-------|------|-----------|------------|
| `kind` | `RenderTaskKind` | all | required |
| `prompt` | string (≤ 2000) | modify, instant-render, form-variate, animate | required & non-empty except color-variate/extract/new-view (view supplies the prompt core) |
| `referenceImageId` | string | all except pure text-to-image | required for modify, variates, new-view, animate; optional-but-recommended for instant-render (spec: required at MVP per US2) |
| `aspectRatio` | `'1:1'\|'4:3'\|'3:4'\|'16:9'\|'9:16'\|'3:2'\|'2:3'` | instant-render (required); modify/variates/new-view (optional override) | must be a preset (FR-013) |
| `referenceFidelity` | number 0–1 | modify, variates, new-view, animate | monotonic mapping to edit strength; default per task (resolver) |
| `variationCount` | 2 \| 4 \| 8 | form-variate, color-variate | required |
| `formDirection` | `{ preset: 'balanced'\|'soft-sculpt'\|'geometric'\|'organic'; magnitude: number 0–1; axisLabels: {top,bottom,left,right} }` | form-variate | required; magnitude maps to bounded strength band (FR-015) |
| `palette` | `{ swatches: string[] (hex); name?: string }` | color-variate | ≥ 1 swatch; hex format validated |
| `targetView` | `ViewName` | new-view | required (FR-016) |
| `duration` | `'2s'\|'4s'\|'8s'` | animate | required; end frame optional |
| `endFrameImageId` | string? | animate | optional |
| `extractKind` | `'color'\|'material'\|'parts'` | extract | required |
| `sampleBy` | `'hierarchy'\|'region'` | extract | required |
| `seed` | number? | all (advanced/core) | 32-bit; locked-seed ⇒ count must be 1 (coordinator rule) |
| `advanced` | `{ steps?: number; guidance?: number; referenceResolution?: 512\|1024\|2048 }` | image tasks | FR-003 MVP set only; each optional with safe default |

## 3. ResolvedRenderParameters (resolver output, provider-neutral)

| Field | Type | Notes |
|-------|------|-------|
| `workflow` | `'edit' \| 'reference' \| 'video' \| 'extract'` | capability-class routing (FR-020) |
| `prompt` | string | template-rendered, preservation clauses included (FR-005..011) |
| `negativePrompt` | string? | per-task constraints; may be omitted where model-dependent |
| `width` / `height` | number | multiples of 16 (R5) |
| `strength` | number 0–1? | edit workflows only |
| `steps` | number | vendor default or advanced override |
| `guidance` | number | vendor default or advanced override; **never** includes dual-stage video guidance values (FR-002) |
| `referenceResolution` | 512 \| 1024 \| 2048 | default 1024 |
| `seeds` | number[] | length = output count; unique within batch (FR-014) |
| `firstFrame` / `lastFrame` | image ref? | video only |
| `numFrames` / `fps` | number | video only (duration resolver, R1) |
| `benchmarkStatus` | `'starting' \| 'validated'` | provenance of the defaults used (FR-021) |

## 4. TaskRecord (persisted — `task_records` table)

The FR-019 machine-readable record; also the SC-008 reproducibility source.

| Field | Type | Notes |
|-------|------|-------|
| `id` | ULID | task id |
| `projectId` | string? | owning project |
| `kind` | `RenderTaskKind` | |
| `request` | JSONB (full `RenderTaskRequest`) | user-level inputs, verbatim |
| `resolved` | JSONB (`ResolvedRenderParameters`) | exact backend parameters used |
| `protocol` | `'openai-image' \| 'comfyui'` | active protocol at submission |
| `modelFamily` | string? | e.g. `qwen-image-edit-2511`, `wan-2.2` (informational; not user-facing) |
| `seeds` | number[] | one per output |
| `status` | `queued \| active \| completed \| partial \| failed \| cancelled \| interrupted` | state machine below |
| `queuePositionAtSubmit` | number? | FR-022 visibility |
| `error` | string? | terminal failure reason (retryable flag implied by kind) |
| `outputIds` | string[] | → GenerationResult rows |
| `createdAt` / `updatedAt` | epoch ms | |

**State transitions**:

```text
queued ──slot acquired──▶ active ──all outputs ok──▶ completed
   │                        │──some outputs ok────▶ partial   (kept + labeled, spec edge case)
   │──cancelled (pre-run)──▶ cancelled              │──all fail / timeout──▶ failed
   └──reload w/ valid input──▶ queued (restored)    └──cancel mid-run (supported)──▶ partial|cancelled
active on reload w/o live promise ──▶ interrupted (retryable, never auto-replayed)
```

## 5. GenerationResult (persisted — existing asset/job model extension)

Reuses the existing generation-output/asset rows; adds:

| Field | Type | Notes |
|-------|------|-------|
| `taskId` | → TaskRecord.id | grouping; a batch shares one task |
| `seed` | number | per-output seed (SC-008 lock target) |
| `url` / `assetId` | string | imported asset (existing import path) |

## 6. ExtractionRecord (persisted — `extraction_records`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | ULID | |
| `taskId` | → TaskRecord.id (`kind='extract'`) | |
| `sourceImageId` | string | attached image |
| `kind` | `'color'\|'material'\|'parts'` | |
| `sampleBy` | `'hierarchy'\|'region'` | |
| `components` | JSONB — array of `ExtractionComponent` (schema in contracts) | structured, background excluded (FR-018) |
| `confidence` | number 0–1 | overall record confidence |
| `createdAt` | epoch ms | |

## 7. ProjectAsset (persisted — `project_assets`)

Clarification Q5: extraction results are saved as reusable project assets.

| Field | Type | Notes |
|-------|------|-------|
| `id` | ULID | |
| `projectId` | string | |
| `kind` | `'palette'\|'material-notes'\|'part-list'` | one per completed extraction |
| `extractionRecordId` | → ExtractionRecord.id | provenance |
| `payload` | JSONB (palette swatches+hex / material notes / part list) | referenceable by other tasks |
| `createdAt` | epoch ms | |

Reuse is **explicit selection only** (no auto-apply — Scope).

## 8. ViewDefinition

Existing `ViewName` union in `src/types` (used by `ViewCubePicker`); no new entity — the new-view resolver consumes it as `{TARGET_VIEW}` phrasing.

## Relationships (summary)

```text
Project 1─n TaskRecord 1─n GenerationResult n─1 Asset
TaskRecord(kind=extract) 1─1 ExtractionRecord 1─1 ProjectAsset
RenderTaskRequest ─(resolver, pure)→ ResolvedRenderParameters ─(stored in)→ TaskRecord.resolved
```

## Validation rules (enforced at coordinator/resolver boundary)

1. Empty prompt where required ⇒ reject with field-level error (FR edge case).
2. Missing reference where required ⇒ reject (US1–US5 scenarios).
3. `variationCount` ∉ {2,4,8} ⇒ reject.
4. Locked seed + count > 1 ⇒ reject (R6).
5. Non-preset aspect ratio ⇒ reject (FR-013).
6. Duplicate seeds within a batch ⇒ resolver bug — unit-tested, never persisted.
7. Extraction with no attached image ⇒ reject (US6 scenario 4).
