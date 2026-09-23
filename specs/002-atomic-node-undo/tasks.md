# Tasks: Atomic Node Gesture History

**Input**: Design documents from `/specs/002-atomic-node-undo/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/scene-persistence.md`, `quickstart.md`

**Tests**: Required by the OpenViz constitution. Logic and hook tests follow strict red-green TDD; component behavior tests are written before implementation.

**Organization**: Tasks are grouped by user story. User Story 1 is the MVP for the reported sticky-note drag behavior.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the feature test and documentation baseline without changing application behavior.

- [X] T001 [P] Record the feature test matrix and current scene persistence contract in `specs/002-atomic-node-undo/quickstart.md`
- [X] T002 [P] Add representative Workbench node and gesture fixture builders for note, text, media, resize, arrow, and grouped-node cases in `src/store/workbenchGestureHistory.test.ts`
- [X] T003 [P] Add the planned handler test harness for React Flow position changes and drag lifecycle callbacks in `src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the typed transaction and persistence-suppression foundations required by all user stories.

**⚠️ CRITICAL**: No user story implementation begins until this phase is complete.

### Tests First

- [X] T004 [P] Write failing transaction state tests for begin, transient update, changed commit, no-op commit, cancellation, duplicate finalization, and project-switch cleanup in `src/store/workbenchGestureHistory.test.ts`
- [ ] T005 [P] Write failing autosave gating tests proving active-gesture updates do not trigger database writes and completed gestures flush the final state in `src/hooks/useAutoSaveScene.test.ts`
- [ ] T006 [P] Write failing persistence failure tests proving local final state remains available and diagnostics are emitted for network, authorization, and version-conflict failures in `src/hooks/useAutoSaveScene.test.ts`

### Implementation

- [X] T007 Define typed Workbench gesture transaction state, lifecycle status, gesture kind, and actions in `src/store/storeTypes.ts`
- [X] T008 [P] Implement pure snapshot comparison, affected-node collection, transaction lifecycle, and final-commit helpers in `src/store/workbenchGestureHistory.ts`
- [X] T009 Integrate transaction state into `src/store/slices/workbenchSlice.ts` while preserving `projectNodes` synchronization, the 100-snapshot cap, redo truncation, and Workbench/Studio history separation
- [X] T010 Add active-gesture persistence gating and completed-gesture flush coordination to `src/hooks/useAutoSaveScene.ts` and `src/services/workbench/sceneSyncBus.ts`
- [ ] T011 [P] Extract persistence scheduling and failure-diagnostic concerns into `src/hooks/useScenePersistence.ts` if required to keep `src/hooks/useAutoSaveScene.ts` within the 300-line file guidance
- [ ] T012 Verify the existing versioned main-scene contract remains sufficient and add only contract-level assertions in `src/app/api/projects/[id]/scenes/route.test.ts`; do not add a migration to `drizzle/` unless the contract tests prove it is required

**Checkpoint**: Transaction state can be tested independently; intermediate updates are live but neither history nor persistence commits occur until a completed gesture is finalized.

---

## Phase 3: User Story 1 - Move a Node as One History Action (Priority: P1) 🎯 MVP

**Goal**: Make the reported sticky-note movement one Undo/Redo action, regardless of intermediate drag points.

**Independent Test**: Drag the sticky note containing `Test` through at least three positions, release it, press Undo once, and verify the original position is restored directly; press Redo once and verify the final position is restored directly.

### Tests for User Story 1

> **TDD**: Write these behavior tests first and confirm they fail before implementation.

- [X] T013 [P] [US1] Add failing tests for repeated single-node position changes producing one history action in `src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts`
- [ ] T014 [P] [US1] Add failing tests for drag release committing the authoritative final position and requesting one immediate save in `src/components/workbench/workbench.test.tsx`
- [X] T015 [P] [US1] Add failing store regression tests proving Undo returns to the pre-drag snapshot and Redo returns to the final snapshot in `src/store/workbenchGestureStore.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Add drag-start, transient-position, and drag-stop lifecycle callbacks to `src/components/workbench/workbench.tsx` or the extracted `src/components/workbench/hooks/useWorkbenchGestureHandlers.ts`
- [X] T017 [US1] Route React Flow `position` changes through transient Workbench updates instead of history-committing updates in `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`
- [X] T018 [US1] Finalize one changed movement snapshot on normal release, suppress no-op commits, and request the existing immediate scene save in `src/components/workbench/workbench.tsx`
- [ ] T019 [US1] Guard active gesture cleanup on tool change, project switch, component unmount, and interrupted pointer lifecycle in `src/components/workbench/hooks/useWorkbenchGestureHandlers.ts`
- [X] T020 [US1] Run the User Story 1 focused tests and manually validate the `Test` sticky-note scenario using `specs/002-atomic-node-undo/quickstart.md`

**Checkpoint**: A single-node drag is independently demoable and Undo/Redo no longer traverses intermediate drag points.

---

## Phase 4: User Story 2 - Manipulate Groups and Supported Node Types Consistently (Priority: P1)

**Goal**: Make selected-group movement, resizing, and arrow-handle gestures one atomic history action each.

**Independent Test**: Move two selected nodes together, resize a supported node, and move an arrow handle through multiple points; verify each gesture undoes and redoes as one complete action.

### Tests for User Story 2

> **TDD**: Write these behavior tests first and confirm they fail before implementation.

- [ ] T021 [P] [US2] Add failing multi-selection drag tests covering all affected node IDs and one atomic history entry in `src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts`
- [ ] T022 [P] [US2] Add failing resize transaction tests for ordinary, image/video scale, and arrow-normalization paths in `src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts`
- [ ] T023 [P] [US2] Add failing arrow pointer lifecycle tests for changed, no-op, interrupted, and outside-release handle gestures in `src/components/nodes/ArrowNode.test.tsx`
- [ ] T024 [P] [US2] Add failing store tests for grouped before/after snapshots and exact resize/arrow-data Undo/Redo restoration in `src/store/slices/workbenchSlice.test.ts`

### Implementation for User Story 2

- [X] T025 [US2] Include React Flow’s complete affected-node collection when starting and finalizing selected-group movement in `src/components/workbench/hooks/useWorkbenchGestureHandlers.ts`
- [X] T026 [US2] Add resize-start and resize-end transaction boundaries while preserving dimensions, position, image/video scale, and arrow geometry updates in `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`
- [X] T027 [US2] Add typed arrow-handle start/end callbacks and cancellation cleanup around the existing pointer capture logic in `src/components/nodes/ArrowNode.tsx`
- [X] T028 [US2] Route intermediate arrow data and resize updates through the transient store path and commit only changed final geometry in `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`
- [X] T029 [US2] Verify existing node creation, deletion, duplication, reorder, connection, and freehand history tests remain independent from gesture transactions in `src/store/slices/workbenchSlice.test.ts`
- [ ] T030 [US2] Run the User Story 2 focused tests and manually validate grouped movement, resize, and arrow-handle scenarios from `specs/002-atomic-node-undo/quickstart.md`

**Checkpoint**: All supported manipulation categories are independently testable and follow one-action history semantics.

---

## Phase 5: User Story 3 - Preserve Completed State for Later Sessions (Priority: P2)

**Goal**: Persist only completed final Workbench states and preserve local final state with development diagnostics when saving fails.

**Independent Test**: Complete a gesture, reload the project, and verify the final state is restored; then simulate a failed save and verify local state remains visible with diagnostics.

### Tests for User Story 3

> **TDD**: Write these persistence and integration tests first and confirm they fail before implementation changes.

- [ ] T031 [P] [US3] Add failing contract tests for full final-scene payloads, version increments, authorization failures, and 409 version conflicts in `src/app/api/projects/[id]/scenes/route.test.ts`
- [ ] T032 [P] [US3] Add failing autosave tests proving a long active gesture cannot debounce-save an intermediate snapshot and completed release flushes the final snapshot once in `src/hooks/useAutoSaveScene.test.ts`
- [ ] T033 [P] [US3] Add failing pending-save recovery tests for reload/navigation interruption in `src/services/workbench/pendingSceneStore.test.ts` and `src/hooks/useAutoSaveScene.test.ts`
- [ ] T034 [P] [US3] Add failing Workbench reload integration coverage for final node positions and connections in `src/app/projects/[id]/page.test.tsx`

### Implementation for User Story 3

- [ ] T035 [US3] Ensure completed gesture finalization reads the latest full `nodes` and `connections` state before calling the existing save bus in `src/components/workbench/workbench.tsx`
- [ ] T036 [US3] Preserve full-scene PATCH behavior, expected-version handling, pending-save recovery, and console diagnostics in `src/hooks/useAutoSaveScene.ts` and `src/services/workbench/pendingSceneStore.ts`
- [ ] T037 [US3] Confirm the existing scene route accepts the completed final-state payload without schema changes and retains authorization/version behavior in `src/app/api/projects/[id]/scenes/route.ts`
- [ ] T038 [US3] Add development diagnostics for save failure state without introducing a production-facing error component in `src/hooks/useScenePersistence.ts` or `src/hooks/useAutoSaveScene.ts`
- [ ] T039 [US3] Run the User Story 3 focused tests and execute the persistence/reload steps in `specs/002-atomic-node-undo/quickstart.md`

**Checkpoint**: A completed gesture is durable as a full final scene state, intermediate gestures are not persisted, and failure behavior is diagnosable without losing local work.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the complete feature, preserve quality gates, and prevent regression.

- [ ] T040 [P] Review all new and modified files against the 300-line guidance and split logic/view/types concerns in `src/store/`, `src/hooks/`, and `src/components/workbench/`
- [ ] T041 [P] Add coverage for no-op clicks, cancellation, outside release, undo-during-gesture, project switching, and redo-branch invalidation in `src/store/workbenchGestureHistory.test.ts` and `src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts`
- [ ] T042 [P] Add accessibility and keyboard regression coverage proving existing Workbench Undo/Redo controls and shortcuts remain available in `src/components/workbench/WorkbenchToolbar.test.tsx` and `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.test.ts`
- [X] T043 Run the full quality gates `pnpm run lint`, `pnpm run build`, and `pnpm test -- --run` from the repository root and record results in `specs/002-atomic-node-undo/quickstart.md`
- [ ] T044 Run the complete manual validation matrix for single-node, grouped, resize, arrow-handle, no-op, cancellation, reload, and persistence-failure behavior using `specs/002-atomic-node-undo/quickstart.md`
- [X] T045 Confirm no database migration was generated unless required by the persistence contract tests, and document the final decision in `specs/002-atomic-node-undo/contracts/scene-persistence.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No implementation dependencies; tasks can begin immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 test scaffolding and blocks all user-story implementation.
- **Phase 3 (US1)**: Depends on Phase 2; delivers the MVP reported sticky-note fix.
- **Phase 4 (US2)**: Depends on Phase 2 and shares transaction foundations; can begin in parallel with US1 after foundational completion, but final integration should follow US1’s lifecycle decisions.
- **Phase 5 (US3)**: Depends on Phase 2; persistence contract tests can begin in parallel, while final integration depends on US1/US2 completion semantics.
- **Phase 6 (Polish)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: Depends on foundational transaction and persistence gating; no dependency on US2 or US3 for local history behavior.
- **US2 (P1)**: Depends on the same foundational transaction model; can be implemented in parallel with US1 after the store contract is stable.
- **US3 (P2)**: Depends on the foundational persistence gate; final end-to-end validation depends on the completed gesture lifecycle from US1 and US2.

### Parallel Opportunities

- T001–T003 can run in parallel because they touch separate documentation/test setup areas.
- T004–T006 can run in parallel as separate failing test suites.
- T008 and T011 can run in parallel after the foundational test contracts are agreed.
- T013–T015 can run in parallel before US1 implementation.
- T021–T024 can run in parallel before US2 implementation.
- T031–T034 can run in parallel before US3 implementation.
- T040–T042 can run in parallel during polish.

## Parallel Example: User Story 1

```text
Task T013: Add position-change history tests in src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts
Task T014: Add drag-stop/save tests in src/components/workbench/workbench.test.tsx
Task T015: Add store Undo/Redo regression tests in src/store/slices/workbenchSlice.test.ts

After those tests fail:
Task T016/T017: Wire the drag lifecycle and transient updates
Task T018/T019: Finalize commit/save and cancellation cleanup
```

## Parallel Example: User Story 2

```text
Task T021: Group movement tests in src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts
Task T022: Resize tests in src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts
Task T023: Arrow pointer lifecycle tests in src/components/nodes/ArrowNode.test.tsx
Task T024: Store grouped/geometry history tests in src/store/slices/workbenchSlice.test.ts
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 transaction and autosave gating foundations.
3. Complete Phase 3 User Story 1.
4. Stop and validate the sticky note `Test` scenario independently.
5. Demo the one-step Undo/Redo behavior before proceeding to resize, arrow handles, and broader persistence coverage.

### Incremental Delivery

1. Foundation: typed gesture transaction with no-op/cancel semantics and save suppression.
2. US1: single-node and group movement, delivering the primary UX fix.
3. US2: resize and arrow-handle gesture atomicity.
4. US3: final-scene persistence, reload, failure diagnostics, and version-contract coverage.
5. Polish: full quality gates, manual matrix, file-size review, and migration check.

### Notes

- Every logic-layer task names its test file and follows red-green TDD.
- No task introduces full multi-user collaboration, conflict resolution, presence, permissions, offline sync, or an action log.
- The scene contract remains full-snapshot persistence; “PATCH” updates the existing scene record rather than sending a node-level diff.
