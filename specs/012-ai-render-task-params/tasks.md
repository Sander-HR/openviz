# Tasks: AI Render Task Parameters

**Feature**: `012-ai-render-task-params` | **Branch**: `012-ai-render-task-params` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Size**: normal — full phased task list. The change spans ~25 files across types, services (resolver/registry/coordinator/facade/extraction), two store slices (`renderTaskSlice.ts` new; `aiComputeSlice.ts` extended with the benchmark gate setting), Drizzle schema + migration, and the existing generation-lab mockup components. Watch for: every mode component AND both target files (`openAIImageTarget.ts`, `openAIVideoTarget.ts`) keep their ≤300-line budget once real wiring lands, and the shared `useRenderTask` hook is the single fetch surface (Constitution III).

**In-scope decisions (carried from spec Clarifications 2026-09-24)**:
- Color Variate at MVP is palette-level (palette + colorway count); per-component mapping deferred.
- Advanced panel exposes exactly: generation quality/steps, prompt adherence, reference resolution; seed is a core control (FR-003/FR-004). Mask/LoRA/control-conditioning/upscale must not appear.
- Benchmark validation (FR-021) is a **launch gate**, not an MVP code path — it is an operational runbook (quickstart.md), so no benchmark-harness task is generated here.
- Extraction results are displayed in the node AND saved as reusable project assets; auto-apply to other products deferred (FR-023).

**Constitution II note**: every logic-layer task names its test file first and is strict red-green. Component tasks write behavior tests derived from the spec's acceptance scenarios before wiring.

---

## Phase 1: Setup

No setup tasks — the project structure, tooling, Drizzle pipeline, and generation-lab mockup already exist (mockup committed as the reference UI). Nothing to install or scaffold.

## Phase 2: Foundational

Files: `src/types/renderTask.types.ts`, `src/services/ai/renderTaskResolver.ts` (+test), `src/services/ai/renderTaskPromptRegistry.ts` (+test), `src/lib/db/schema.ts` + generated migration, `src/services/ai/renderTaskCoordinator.ts` (+test), `src/services/ai/targets/openAIImageTarget.ts`, `src/services/renderTaskService.ts`

**Wave 1 — independent (different files):**
- [ ] **T001** `[P]` Create `src/types/renderTask.types.ts`: `RenderTaskKind`, `RenderTaskRequest`, `ResolvedRenderParameters`, `TaskRecord`, `ExtractionRecord`, `ProjectAsset`, `ViewName` re-export, aspect-ratio preset union, and the task status state machine types — matching [render-task-request.schema.json](./contracts/render-task-request.schema.json) and [task-record.schema.json](./contracts/task-record.schema.json). No `any`; all shapes fully typed.
- [ ] **T002** `[P]` Write `src/services/ai/renderTaskResolver.test.ts` (red): per-kind mapping to `ResolvedRenderParameters` — workflow routing (FR-020), aspect-ratio → multiple-of-16 dims (R5 table), fidelity→strength monotonic map (FR-012), form magnitude→bounded strength band (FR-015), duration→frames/fps (R1), seed uniqueness within a batch (FR-014), locked-seed ⇒ single output, and `benchmarkStatus` provenance flag (FR-021). Then implement `src/services/ai/renderTaskResolver.ts` as a pure function to green.
- [ ] **T003** `[P]` Write `src/services/ai/renderTaskPromptRegistry.test.ts` (red): per-task prompt + negative-prompt contracts asserting preservation clauses are always present (FR-005..FR-011) — Modify change-only + preserve-all, Instant Render subject/environment/composition/camera/lighting/treatment structure, Form controlled-edit phrasing, Color palette-only recolor, New View named viewpoint + geometry constraints, Animate temporal-only + anti-deformation negatives. Then implement `src/services/ai/renderTaskPromptRegistry.ts` (mirrors the existing `stylePromptRegistry.ts` pattern) to green.
- [ ] **T004** `[P]` Extend `src/lib/db/schema.ts` with `taskRecords`, `extractionRecords`, and `projectAssets` tables per [data-model.md](./data-model.md) (ULID string ids, JSONB for request/resolved/components/payload, epoch-ms timestamps), then generate the Drizzle migration (never hand-edited SQL).

**⟶ Wait for Wave 1 to finish, then:**
- [ ] **T005** Implement `src/services/ai/renderTaskCoordinator.ts` (+ `renderTaskCoordinator.test.ts`, red first): one active task per user with visible 1-based FIFO queue position, queued-task cancel (no provider request sent), running-task cancel via capability probe, and the state machine incl. `partial`/`interrupted` terminal states (FR-022). Composes on top of the existing `createGenerationQueue`; a variation batch of N is one task with N outputs. Enforce the FR-021 launch gate (R8): add `benchmarkGateEnabled` to `aiComputeSlice.computeSettings` (default `true`) and, when enabled, reject submissions whose resolved defaults carry `benchmarkStatus: 'starting'` for that task kind with an error naming the unvalidated task kind.
- [ ] **T006** First split `src/services/ai/targets/openAIImageTarget.ts` (currently 326 lines, over the Constitution V ≤300 budget): extract payload building and progress polling into a new module so both files stay ≤300 lines. Then extend it to pass through `negative_prompt`, `strength` (edit workflow), per-output `seed(s)`, and `reference_resolution` (512/1024/2048); capability-tolerant dropping of fields the endpoint rejects. Assert in its existing test file that runtime internals (`guidance_2`, quantization, offload, memory mode, attention backend, caches) are **never** emitted (FR-002). Poll `/api/inference/images/generate-progress` for step-level progress when capability probing reports it (SC-009 parity with the ComfyUI/video routes); otherwise fall back to 0→100 on completion.

**⟶ Wait for T005 and T006 to finish, then:**
- [ ] **T006b** Create `src/services/ai/targets/openAIVideoTarget.ts` with the video submit path (R1), reusing T006's shared payload/probe helpers so both target files stay ≤300 lines: native `POST /api/inference/video/generate` when capability probing (`openApiDiscovery.ts`) reports the route present (payload per `VideoGenerateRequest`: `first_frame`/`last_frame`, `num_frames`, `fps`, `seed`; `guidance_2` never emitted — FR-002), else OpenAI-compatible `POST /v1/videos` with `VideoJob` status/progress polling and `/api/inference/video/generate/cancel` for running-task cancel. Capability-tolerant field dropping per R4; assert in the existing test file that runtime internals are never emitted.
- [ ] **T007** Implement `src/services/renderTaskService.ts` facade: validate request → resolve (T002) → route by capability class (`edit`/`reference`/`video`/`extract`, FR-020) through the active protocol adapter → persist a `TaskRecord` (FR-019) via T004's tables. Video routes to the active protocol's video route — native `/api/inference/video/generate` when capability probing reports it, else OpenAI-compatible `POST /v1/videos` (`VideoJob` polling), with the ComfyUI wan-2.2 workflow as fallback backend; surface a capability error only when no active protocol supports video (R1).

**Checkpoint**: Foundational complete — resolver, prompt registry, coordinator, persistence, target extension, and facade are all unit-tested and green. No user-story work begins until this phase is done.

## Phase 3: User Story 1 — Modify (P1)

Files: `src/components/generation-lab/useRenderTask.ts`, `src/components/generation-lab/GenerationAdvancedPanel.tsx`, `src/components/generation-lab/GenerationModifyMode.tsx` (+ behavior test)

### Tests
- [ ] **T008** Write Modify behavior tests (red, from spec US1 acceptance scenarios): single-attribute change request preserves all unspecified attributes; lowering reference-fidelity keeps results closer to source (monotonic); @-mention targets the named reference only; empty prompt blocks generation with a clear inline indication.

### Implementation
**Wave 1 — independent (different files):**
- [ ] **T009** `[P]` Create `src/components/generation-lab/useRenderTask.ts` backed by a new `src/store/slices/renderTaskSlice.ts` zustand slice holding active-task/queue state (plan structure, Constitution III): the single hook owning all fetch/effects for render tasks — submit (builds `RenderTaskRequest` from playground state, calls the facade), cancel, and subscribe to task lifecycle/queue-position state. Exposes status, queue position, progress, error+retry, and per-output seed-lock regeneration (SC-008).
- [ ] **T010** `[P]` Create `src/components/generation-lab/GenerationAdvancedPanel.tsx`: exactly the FR-003 MVP set — generation quality/steps, prompt adherence, reference resolution — clearly separated from the default task UI with safe defaults. No mask/LoRA/control-conditioning/upscale controls.

**⟶ Wait for Wave 1 to finish, then:**
- [ ] **T011** Wire `src/components/generation-lab/GenerationModifyMode.tsx` to real generation via `useRenderTask`: build the modify request (prompt + reference + fidelity), show queue position / progress / error-with-retry, and expose seed-lock on a produced result.

**Checkpoint**: Modify is independently functional and testable — type a change → generate → accept result without ever touching a model-specific parameter (SC-001).

## Phase 4: User Story 2 — Instant Render (P1)

Files: `src/components/generation-lab/GenerationInstantRenderMode.tsx` (+ behavior test)

### Tests
- [ ] **T012** Write Instant Render behavior tests (red, from spec US2): scene prompt + aspect-ratio preset produces output at the selected ratio with product recognizable; no connected reference shows a "connect an image" state and disables Generate.

### Implementation
- [ ] **T013** Wire `src/components/generation-lab/GenerationInstantRenderMode.tsx` to real generation via `useRenderTask`: build the instant-render request (scene prompt + required reference + one of the 7 aspect-ratio presets, FR-013) and display the result at the chosen ratio.

**Checkpoint**: Instant Render is independently functional — reference + scene words → marketing-ready image at the chosen ratio.

## Phase 5: User Story 3 — Form & Color Variate (P2)

Files: `src/components/generation-lab/GenerationVariationMode.tsx` (+ behavior test)

### Tests
- [ ] **T014** Write variation behavior tests (red, from spec US3): form batch of N produces exactly N distinct outputs preserving product identity; color batch uses only palette colors with geometry unchanged; locked seed + count > 1 is rejected; increasing form-magnitude increases geometric deviation within the bounded band.

### Implementation
- [ ] **T015** Wire `src/components/generation-lab/GenerationVariationMode.tsx` (both sub-modes) to real generation via `useRenderTask`: form (preset + magnitude + axis labels + count) and color (palette swatches + colorway count) build the correct request; display batch results with per-output seed visibility.

**Checkpoint**: Batch exploration is independently functional — N distinct, same-concept outputs per batch.

## Phase 6: User Story 4 — New View (P2)

Files: `src/components/generation-lab/GenerationNewViewMode.tsx` (+ behavior test)

### Tests
- [ ] **T016** Write New View behavior tests (red, from spec US4): selecting a target view generates output from that viewpoint with preserved geometry; generation is blocked until a view is selected; at least one connected reference is required.

### Implementation
- [ ] **T017** Wire `src/components/generation-lab/GenerationNewViewMode.tsx` to real generation via `useRenderTask`: build the new-view request (selected `ViewName` + reference) and display the result; Generate stays disabled until a view is chosen (FR-016).

**Checkpoint**: New View is independently functional — pick a viewpoint → same product from that angle.

## Phase 7: User Story 5 — Animate (P3)

Files: `src/components/generation-lab/GenerationAnimateMode.tsx` (+ behavior test)

### Tests
- [ ] **T018** Write Animate behavior tests (red, from spec US5): start frame + motion description + duration produces video of the requested length with stable product; optional end frame transitions toward it; with an OpenAI-compatible protocol active the request routes to its video route (`/v1/videos` or native `/api/inference/video/generate`) — no capability error, no mis-routing (R1); a capability error appears only when no active protocol supports video.

### Implementation
- [ ] **T019** Wire `src/components/generation-lab/GenerationAnimateMode.tsx` to real generation via `useRenderTask`: build the animate request (required start frame, optional end frame, 2s/4s/8s duration) routed through the facade to the active protocol's video route (T006b); display video result with progress, or a capability error only when no active protocol supports video.

**Checkpoint**: Animate is independently functional — stills → short stable product video on any active protocol that serves video (R1).

## Phase 8: User Story 6 — Extract (P3)

Files: `src/services/ai/extractionService.ts` (+test), `src/services/ai/extractionPrompts.ts`, `src/services/ai/colorAnalysis.ts` (+test), `src/components/generation-lab/GenerationExtractMode.tsx` (+ behavior test)

### Tests
- [ ] **T020** Write extraction logic tests (red, from spec US6 + FR-018): color extraction returns components with representative color + hex + confidence and excludes background; material extraction separates observations from inferences; parts extraction returns name + role + region; no attached image disables the action.
- [ ] **T021** Write Extract behavior tests (red, from spec US6 acceptance scenarios): each of Color / Material / Parts yields structured records (not pixels); results are displayed in the node and saved as a reusable project asset.

### Implementation
**Wave 1 — independent (different files):**
- [ ] **T022** `[P]` Implement `src/services/ai/extractionService.ts` (+ `extractionPrompts.ts`): structured vision-chat call per extraction kind requiring JSON matching [extraction-output.schema.json](./contracts/extraction-output.schema.json), with hierarchy vs region prompt variants (R2).
- [ ] **T023** `[P]` Implement `src/services/ai/colorAnalysis.ts`: deterministic client-side pixel sampling inside each returned region box → representative hex + dominant-color clustering (reproducible, unit-testable with synthetic canvases; SC-007).

**⟶ Wait for Wave 1 to finish, then:**
- [ ] **T024** Wire `src/components/generation-lab/GenerationExtractMode.tsx` to real extraction via `useRenderTask`: build the extract request (kind + sampleBy), display structured results in the node, and save each completed extraction as a project asset (palette / material notes / part list) referenceable by other tasks (FR-023).

**Checkpoint**: Extract is independently functional — image → structured records saved as reusable assets, no pixels generated.

## Phase 9: Polish

Files: `src/components/generation-lab/GenerationNodeMockup.test.tsx`

- [ ] **T025** Update `src/components/generation-lab/GenerationNodeMockup.test.tsx` to reflect real wiring (the mockup's status-message stub assertions are replaced by the per-mode behavior tests added in each story phase).
- [ ] **T026** Validate against Success Criteria — run the full gates: `pnpm test && pnpm run lint && pnpm exec tsc --noEmit`; confirm the coverage floor has not regressed and SC-001/SC-008/SC-009 are verifiable from the task records. (Benchmark launch gate FR-021/SC-010 is an operational runbook in [quickstart.md](./quickstart.md), not a code task.)

---

## Dependencies & Execution Order

- **Phase 1 Setup**: none (existing structure).
- **Phase 2 Foundational** (blocks all stories): Wave 1 = T001, T002, T003, T004 (independent, different files) → then T005, T006, T006b (depend on types + queue/target; T006 and T006b both extend `openAIImageTarget.ts` — run sequentially) → then T007 (depends on resolver, coordinator, target incl. video path, persistence).
- **Phase 3 (US1 Modify)**: T008 (tests) → Wave 1 = T009, T010 (independent) → T011. Depends on Phase 2.
- **Phase 4 (US2 Instant Render)**: T012 → T013. Depends on Phase 2 + the `useRenderTask` hook from Phase 3.
- **Phase 5 (US3 Variate)**: T014 → T015. Depends on Phase 2 + Phase 3 hook.
- **Phase 6 (US4 New View)**: T016 → T017. Depends on Phase 2 + Phase 3 hook.
- **Phase 7 (US5 Animate)**: T018 → T019. Depends on Phase 2 (facade video routing via T006b/T007) + Phase 3 hook.
- **Phase 8 (US6 Extract)**: T020, T021 (tests) → Wave 1 = T022, T023 (independent) → T024. Depends on Phase 2 types + Phase 3 hook.
- **Phase 9 Polish**: T025 → T026. Depends on all story phases.

Phases 4–8 are independent of one another once Phase 3's shared `useRenderTask` hook exists, so they may be built in any order or in parallel (each owns disjoint files).
