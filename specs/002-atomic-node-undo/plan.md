# Implementation Plan: Atomic Node Gesture History

**Branch**: `002-atomic-node-undo` | **Date**: 2026-04-21 | **Spec**: `specs/002-atomic-node-undo/spec.md`

## Summary

Add a transaction boundary around high-frequency Workbench node manipulation updates. Position, selected-group movement, resize, and arrow-handle changes will remain live during the gesture, but only a changed completed gesture will append one Workbench history snapshot and trigger the existing scene persistence path. Interrupted gestures restore their starting snapshot without history or persistence. The existing versioned main-scene JSON endpoint remains the durable database boundary; no new schema or collaboration protocol is introduced.

## Technical Context

**Language/Version**: TypeScript, React 19, Next.js 16 runtime

**Primary Dependencies**: Zustand 4, `@xyflow/react` 12.10, TanStack Query 5, Vitest 4, React Testing Library

**Storage**: PostgreSQL through the existing Drizzle `scenes` table; Workbench scene payload stored as JSONB with version and updater metadata

**Testing**: Vitest, React Testing Library, existing scene-sync tests, manual browser validation, `pnpm run lint`, `pnpm run build`

**Target Platform**: Browser-based OpenViz Workbench served by the Next.js application

**Project Type**: React/Next.js web application with a React Flow node editor and server-persisted project scenes

**Performance Goals**: Intermediate pointer updates remain responsive and create no history snapshots or database writes; one completed gesture causes at most one completed-gesture persistence request after any in-flight save is handled

**Constraints**: No `any` or `@ts-ignore`; preserve existing Workbench/Studio history separation; preserve scene version conflict handling; no full multi-user collaboration; no new production error UI; do not add a database migration unless implementation discovery proves the existing scene contract cannot satisfy the clarified requirements

**Scale/Scope**: Existing Workbench node types and selected groups; one active gesture per Workbench project; existing 100-snapshot Workbench history cap; no action log or collaboration event stream

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence / plan response |
|---|---|---|
| Type safety | PASS | All new transaction state, callbacks, persistence results, and test fixtures will use explicit TypeScript types; no `any` or `@ts-ignore`. |
| Test-first layered development | PASS | Store/history helpers and hooks receive failing Vitest tests before implementation; node UI behavior receives React Testing Library tests before component wiring changes. |
| State architecture | PASS | Gesture state remains in Zustand Workbench state; persistence remains in a feature hook/service boundary; no fetch calls are added to components. |
| UI and rendering constraints | PASS | No styling changes are required; React Flow remains the Workbench graph layer and existing Tailwind/Radix conventions remain unchanged. |
| Module boundaries and file limits | PASS WITH MITIGATION | Existing `workbenchSlice.ts` and `useAutoSaveScene.ts` exceed the 300-line guidance. New pure transaction/history helpers will be split into focused modules rather than increasing those files without review. |
| Database constraint | PASS | The existing Postgres/Drizzle scene JSONB record and versioned route are reused; no hand-edited migration is planned. |
| Quality gates | PASS | Completion requires lint, TypeScript/build, focused tests, full Vitest, and coverage-floor review. |

No gate violations require a Complexity Tracking entry.

**Scope alignment note**: The supplied request references Yjs and React Flow's Collaborative example, but this loaded feature specification is explicitly the atomic gesture-history slice and excludes live multi-user collaboration (FR-016). Yjs/provider integration is documented in `research.md` as a follow-up feature, not introduced into this implementation plan.

## Project Structure

### Documentation (this feature)

```text
specs/002-atomic-node-undo/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── scene-persistence.md
├── quickstart.md
└── tasks.md                 # created by /speckit.tasks, not this command
```

### Source Code (repository root)

```text
src/
├── store/
│   ├── storeTypes.ts
│   ├── workbenchGestureHistory.ts       # new pure transaction/snapshot helpers
│   └── slices/
│       ├── workbenchSlice.ts             # integrates gesture actions and state
│       └── workbenchSlice.test.ts        # store regression coverage
├── components/
│   ├── nodes/
│   │   ├── ArrowNode.tsx                 # handle gesture lifecycle callbacks
│   │   └── ArrowNode.test.tsx
│   └── workbench/
│       ├── workbench.tsx                 # React Flow lifecycle wiring
│       └── hooks/
│           ├── useWorkbench.ts
│           ├── useWorkbenchStore.ts
│           ├── useWorkbenchNodeHandlers.ts
│           ├── useWorkbenchGestureHandlers.ts  # new gesture lifecycle adapter if needed
│           └── useWorkbenchNodeHandlers.test.ts # new behavior tests
├── hooks/
│   ├── useAutoSaveScene.ts                # gesture-aware save scheduling integration
│   └── useScenePersistence.ts             # extract persistence concerns if needed to honor file limit
├── services/workbench/
│   ├── sceneSyncBus.ts
│   ├── pendingSceneStore.ts
│   └── sceneSyncBus.test.ts
└── app/api/projects/[id]/scenes/
    └── route.ts                           # existing contract; change only if tests expose a required fix
```

**Structure Decision**: Keep the existing Workbench feature boundaries. Put pure snapshot/transaction logic in a focused store helper, keep React Flow lifecycle translation in Workbench hooks/components, and keep database persistence in the existing autosave hook/service boundary. Do not introduce a new collaboration subsystem or database entity.

## Phase 0: Research Findings

Research is complete in `research.md`.

- React Flow emits repeated controlled position changes and provides drag lifecycle data; history must be gesture-scoped.
- Existing `WorkbenchHistorySnapshot` is the correct complete before/after unit.
- Existing autosave debounce alone can persist a long drag’s intermediate state; active-gesture suppression is required.
- Existing main-scene JSONB PATCH with versioning is sufficient for completed final state; no schema migration is expected.
- Existing pending-save and console diagnostics are retained for persistence failures.

## Phase 1: Design Outputs

Design artifacts are complete:

- `data-model.md`: gesture transaction, history action, completed scene state, and lifecycle transitions.
- `contracts/scene-persistence.md`: existing GET/PATCH scene contract, version conflicts, and failure behavior.
- `quickstart.md`: focused tests, quality gates, and manual browser validation.

## Implementation Approach

### 1. Add transaction-capable Workbench history

- Define typed gesture state and actions in the Workbench store contract.
- Extract snapshot comparison, transaction state transitions, and final commit behavior into a focused helper so the existing large slice does not grow further.
- Keep transient updates synchronized to `workbenchNodes` and active `projectNodes` without appending history.
- Commit only changed final snapshots; preserve redo truncation and the existing 100-snapshot cap.
- Guard undo/redo, project switching, and unrelated edits against an active transaction.

### 2. Wire movement and group movement

- Add drag-start and drag-stop lifecycle handling around controlled React Flow `position` changes.
- Capture all affected nodes for selected-group movement, not only the primary callback node.
- Route intermediate position changes through the transient update path.
- On normal release, apply authoritative final positions, commit once, and request the existing immediate scene save.
- On cancellation or project/unmount interruption, restore the start state and do not commit or save.

### 3. Wire resize and arrow-handle gestures

- Add resize start/end boundaries around the existing node-resizer flow while preserving image/video scale calculations and arrow geometry normalization.
- Add typed arrow-handle start/end callbacks around the existing pointer movement math.
- Route intermediate resize/handle updates as transient updates and commit the final changed state once.
- Preserve existing no-op behavior and pointer capture cleanup.

### 4. Gate autosave and preserve database semantics

- Make `useAutoSaveScene` aware of active transient gestures so its debounce cannot write an intermediate position during a long gesture.
- Keep the immediate scene-save bus as the completion trigger and ensure the latest final state is read at flush time.
- Preserve scene version checks, pending IndexedDB recovery, conflict retry behavior, and authorization behavior.
- Retain local final state after failure and ensure console diagnostics identify failures; do not add a production-facing status component.
- Extract persistence logic from the already-large autosave hook if necessary rather than exceeding the repository’s file-size guidance further.

### 5. Test and verify

- Write store transaction tests before implementation for commit, no-op, cancel, multi-node, undo/redo, redo truncation, and project switching.
- Write handler tests before implementation for repeated position events, group finalization, no-op release, and cancellation.
- Extend ArrowNode behavior tests for pointer lifecycle without changing coordinate math.
- Add persistence tests proving intermediate changes are not flushed and final changes are saved once, including failure diagnostics and version-conflict paths.
- Run the quickstart commands and manually validate the sticky note `Test` scenario, group movement, resize, arrow handles, reload, and interrupted gestures.

## Constitution Check (Post-Design)

| Principle | Status | Evidence / design result |
|---|---|---|
| Type safety | PASS | Data model and contracts define explicit gesture, snapshot, and persistence types; implementation is constrained to strict TypeScript. |
| Test-first layered development | PASS | The implementation approach explicitly requires store/hook tests first and component behavior tests before wiring. |
| State architecture | PASS | Zustand owns gesture/history state; hooks own autosave/persistence effects; components only translate UI lifecycle events. |
| UI/rendering constraints | PASS | No new styling or rendering technology is introduced. |
| Module boundaries/file limits | PASS WITH MITIGATION | New focused helper/hook boundaries address the existing large Workbench slice and autosave hook. File-size review is a completion gate. |
| Database constraint | PASS | Existing Drizzle/Postgres `scenes` JSONB and version contract are reused; no hand-authored migration is included. |
| Quality gates | PASS | `pnpm run lint`, `pnpm run build`, focused tests, full Vitest, and coverage review are required before merge. |

## Complexity Tracking

No constitution violations are planned. Existing over-300-line files are documented for refactoring review; this feature must not worsen those boundaries without splitting by concern.
