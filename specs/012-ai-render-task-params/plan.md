# Implementation Plan: AI Render Task Parameters

**Branch**: `012-ai-render-task-params` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-ai-render-task-params/spec.md`

## Summary

Make the seven generation-lab render tasks (Modify, Instant Render, Form Variate, Color Variate, New View, Animate, Extract — Expression deferred) real against the backend: a **task parameter resolver** translates task-level user controls into model-specific parameters (prompt templates with preservation constraints, edit strength, seeds, reference resolution, batch handling), routed by capability class through the existing dual-protocol `RenderService` (Unsloth OpenAI-compatible image API + ComfyUI). A **task coordinator** enforces one active task per user with visible FIFO queue position and cancel semantics (FR-022), reusing the existing per-endpoint generation queue. Every task produces a machine-readable **task record** (resolved parameters, prompt, seed) for reproducibility (FR-019). **Extract** is a new non-generative vision/segmentation pipeline producing structured records saved as project assets (FR-018/FR-023). A benchmark gate on ≥ 20 product images per task type is a launch requirement (FR-021, SC-010).

## Technical Context

**Language/Version**: TypeScript (strict), React 19, Next.js app runtime (repo is mid-migration from Vite — no second bundler entry point)

**Primary Dependencies**: zustand (client state), react-query (server state), framer-motion + Radix UI (UI), Konva/react-konva + React Flow (canvas/workbench); `fetch` against Unsloth OpenAI-compatible image API (`/v1/images/generations`, progress/cancel endpoints) and ComfyUI; no new runtime dependencies planned

**Storage**: Postgres via Drizzle ORM — task/job records, extraction records, project assets; client compute settings in persisted zustand slice (existing `aiComputeSlice`)

**Testing**: Vitest + React Testing Library; logic layers strict red-green (test file first); components behavior-tested from spec acceptance criteria; coverage floor may never regress

**Target Platform**: Web (modern browsers) + Next.js server runtime for API routes/repository access

**Project Type**: web-application (existing monolith: `src/app`, `src/components`, `src/services`, `src/store`)

**Performance Goals**: < 2 s from submission to visible progress feedback (SC-009); batches of up to 8 images per task; video outputs 2–8 s duration; queue position + phase visible while queued/running

**Constraints**: No `any` / no `@ts-ignore`; files ≤ 300 lines (split Logic/View/Types); Tailwind only, no inline styles; named exports; absolute imports; services own all fetch/useEffect logic (hooks wrap them); API keys never logged/persisted server-side

**Scale/Scope**: Single-user workbench MVP — one active generation task per user (FR-022), one connected reference per task, 7 aspect-ratio presets, batch counts {2,4,8}; multi-reference conditioning and server-wide cross-user queueing are out of scope (documented migration path exists in `docs/architecture/unsloth-progress-queue-plan.md` Sprint 4)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Type Safety (no `any`, no `@ts-ignore`) | PASS | All new request/response/prompt/parameter shapes typed in `src/types/renderTask.types.ts` + colocated types; task records fully typed |
| II | Test-First, Layered | PASS | Resolver, coordinator, prompt registry, extraction pipeline = logic layer → test files written first (named per task); generation-lab components get behavior tests derived from spec acceptance scenarios before wiring |
| III | State Architecture | PASS | Active-task/queue state in a zustand slice (`renderTaskSlice`); job records via existing react-query-backed repository services; no fetch in components |
| IV | Styling & UI Primitives | PASS | Mockup already Tailwind + Framer Motion; advanced panel uses Radix select/dialog patterns; no inline styles introduced |
| V | Module Boundaries & File Limits | PASS | New logic split: `renderTaskResolver.ts` (mapping), `renderTaskPromptRegistry.ts` (templates), `renderTaskCoordinator.ts` (queue/cancel), `extractionService.ts` (+ `extractionPrompts.ts`, `colorAnalysis.ts`); each < 300 lines; folder mapping respected (types → `src/types/`, logic → `src/services/ai/`, state → `src/store/slices/`, UI → `src/components/generation-lab/`) |
| — | Tech stack constraints | PASS | No new bundler entry point; AI integration only through `src/services/`; Postgres changes via Drizzle migrations only |
| — | Workflow & quality gates | PASS | Feature on numbered branch `012-ai-render-task-params`; tasks will name test files first for logic layers; CI gates (lint, tsc, vitest, coverage floor) unchanged |

**Gate result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/012-ai-render-task-params/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── render-task-request.schema.json
│   ├── task-record.schema.json
│   ├── unsloth-image-api-mapping.md
│   └── extraction-output.schema.json
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── renderTask.types.ts            # RenderTaskKind, task-level requests, resolved params, task records
├── services/
│   ├── ai/
│   │   ├── renderTaskResolver.ts      # task controls → model-specific parameters (pure, tested)
│   │   ├── renderTaskResolver.test.ts
│   │   ├── renderTaskPromptRegistry.ts# per-task prompt + negative-prompt templates (FR-005..011)
│   │   ├── renderTaskPromptRegistry.test.ts
│   │   ├── renderTaskCoordinator.ts   # one active task/user, FIFO position, cancel (FR-022)
│   │   ├── renderTaskCoordinator.test.ts
│   │   ├── extractionService.ts       # vision + color analysis → structured records (FR-018)
│   │   ├── extractionPrompts.ts       # structured-analysis prompts (color/material/parts)
│   │   ├── colorAnalysis.ts           # deterministic pixel/sampling analysis for hex values
│   │   ├── extractionService.test.ts / colorAnalysis.test.ts
│   │   └── targets/openAIImageTarget.ts  # extended: negative_prompt, strength, seed(s), reference_resolution passthrough
│   └── renderTaskService.ts           # facade: resolve → route (edit/reference/video/extract) → task record
├── store/
│   └── slices/renderTaskSlice.ts      # active task, queue position, cancel actions
└── components/
    └── generation-lab/                # existing mockup → real wiring (state hooks + services)
        ├── useRenderTask.ts           # hook: submit/cancel/subscribe (all fetch effects here)
        ├── GenerationAdvancedPanel.tsx# FR-003 MVP set: quality/steps, adherence, reference resolution
        └── ... (existing mode components gain real onGenerate wiring)

drizzle migrations: task_records + extraction_records + project_assets tables
```

**Structure Decision**: Single existing web application — no new projects. The feature plugs into the established layering: pure resolver/registry logic in `src/services/ai/` (reusing the `stylePromptRegistry` pattern), a thin facade `renderTaskService.ts`, one zustand slice for task lifecycle state, and the generation-lab components converted from status-message stubs to real wiring via a single `useRenderTask` hook. Extraction is the only net-new pipeline; it reuses the configured OpenAI-compatible endpoint (vision chat) plus client-side deterministic color analysis rather than adding new infrastructure.

## Complexity Tracking

Not required — Constitution Check passed with no violations.
