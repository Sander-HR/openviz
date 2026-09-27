---

description: "Implementation tasks for ComfyUI product design workflows"
---

# Tasks: ComfyUI Product Design Workflows

**Input**: Design documents from `/specs/005-comfyui-product-design/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and `contracts/` are complete.

**Testing policy**: TDD is mandatory under the project constitution. Logic/service/store tests must be written first and fail before implementation. React component behavior tests must be written from the acceptance criteria before component implementation. No `any` or `@ts-ignore`.

## Phase 1: Setup

**Purpose**: Establish feature boundaries and typed source locations without changing existing behavior.

- [X] T001 Create the product workflow source directories described in `specs/005-comfyui-product-design/plan.md`: `src/types/`, `src/services/ai/targets/`, `src/components/product-design/`, `src/components/nodes/modify/`, and `src/components/studio/` locations as needed.
- [X] T002 [P] Add model-family, workflow-category, model-tier, execution-target, dependency, job-status, and product-design parameter types in `src/types/productWorkflow.types.ts` and `src/types/generationJob.types.ts`; export named types through the existing type barrel without introducing `any`.
- [X] T003 [P] Add the initial official-workflow dependency metadata fixtures under `src/services/ai/workflows/` without committing model weights: Qwen Image 2.1, Qwen Image Edit 2511, FLUX Kontext-dev, and Wan 2.2.
- [X] T004 [P] Add test fixtures for ComfyUI `/system_stats`, `/object_info`, `/queue`, `/prompt`, `/history`, and WebSocket progress payloads in `src/services/ai/targets/fixtures/`.

---

## Phase 2: Foundational Services and State

**Purpose**: Shared contracts and infrastructure that block all product workflow stories.

**⚠️ CRITICAL**: Complete this phase before user-story implementation.

### Registry and workflow contracts

- [X] T005 Write failing registry contract tests first in `src/services/ai/productWorkflowRegistry.test.ts` covering task-oriented IDs, versions, supported model families, typed input mappings, output mappings, dependency manifests, and rejection of unknown workflow IDs.
- [X] T006 Implement the typed product workflow registry in `src/services/ai/productWorkflowRegistry.ts`; preserve the existing legacy render registry and expose product workflows separately or through a backward-compatible named API.
- [X] T007 Write failing workflow-input validation tests first in `src/services/ai/workflowValidation.test.ts` for required prompts, reference images, masks, dimensions, aspect ratios, batch limits, and contradictory/invalid parameters.
- [X] T008 Implement `src/services/ai/workflowValidation.ts` and typed ComfyUI prompt builders with explicit injection points for prompt, negative prompt, references, mask, seed, dimensions, batch size, and output nodes.

### Hardware detection and model-tier selection

- [X] T009 Write failing ComfyUI capability normalization tests first in `src/services/ai/targets/comfyCapabilitiesService.test.ts` for CUDA, ROCm, MPS, CPU, multiple devices, missing fields, and version-varying VRAM fields.
- [X] T010 Implement `src/services/ai/targets/comfyCapabilitiesService.ts` to normalize `/system_stats` and `/object_info` responses into typed target capabilities, including devices, free/total VRAM, available node types, loader options, and check timestamps.
- [X] T011 Write failing model-tier decision tests first in `src/services/ai/modelTierSelector.test.ts` for the documented deterministic matrix (under 10 GB, 10–16 GB, 16–32 GB, 32–48 GB, 48 GB+ free VRAM), automatic, low-memory, balanced, high-quality, hosted, unknown capability, insufficient free VRAM, and multi-device profiles.
- [X] T012 Implement `src/services/ai/modelTierSelector.ts` with the deterministic free-VRAM/backend/precision matrix, explicit configured-profile precedence, workflow requirements, and dependency availability; return the selected tier plus a human-readable explanation and warnings.
- [X] T013 Write failing dependency-preflight tests first in `src/services/ai/dependencyPreflight.test.ts` for ready, missing, incompatible, degraded, and license-warning results.
- [X] T014 Implement `src/services/ai/dependencyPreflight.ts` using normalized capabilities and workflow manifests; prevent known-incompatible jobs from being submitted and surface model license links.

### Execution targets and job lifecycle

- [X] T015 Write failing execution-target contract tests first in `src/services/ai/targets/executionTarget.test.ts` for health, capabilities, preflight, submit, status, cancel, and output normalization.
- [X] T016 Implement the typed execution-target contract in `src/types/executionTarget.types.ts` and the local ComfyUI adapter in `src/services/ai/targets/localComfyTarget.ts`; normalize HTTP/WebSocket progress and polling fallback without exposing raw API shapes to components.
- [X] T017 Write failing hosted and hybrid adapter tests first in `src/services/ai/targets/hostedComfyTarget.test.ts` and `src/services/ai/targets/hybridTarget.test.ts` for auth failures, capability forwarding, local-first routing, hosted fallback, and no-target failures.
- [X] T018 Implement `src/services/ai/targets/hostedComfyTarget.ts` and `src/services/ai/targets/hybridTarget.ts`; keep provider credentials and endpoint validation behind the service/server boundary.
- [X] T018A Add the target-settings API/service contract tests first in `src/services/ai/targetSettingsService.test.ts`, then implement `src/services/ai/targetSettingsService.ts`, `src/app/api/ai/targets/route.ts`, and `src/app/api/ai/targets/[id]/route.ts` for saving redacted target metadata, testing connections, refreshing capabilities, and storing automatic/local/hosted/hybrid preferences according to `contracts/target-settings.md`.
- [X] T018B Implement the OpenAI-compatible image generation endpoint adapter (FR-016) in `src/services/ai/targets/openAIImageTarget.ts` with tests in `src/services/ai/targets/openAIImageTarget.test.ts`; conform to `docs/architecture/openai-api.json`, route between `/v1/images/generations` and `/api/inference/images/generate` based on image-condition presence, normalize Qwen Image 2.1 dimensions, and accept both `url` and `b64_json` outputs.
- [X] T018C Implement the per-endpoint FIFO generation queue (FR-017) in `src/services/ai/generationQueue.ts` with tests in `src/services/ai/generationQueue.test.ts`; clamp concurrency to 1–3 (default 2), expose it in Settings → AI & Compute via `AIComputeSettings.tsx` and `aiComputeSlice`, and apply it across all media jobs sharing an endpoint through `renderService`.
- [X] T019 Write failing generation-job reducer/store tests first in `src/store/slices/productDesignSlice.test.ts` for queued, running, partial, completed, failed, cancelled, retryable, reference, variant-set, target-setting, and terminal-state reporting transitions.
- [X] T020 Write failing persistence contract tests first in `src/services/ai/generationJobPersistence.test.ts` for preflight failure retention, terminal states, output lineage, retry linkage, and reload recovery.
- [X] T020A Implement the durable lineage persistence boundary in `src/services/ai/generationJobPersistence.ts` and the typed integration with the existing `src/app/api/jobs/[id]/route.ts`, reusing existing generation/project storage or adding a generated Drizzle migration; persist job inputs before queue submission and link retries/outputs according to `contracts/generation-persistence.md`.
- [X] T020B Implement `src/store/slices/productDesignSlice.ts` and the typed generation-job service in `src/services/ai/generationJobService.ts`; retain prompts, references, masks, target/tier decisions, dependency snapshots, progress, errors, outputs, and retry inputs.
- [ ] T021 Write failing render-service compatibility tests first in `src/services/renderService.productWorkflow.test.ts` for legacy presets and the new target adapter facade.
- [ ] T022 Migrate `src/services/renderService.ts` to delegate through the execution-target/product-generation boundary while preserving existing `generate`, `animate`, connection health, proxy behavior, and legacy request payloads; remove untyped error handling introduced by the migration.

### Settings and capability UI foundation

- [ ] T023 Write failing settings behavior tests first in `src/components/settings/AIComputeSettings.test.tsx`, `src/components/settings/ComfyConnectionSettings.test.tsx`, and `src/components/settings/HardwareSettings.test.tsx` for target selection, test connection, detected device display, automatic/manual profile selection, missing dependencies, and accessible error/status announcements.
- [X] T024 Implement Settings → AI & Compute UI in `src/components/settings/AIComputeSettings.tsx` (execution-target kind, image API model/size, endpoint concurrency 1–3) with tests in `src/components/settings/AIComputeSettings.test.tsx`; keep fetch/effects in `src/components/settings/hooks/useAIComputeSettings.ts` and services.
- [ ] T024A Implement the remaining Settings → AI & Compute panels `src/components/settings/ComfyConnectionSettings.tsx`, `src/components/settings/HardwareSettings.tsx`, `src/components/settings/ModelDependencySettings.tsx`, and `src/components/settings/ComputeDiagnostics.tsx`; compose them from `src/app/settings/page.tsx` alongside T024, use Tailwind/Radix, and keep fetch/effects in hooks/services.
- [X] T025 Write failing compute-status component tests first in `src/components/product-design/ComputeStatusChip.test.tsx`, `src/components/product-design/ModelTierBadge.test.tsx`, and `src/components/product-design/ComputePopover.test.tsx` for ready, offline, degraded, automatic-tier explanation, and hosted-fallback states.
- [X] T026 Implement `src/components/product-design/ComputeStatusChip.tsx`, `src/components/product-design/ModelTierBadge.tsx`, and `src/components/product-design/ComputePopover.tsx`; integrate the compact indicator into `src/components/workbench/workbench.tsx` without creating a Workbench-first settings panel.

**Checkpoint**: Typed workflows, capability detection, model selection, dependency preflight, target adapters, job state, and Settings → AI & Compute are functional and tested before node work begins.

---

## Phase 3: User Story 1 - Generate Product Concepts (Priority: P1) 🎯 MVP

**Goal**: A designer can generate a batch of product concepts and select a result as a reference.

**Independent Test**: Enter a concept prompt, select Qwen Image 2.1/automatic tier, generate a batch, and select an output as a ProductReference.

### Tests first

- [ ] T027 [P] [US1] Write failing concept-workflow service tests first in `src/services/ai/productConceptGeneration.test.ts` for prompt construction, batch count, aspect ratio, output extraction, and partial results.
- [ ] T028 [P] [US1] Write failing component behavior tests first in `src/components/product-design/ProductWorkflowPicker.test.tsx`, `src/components/product-design/ProductParameterForm.test.tsx`, and `src/components/product-design/ProductVariantGallery.test.tsx` for concept selection, prompt submission within the SC-001 interaction budget, loading/error states, keyboard operation, and selecting a reference.

### Implementation

- [X] T029 [US1] Implement the Qwen Image 2.1 concept workflow JSON and registry definition in `src/services/ai/workflows/qwen-image-product-concept.json` and `src/services/ai/productConceptGeneration.ts`.
- [X] T030 [US1] Implement `src/components/product-design/ProductWorkflowPicker.tsx`, `src/components/product-design/ProductParameterForm.tsx`, and `src/components/product-design/ProductVariantGallery.tsx` with labeled inputs, accessible validation, aspect-ratio controls, batch count, and status/live regions.
- [X] T031 [US1] Integrate concept generation through `src/components/product-design/hooks/useProductGeneration.ts` and `src/store/slices/productDesignSlice.ts`; associate selected outputs with ProductReference and existing project/workbench image assets. Keep the shared gallery API extensible for the later variant-set lineage work.

**Checkpoint**: Concept generation works independently without requiring Modify, Studio, or animation.

---

## Phase 4: User Story 2 - Iterate on a Reference Product (Priority: P1)

**Goal**: A Vizcom-style Modify block and Studio panel preserve a product while changing an explicit design variable.

**Independent Test**: Connect an image to Modify, request a material change, generate, and verify source lineage, preservation controls, and result output.

### Workbench creation tests first

- [ ] T032 [P] [US2] Write failing block-creation tests first in `src/components/workbench/hooks/workbenchBlockCreationLogic.test.ts` and `src/components/workbench/hooks/useWorkbenchBlockCreation.test.ts` for `Modify` creation from an image source, default data, placement, and source connection.
- [ ] T033 [P] [US2] Write failing graph/connection tests first in `src/services/workbench/connectionPolicy.test.ts` and `src/components/workbench/hooks/useWorkbenchGraph.test.ts` for image/media → modify and modify → image behavior.
- [ ] T034 [P] [US2] Write failing Modify component tests first in `src/components/nodes/ModifyNode.test.tsx`, `src/components/nodes/modify/ModifyPromptComposer.test.tsx`, and `src/components/nodes/modify/ReferenceChips.test.tsx` for prompt editing, source display, direct-verb helpers, preservation text, `@` references, and Enter/Cmd+Enter behavior.

### Workbench implementation

- [X] T035 [US2] Implement `ModifyNode` data and types in `src/types/productWorkflow.types.ts` and update `src/types/index.ts` with the new node union while preserving strict typing.
- [X] T036 [US2] Implement `src/components/nodes/ModifyNode.tsx` with the Vizcom-inspired dark rounded-card layout, inline source strip, prompt composer, mode select, aspect-ratio select, preservation slider, and purple primary action.
- [ ] T036A [US2] Extract the inlined Modify controls into `src/components/nodes/modify/ModifyPromptComposer.tsx`, `src/components/nodes/modify/ModifySourceStrip.tsx`, `src/components/nodes/modify/ModifyModeSelect.tsx`, `src/components/nodes/modify/AspectRatioSelect.tsx`, and `src/components/nodes/modify/PreservationControls.tsx` with the behavior tests named in T034, keeping `ModifyNode.tsx` under the 300-line limit.
- [X] T037 [US2] Implement `src/components/nodes/modify/ReferenceChips.tsx` and `src/components/nodes/modify/ReferencePicker.tsx` for visual `@1`/`@2` references from eligible Workbench images/media nodes.
- [X] T038 [US2] Implement `createModifyNodeFromSource` in `src/components/workbench/hooks/workbenchBlockCreationLogic.ts`, enable `modify` in `src/components/workbench/hooks/useWorkbenchBlockCreation.ts`, register `modifyNode` in `src/components/workbench/workbench.tsx`, and map it in `src/components/workbench/hooks/useWorkbenchGraph.ts`.
- [ ] T039 [US2] Update `src/components/nodes/BasicBlocksMenu.tsx`, `src/components/workbench/hooks/useWorkbenchContextMenuActions.ts`, and `src/components/nodes/ImageNode.tsx` with accessible Modify actions from insertion, context menu, and image hover affordances.

### Product edit service and Studio

- [ ] T040 [P] [US2] Write failing Qwen/FLUX edit service tests first in `src/services/ai/productEditGeneration.test.ts` for source references, masks, preservation parameters, model selection, output lineage, and retry inputs.
- [X] T041 [P] [US2] Write failing Studio Modify behavior tests first in `src/components/studio/ModifyPanel.test.tsx` and `src/components/studio/WorkflowTabs.test.tsx` for Modify defaulting when opened from an image, task tabs, status, and accessible controls.
- [X] T042 [US2] Implement Qwen Image Edit 2511 and FLUX Kontext-dev product-edit workflow JSON/templates and `src/services/ai/productEditGeneration.ts` with model-family selection, license metadata, and typed references/mask injection.
- [X] T043 [US2] Implement `src/components/studio/WorkflowTabs.tsx` and `src/components/studio/ModifyPanel.tsx`; replace the disabled Studio Refine path in `src/components/Studio.tsx`/`src/components/studio/RenderPanel.tsx` with Generate/Modify/Variants/Background/Animate workflow navigation.
- [ ] T044 [US2] Implement `src/components/nodes/hooks/useModifyNode.ts` and `src/components/studio/hooks/useStudioProductWorkflow.ts`; keep generation calls, polling, upload, and effects in hooks/services rather than presentational components.

**Checkpoint**: Workbench Modify and Studio Modify both independently complete a reference edit and display its source/output lineage.

---

## Phase 5: User Story 3 - Sketch/CAD to Render (Priority: P1)

**Goal**: A designer can upload a sketch or CAD screenshot and generate a realistic product render with adjustable structure adherence.

- [ ] T045 [P] [US3] Write failing sketch/CAD input tests first in `src/services/ai/sketchToRender.test.ts` for input validation, structure strength, dimensions, source preservation, and supported workflow selection.
- [ ] T046 [P] [US3] Write failing annotation/structure-control tests first in `src/components/nodes/modify/StructureStrengthControl.test.tsx` and `src/components/studio/ModifyAnnotationOverlay.test.tsx` for keyboard-accessible controls and source/annotation lifecycle.
- [ ] T047 [US3] Implement the sketch/CAD-to-render workflow and `StructureStrengthControl` in `src/services/ai/sketchToRender.ts` and `src/components/nodes/modify/StructureStrengthControl.tsx`.
- [ ] T048 [US3] Implement `src/components/studio/ModifyAnnotationOverlay.tsx` and `src/components/workbench/ModifyAnnotationOverlay.tsx` using the existing drawing infrastructure while persisting annotations as Modify request data rather than unrelated freehand nodes.
- [ ] T049 [US3] Add typed mask creation/upload/clear behavior in `src/components/nodes/modify/MaskControls.tsx` and connect it to product-edit preflight and workflow injection.

---

## Phase 6: User Story 4 - Variants and Marketing Imagery (Priority: P2)

**Goal**: A designer can produce material/color contact sheets, background replacements, and marketing aspect-ratio variants.

- [ ] T050 [P] [US4] Write failing variant-set tests first in `src/services/ai/productVariantGeneration.test.ts` for material, color, trim, background, batch grouping, partial completion, and reference lineage.
- [ ] T051 [P] [US4] Write failing ResultsPanel behavior tests first in `src/components/studio/ResultsPanel.productDesign.test.tsx` for lineage badges, use-as-reference, create-variants, add-to-Workbench, retry, partial results, and download actions.
- [ ] T052 [US4] Implement material/color variant and product-background workflows in `src/services/ai/productVariantGeneration.ts` and `src/services/ai/workflows/` using Qwen Edit, FLUX Fill/Redux-compatible graphs, and optional validated LoRAs.
- [ ] T053 [US4] Extend the shared `src/components/product-design/ProductVariantGallery.tsx` and `src/components/studio/ResultsPanel.tsx` with job lineage, model/tier badges, retry, partial status, and reference/output actions without untyped group data; preserve the concept-gallery behavior from T031.
- [ ] T054 [US4] Add responsive marketing output controls in `src/components/product-design/OutputFormatControls.tsx` and validate all aspect-ratio/dimension combinations before submission.

---

## Phase 7: User Story 5 - Product Animation (Priority: P2)

**Goal**: A completed product hero image can be animated with a product-aware Wan 2.2 workflow.

- [ ] T055 [P] [US5] Write failing product-animation service tests first in `src/services/ai/productAnimationGeneration.test.ts` for source image lineage, optional start/end images, duration, motion parameters, model tier, and video output extraction.
- [ ] T056 [P] [US5] Write failing Animate/Studio behavior tests first in `src/components/nodes/AnimateNode.productDesign.test.tsx` and `src/components/studio/ProductAnimationPanel.test.tsx` for source selection, progress, cancellation, and failure recovery.
- [X] T057 [US5] Implement the Wan 2.2 product-animation workflow and `src/services/ai/productAnimationGeneration.ts`; preserve compatibility with the existing animation workflow while adding model-tier/preflight metadata.
- [ ] T058 [US5] Extend `src/components/nodes/AnimateNode.tsx` through a focused product-animation hook or subcomponents under `src/components/nodes/animate/`, and add the Studio animation panel without exceeding the 300-line file limit.

---

## Phase 8: Polish, Accessibility, Compatibility, and Validation

**Purpose**: Cross-cutting quality gates and release readiness.

- [ ] T059 [P] Add an integration test in `src/services/ai/generationJobTerminalRate.test.ts` that exercises valid local, hosted, fallback, partial, cancelled, and failed fixtures and verifies every valid submission reaches a normalized terminal state with an actionable result or error; record the evidence needed for SC-002.
- [ ] T060 [P] Add an interaction-flow test in `src/components/product-design/ProductConceptFlow.test.tsx` that verifies a first concept can be submitted and selected as a reference within the SC-001 primary-interaction budget.
- [ ] T061 [P] Add accessibility behavior coverage for all new workflow forms, dialogs, menus, tabs, status regions, and result actions; verify labels, focus management, keyboard navigation, `aria-live`, and error descriptions in `src/components/product-design/` and `src/components/studio/` tests.
- [ ] T062 [P] Add responsive-layout tests/manual checks for Workbench nodes, Studio right sidebar, Settings → AI & Compute, result grids, and touch-safe controls.
- [ ] T063 [P] Add model-license and dependency diagnostics documentation links to `docs/` and the Settings diagnostics UI; do not bundle restricted model weights.
- [ ] T064 Run the full validation in `specs/005-comfyui-product-design/quickstart.md`: `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm run build`.
- [ ] T065 Run existing render, Workbench, Studio, and collaboration tests and verify legacy render presets retain their prior behavior and payloads.
- [ ] T066 Refactor any new file approaching 300 lines, remove temporary compatibility paths, and verify no `any` or `@ts-ignore` remains in touched code.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundation**: Depends on Setup and blocks all user stories.
- **US1 Concept generation**: Depends on registry, target, job, and settings foundations.
- **US2 Reference editing**: Depends on foundation and the typed ProductReference/job contracts; it is the main frontend MVP.
- **US3 Sketch/CAD render**: Depends on Modify inputs and annotation/mask contracts from US2.
- **US4 Variants/marketing**: Depends on ProductReference, job grouping, and ResultsPanel lineage from US2.
- **US5 Animation**: Depends on reference/output lineage and execution-target foundation; can proceed in parallel with US4 after foundation.
- **Phase 8 Polish**: Depends on desired user stories being complete.

### Parallel opportunities

- T002–T004 can run in parallel.
- Registry, capability, model-tier, and preflight test/implementation pairs can proceed in parallel within Phase 2 when they touch separate files.
- T027/T028, T032–T034, T040/T041, T045/T046, T050/T051, and T055/T056 are parallel test-writing opportunities.
- US1 concept UI and US2 Modify UI can be split after shared foundation, provided they do not modify the same registry/store files concurrently.
- US4 and US5 can proceed in parallel after shared job and target contracts.

### TDD rule within each task group

For every logic or component group:

1. Add the named failing test file or test case.
2. Run the focused test and confirm red.
3. Implement the smallest typed change.
4. Run the focused test to green.
5. Run related existing tests before moving to the next group.

---

## Implementation Strategy

### MVP increment

1. Complete Setup and Foundation.
2. Complete US1 concept generation and US2 reference editing.
3. Validate the Vizcom-style Workbench Modify node plus Studio Modify panel independently.
4. Demo local ComfyUI automatic-tier generation with Qwen Image/Edit.

### Incremental delivery

1. Add sketch/CAD-to-render and annotation/mask controls.
2. Add material/color/background variants and ResultsPanel lineage.
3. Add Wan product animation.
4. Add hosted/hybrid fallback and full diagnostics.
5. Run compatibility/accessibility/performance gates.

### Notes

- `[P]` means the task can run in parallel without conflicting file dependencies.
- Every task names exact file paths.
- Existing `src/services/renderService.ts`, `RenderNode`, `RenderPanel`, `ResultsPanel`, `BasicBlocksMenu`, and Workbench graph files require compatibility tests before substantial changes.
- Do not commit model weights or provider credentials.

### Reconciliation (2026-09-27)

Checkbox state was reconciled against the codebase during a `/speckit-analyze` review:

- **T018A, T019, T020** marked done — implementations and tests exist (`targetSettingsService.ts` + API routes, `productDesignSlice.test.ts`, `generationJobPersistence.test.ts`).
- **T018B/T018C added** — FR-016 (OpenAI-compatible image adapter, `openAIImageTarget.ts`) and FR-017 (per-endpoint FIFO queue, `generationQueue.ts` + Settings → AI & Compute concurrency) were implemented after this file was written and previously had no task coverage.
- **T024 split** — `AIComputeSettings.tsx` is done; the four sibling panels moved to T024A.
- **T036 split** — `ModifyNode.tsx` exists with all controls inlined; extraction into named subcomponents moved to T036A.
