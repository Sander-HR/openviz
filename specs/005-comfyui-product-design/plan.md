# Implementation Plan: ComfyUI Product Design Workflows

**Branch**: `005-comfyui-product-design` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-comfyui-product-design/spec.md` and live Hugging Face/Civitai model research in [research.md](./research.md).

## Summary

Replace the current duplicate SD3.5 product/style presets with a task-oriented product-design workflow system. Add Qwen Image 2.1 concept generation, Qwen Image Edit 2511 reference editing, FLUX Kontext-dev alternative editing, Wan 2.2 product animation, optional Civitai adapters, dependency preflight, generation lineage, local/hosted/hybrid execution targets, and automatic hardware-aware model tiers. Preserve existing render behavior while migrating the registry and UI behind typed service and hook boundaries.

## Technical Context

**Language/Version**: TypeScript strict, React 19, Next.js runtime, existing Node/pnpm toolchain.

**Primary Dependencies**: Existing Zustand, TanStack Query, Konva/react-Konva, Tailwind, Radix, Framer Motion, ComfyUI API services; use existing upload/project persistence. No new model-runtime dependency is required in the browser. Hosted providers are adapter implementations.

**Storage**: Existing project/image/job persistence mechanisms for durable workflow lineage; add a typed persistence service/API and generated Drizzle migration if existing tables cannot store workflow version, target/tier, references, masks, dependency snapshot, retry linkage, and output lineage. Model weights remain external to the repository.

**Testing**: Vitest, React Testing Library, existing render-service tests, accessibility assertions, typed adapter mocks, and fixture ComfyUI API responses.

**Target Platform**: Responsive desktop/tablet web app with local ComfyUI, hosted ComfyUI-compatible endpoint, and hybrid fallback.

**Project Type**: Existing Next.js web application with service, Zustand, hook, component, and workflow JSON layers.

**Performance Goals**: Keep workflow picker/parameter UI responsive while jobs run; render job status updates without reload; submit within one UI interaction after validation; throttle progress/polling according to existing service patterns; support batches without rendering-blocking state updates.

**Constraints**: No `any`, no `@ts-ignore`, named exports, Tailwind only, Radix for primitives, effects/fetch in hooks/services, files ≤300 lines, existing workflows must not regress, model licenses must be surfaced, and incompatible model configurations must never be silently submitted.

**Scale/Scope**: Six task families, four primary model families, three execution modes, four hardware tiers, batches up to the UI-configured limit, image and short-video outputs, and existing project-level image history.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Type Safety | PASS | New workflow inputs, target capabilities, dependencies, jobs, and model tiers have explicit types; JSON templates use typed registry boundaries. |
| II. Test-First, Layered | PASS | Registry, selection, preflight, and adapters require failing unit tests first; workflow components require behavior tests before implementation; existing coverage must not regress. |
| III. State Architecture | PASS | Zustand owns local workflow/job UI state; TanStack Query owns persisted server state; hooks/services own effects, polling, upload, and fetch. |
| IV. Styling & UI Primitives | PASS | Tailwind-only layout; Radix for menus/dialogs/selects; Framer Motion for transitions; accessible status/live regions and keyboard controls. |
| V. Module Boundaries & Limits | PASS | Services under `src/services/ai/`, state under `src/store/`, types under `src/types/`, views under `src/components/`; split files before 300 lines; named/absolute imports. |
| ComfyUI constraint | PASS | Components never call ComfyUI directly; execution is normalized through service adapters and hooks. |
| Quality gates | PASS | Lint, `tsc --noEmit`, full Vitest, and build are required before merge. |

## Phase 0: Research Findings

Research is complete in [research.md](./research.md). All technical-context unknowns were resolved:

- Qwen Image 2.1 is the concept default.
- Qwen Image Edit 2511 is the reference-edit default.
- FLUX Kontext-dev is the alternative instruction-edit engine, with license metadata.
- Wan 2.2 is the product animation engine.
- Civitai assets are optional validated LoRAs/workflows, not hard dependencies.
- Local, hosted, and hybrid targets share one typed adapter contract.
- Capability-based preflight selects model tiers and rejects known incompatibilities using a documented deterministic tier matrix.
- Workflow/job lineage is durably persisted for reproducibility and retry, using existing tables or a generated migration.

## Phase 1: Design

Design artifacts:

- [data-model.md](./data-model.md): workflow, target, hardware, job, reference, variants, and dependency entities.
- [contracts/workflow-registry.md](./contracts/workflow-registry.md): task workflow registry boundary.
- [contracts/execution-target.md](./contracts/execution-target.md): local/hosted/hybrid adapter boundary.
- [contracts/generation-job.md](./contracts/generation-job.md): normalized lifecycle and lineage contract.
- [contracts/dependency-preflight.md](./contracts/dependency-preflight.md): missing/incompatible dependency behavior.
- [contracts/target-settings.md](./contracts/target-settings.md): Settings → AI & Compute target/auth/capability boundary.
- [contracts/generation-persistence.md](./contracts/generation-persistence.md): durable job lineage and retry contract.
- [quickstart.md](./quickstart.md): runnable validation scenarios and evidence.

## Project Structure

### Documentation

```text
specs/005-comfyui-product-design/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── workflow-registry.md
    ├── execution-target.md
    ├── generation-job.md
    ├── dependency-preflight.md
    ├── target-settings.md
    └── generation-persistence.md
```

### Source Code

```text
src/
├── types/
│   ├── productWorkflow.types.ts
│   ├── executionTarget.types.ts
│   └── generationJob.types.ts
├── services/ai/
│   ├── workflowRegistry.ts
│   ├── workflowValidation.ts
│   ├── dependencyPreflight.ts
│   ├── modelTierSelector.ts
│   ├── generationJobService.ts
│   ├── generationQueue.ts
│   └── targets/
│       ├── localComfyTarget.ts
│       ├── hostedComfyTarget.ts
│       ├── hybridTarget.ts
│       └── openAIImageTarget.ts
├── store/
│   └── slices/productDesignSlice.ts
├── components/
│   ├── product-design/
│   │   ├── ProductWorkflowPanel.tsx
│   │   ├── WorkflowPicker.tsx
│   │   ├── ProductParameterForm.tsx
│   │   ├── ReferenceInput.tsx
│   │   ├── DependencyStatus.tsx
│   │   ├── GenerationJobStatus.tsx
│   │   ├── ProductVariantGallery.tsx
│   │   └── hooks/useProductGeneration.ts
│   ├── settings/
│   │   ├── AIComputeSettings.tsx
│   │   ├── ComfyConnectionSettings.tsx
│   │   ├── HardwareSettings.tsx
│   │   ├── ModelDependencySettings.tsx
│   │   └── hooks/useAIComputeSettings.ts
│   └── studio/
│       ├── WorkflowTabs.tsx
│       └── ModifyPanel.tsx
├── app/
│   ├── settings/
│   │   └── page.tsx                # Route/composition only
│   └── api/ai/targets/
│       ├── route.ts
│       └── [id]/route.ts
└── services/ai/workflows/
    ├── qwen-image-product-concept.json
    ├── qwen-image-edit-product.json
    ├── flux-kontext-product-edit.json
    ├── qwen-material-study.json
    ├── product-background.json
    └── wan-product-animation.json

tests/ or colocated *.test.ts(x)
├── services/ai/workflowRegistry.test.ts
├── services/ai/modelTierSelector.test.ts
├── services/ai/dependencyPreflight.test.ts
├── services/ai/targets/*.test.ts
└── components/product-design/*.test.tsx
```

**Structure Decision**: Keep the existing single Next.js application. Add typed product-design service/target modules and pure UI components; retain ComfyUI JSON under the existing workflow directory. No second bundler or model server is introduced. Hosted execution is an adapter, not a separate application.

## Confirmed UX Direction

- Visual direction: very close to Vizcom's Modify experience, including dark rounded panels, compact connected nodes, purple primary actions, image thumbnails, right-side Studio workflows, and result grids, with OpenViz branding retained.
- Compute configuration: Settings → AI & Compute is the primary location for local/hosted/hybrid connections, hardware profiles, model dependencies, and diagnostics. The Workbench shows only a small status indicator; it does not host the configuration panel.
- Modify surfaces: implement both a Workbench `ModifyNode` created from an image plus handle and a Studio `ModifyPanel` in the right sidebar.
- First-release controls: direct prompt/preservation instructions, `@` image references, red annotations, masks, aspect ratio, and task/mode selection.

## OpenAI-Compatible Image Endpoint (FR-016 / FR-017)

Added by the 2026-09-25 clarification; implemented in commits `34274a5` and `a04d04e`.

- **Adapter**: `src/services/ai/targets/openAIImageTarget.ts` implements the `ExecutionTargetAdapter` contract against an Unsloth UI Backend–style OpenAI-compatible endpoint (reference spec: `docs/architecture/openai-api.json`). It routes text-only requests to `/v1/images/generations` and image-conditioned requests (init/reference/mask) to `/api/inference/images/generate`, and normalizes both `url` and `b64_json` outputs (`b64_json` becomes a data URL). Qwen Image 2.1 dimensions are normalized to 32-divisibility, a superset of the spec's multiple-of-16 rule.
- **Queue**: `src/services/ai/generationQueue.ts` provides per-endpoint FIFO queues with concurrency clamped to 1–3 (default 2). The setting is exposed in Settings → AI & Compute (`AIComputeSettings.tsx` → `aiComputeSlice.setEndpointConcurrency`) and applied by `renderService` via `setConcurrency` before enqueueing, so it covers all media jobs sharing an endpoint.
- **Model**: the adapter is synchronous (submit caches outputs; cancel is a no-op), which matches the provider's request/response behavior. This is documented here rather than in a separate contract file.

## Implementation Sequencing Notes

1. Establish typed workflow contracts and registry tests before changing existing workflow behavior.
2. Add the model-tier selector and dependency preflight with fixture targets.
3. Implement local target normalization and migrate the existing render service behind it.
4. Add hosted and hybrid target adapters with explicit capability/auth errors.
5. Add new workflow JSON templates from official ComfyUI examples, then validate injection mappings.
6. Add Zustand slice and hook for job lifecycle, references, variants, and target settings.
7. Add Settings → AI & Compute for connections, hardware, model dependencies, diagnostics, and automatic/manual tier preferences.
8. Add the Vizcom-style Workbench Modify node, image-plus-handle creation path, `@` references, annotations, masks, and keyboard generation.
9. Add the Studio workflow sidebar with Generate/Modify/Variants/Background/Animate tabs and extend the existing ResultsPanel with lineage and retry actions.
10. Build accessible workflow picker, parameter form, dependency status, target settings, status, and gallery components with behavior tests first.
11. Add lineage persistence and retry/partial-batch handling.
12. Run existing and new validation scenarios from quickstart; do not remove legacy presets until compatibility tests are green.

## Post-Phase-1 Constitution Re-check

**PASS**. The design introduces no new constitution violation. It preserves the existing app boundary, keeps ComfyUI in services, uses typed adapters instead of untyped provider calls, and makes optional external model assets explicit. Any schema change must use a generated Drizzle migration during implementation.

## Complexity Tracking

No constitution violations require justification. The three execution modes are adapter variants within the existing application, not additional projects or bundler entry points.
