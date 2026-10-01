# Tasks: Real-Time Collaborative React Flow Editor

**Input**: Design documents from `/specs/011-realtime-collaborative-react-flow/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/collaboration-contract.md, quickstart.md

**Tests**: Mandatory — the project constitution requires test-first, layered TDD: logic layers (services/hooks/store slices/utils) get a failing test named in the task BEFORE implementation; components get behavior tests derived from spec acceptance criteria.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story requirement it belongs to (US1–US5)
- Include file paths in descriptions

**Conventions**:
- Logic-layer tasks name their test file first (constitution II).
- No `any`, no `@ts-ignore` (constitution I); absolute imports; named exports; files stay under 300 lines (constitution V).
- Quality gates after every phase: `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run test:ci`.

## Path Conventions

- Next.js app runtime (mid-migration from Vite) — no second bundler entry point; the standalone `server/collab` process is retained (plan Complexity Tracking).
- Client collaboration code: `src/services/collab/`, `src/components/workbench/hooks/`, `src/store/slices/`.
- **Terminology**: spec/plan say "edges"; the Y.Doc schema and existing code use a `connections` Y.Map keyed by edge ID with `from`/`to` fields (also accepting `source`/`target`). "Edge" in task descriptions always means an entry in that `connections` map.

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Verify collaboration server bootstrap and room limits (50 concurrent collaborators per document — FR-018) in `server/collab/index.ts`; add/adjust a test in `server/collab/index.test.ts` asserting the connection limit is configured
- [ ] T002 [P] Confirm dependency versions satisfy the plan (Yjs 13.6, Hocuspocus provider/server 4.7, y-indexeddb 9) by checking `package.json` and running `pnpm exec tsc --noEmit` and `pnpm run test:ci`; record any version drift in this file

## Phase 2: Foundational (Blocking Prerequisites — document & history contracts)

- [ ] T003 Write red tests for field-level document mutation, deterministic ID-sorted projection, dangling-edge pruning, and malformed-entry skipping in `src/services/collab/sceneDocMapping.test.ts`
- [ ] T004 Extend `src/services/collab/sceneDocMapping.ts` with a field-level mutation API (update changed nested Y.Map/Y.Array paths inside an entity; never replace the whole entity value for ordinary edits) per data-model.md mutation rules; make T003 green
- [ ] T005 Write red tests for same-field last-update-wins convergence across three simulated clients and one-gesture transaction capture in `src/services/collab/convergence.test.ts` (later write by Yjs update order wins; no conflict metadata stored in the document)
- [ ] T006 Verify/adjust origin-tagged transaction helpers in `src/services/collab/collabProviderFactory.ts` so one completed gesture is exactly one origin-tagged transaction (`user:<id>:<clientID>`); make T005 green

## Phase 3: User Story 1 - Edit a shared graph in real time (Priority: P1) 🎯 MVP

**Goal**: Local edits are explicit document commands (FR-021); React Flow renders a one-way projection of the Y.Doc; no store-diff flush.

**Independent Test**: Open one document in two authorized sessions; create, edit, move, and delete nodes/edges in both; every session converges to the same graph without a REST request per operation (FR-003).

### Tests for User Story 1 ⚠️

- [ ] T007 [US1] Write red tests for explicit document commands (createNode, updateNodeField, moveNodes, deleteNode, createEdge, updateEdge, deleteEdge — field-level updates, one gesture = one origin-tagged transaction) in `src/services/collab/sceneDocCommands.test.ts`
- [ ] T008 [US1] Write red behavior tests for the one-way projection (Y.Doc changes update React Flow nodes/edges; UI state changes do NOT mutate the shared document — FR-016) in `src/components/workbench/hooks/useWorkbenchGraphProjection.test.ts`
- [ ] T009 [P] [US1] Write red behavior tests for connection status display: Connected, Reconnecting, and Offline states render correctly (FR-015) in `src/components/workbench/CollabStatusChip.test.tsx`

### Implementation for User Story 1

- [ ] T010 [US1] Implement typed document commands in `src/services/collab/sceneDocCommands.ts` (createNode, updateNodeField, moveNodes, deleteNode, createEdge, updateEdge, deleteEdge — each mutates the Y.Doc under the local origin per contracts/collaboration-contract.md); make T007 green
- [ ] T011 [US1] Implement the Y.Doc → React Flow projection hook in `src/components/workbench/hooks/useWorkbenchGraphProjection.ts` (subscribes to doc updates, projects via `extractSceneFromDoc`, preserves local drag ownership so remote updates do not interrupt an active gesture); make T008 green
- [ ] T012 [US1] Route workbench edit operations through the document commands: node create/edit/move/delete in `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`; edge create/update/delete via `src/components/workbench/hooks/workbenchConnectionLogic.ts` and the `removeConnection` action in `src/store/slices/workbenchSlice.ts` (remove collaborative graph authority from the slice; keep single-user mode working through the same adapter or an explicitly separate non-collaborative path with no duplicate authority)
- [ ] T013 [US1] Remove the bidirectional store-diff bridge: delete `src/services/collab/collabStoreSync.ts` and `src/services/collab/collabStoreSync.test.ts`, update all imports (incl. `src/components/workbench/hooks/useCollabSession.ts`), and add a regression test in `src/services/collab/sceneDocCommands.test.ts` asserting no store-to-doc flush path remains
- [ ] T014 [US1] Verify the status chip renders Connected/Reconnecting/Offline from the session status in `src/components/workbench/CollabStatusChip.tsx` (wired to `useCollabSession.ts` status); make T009 green

## Phase 4: User Story 2 - Undo and redo my own collaborative work (Priority: P1)

**Goal**: Per-user, origin-scoped, in-memory undo/redo that never reverts another user's operations.

**Independent Test**: Two sessions make interleaved edits; each session undoes/redoes only its own completed changes against the current shared document.

### Tests for User Story 2 ⚠️

- [ ] T015 [US2] Write red tests for per-origin undo/redo: undo-after-remote-same-node-edit, redo-after-conflict, offline history, gesture grouping (one stack item per completed gesture — FR-008), and no history persistence in `src/services/collab/undoOrigin.test.ts`
- [ ] T016 [P] [US2] Write red tests asserting the undo stack is absent from server persistence and IndexedDB after offline edit/undo/redo cycles (FR-007) in `src/services/collab/offlineSync.test.ts`

### Implementation for User Story 2

- [ ] T017 [US2] Route toolbar and keyboard Undo/Redo to the origin-scoped manager in collaborative mode via `src/components/workbench/hooks/useCollabSession.ts` (expose undo/redo/canUndo/canRedo) and the workbench status/toolbar components in `src/components/workbench/`; make T015 green

## Phase 5: User Story 3 - See collaborators and their cursors (Priority: P1)

**Goal**: Ephemeral presence/cursors with throttling, stale cleanup, and render isolation.

**Independent Test**: Open a document in multiple sessions; move cursors and pan/zoom; verify identity, color, world-space positions, stale removal, and no full graph rerender on cursor updates.

### Tests for User Story 3 ⚠️

- [ ] T018 [P] [US3] Write red tests for awareness payload typing, 30–40 updates/sec throttling (FR-013), and stale cleanup (immediate on clean disconnect; 30-second timeout for abnormal drops — FR-013) in `src/services/collab/awareness.test.ts`
- [ ] T019 [P] [US3] Write red behavior tests for cursor overlay isolation (remote cursor updates do not trigger a full React Flow graph rerender; cursors transform correctly under pan/zoom — FR-014) in `src/components/workbench/CursorOverlay.test.tsx`
- [ ] T020 [P] [US3] Write red tests asserting no cursor/presence record is present in persisted document state or document history after any run (FR-012, SC-009) in `server/collab/persistence.test.ts`

### Implementation for User Story 3

- [ ] T021 [US3] Extract awareness logic into `src/services/collab/awareness.ts` (typed payloads: user identity, color, cursor world position, connection presence; throttled publication; stale-cleanup timers) moving logic out of `src/services/collab/collabProviderFactory.ts` and `src/components/workbench/hooks/useCollabPresencePublisher.ts`; make T018 green
- [ ] T022 [US3] Isolate cursor rendering in `src/components/workbench/CursorOverlay.tsx` (memoized, world-space transform independent of React Flow node state); make T019 green

## Phase 6: User Story 4 - Continue working through network loss (Priority: P1)

**Goal**: Offline edits survive refresh and converge after reconnection with zero lost confirmed edits.

**Independent Test**: Disconnect a session, edit, refresh (IndexedDB restore), reconnect; the local and remote documents converge via symmetric state-vector merge with no lost confirmed edits and no pointer replay.

### Tests for User Story 4 ⚠️

- [ ] T023 [US4] Write red tests for offline persistence: y-indexeddb readiness awaited before treating the local doc as authoritative, refresh recovery, and symmetric state-vector reconnect merge (both sides' missing updates applied; neither replica discarded — FR-011) in `src/services/collab/offlineSync.test.ts`
- [ ] T024 [P] [US4] Write red tests asserting historical pointer positions are never replayed on reconnect — only completed document operations synchronize (FR-009, US4/AC4) in `src/services/collab/offlineSync.test.ts`

### Implementation for User Story 4

- [ ] T025 [US4] Implement/verify IndexedDB readiness gating and reconnect merge in `src/services/collab/collabProviderFactory.ts` and `src/components/workbench/hooks/useCollabSession.ts`; make T023 green

## Phase 7: User Story 5 - Join only authorized documents (Priority: P1)

**Goal**: Authentication and document authorization before any data is transmitted.

**Independent Test**: Attempt to join as authorized and unauthorized users, including token expiry and reconnect; unauthorized sessions receive no document, cursor, or presence data.

### Tests for User Story 5 ⚠️

- [ ] T026 [US5] Write red tests for the authorization matrix in `server/collab/auth.test.ts`: authorized join admitted; unauthenticated/lacking-access join rejected with NO document, cursor, or presence data disclosed (SC-008); expired token rejected; reconnect with fresh token rejoins and republishes presence

### Implementation for User Story 5

- [ ] T027 [US5] Enforce/verify token authentication and project/document authorization before room admission and on reconnect in `server/collab/auth.ts` and `src/services/collab/roomTokenService.ts`; make T026 green

## Phase 8: Scale & Convergence Verification (FR-018, FR-019, SC-003–SC-007)

**Goal**: Measured proof that the system meets the 50-collaborator target and the SC-007 degradation threshold.

- [ ] T028 Build a deterministic multi-client convergence harness (node/edge operations, same-field LWW conflicts, offline edits, per-user history; ≥3 simulated clients) in `src/services/collab/convergence.test.ts`
- [ ] T029 [P] Implement performance telemetry for p95 document sync, p95 cursor latency, interaction latency (local edit → visible render), and sustained frame rate in `src/services/collab/performanceTelemetry.ts` with tests in `src/services/collab/performanceTelemetry.test.ts`
- [ ] T030 Add a browser performance scenario for 50 collaborators at 30–40 cursor updates/sec/user measuring the SC-007 threshold (interaction latency p95 <100 ms, ≥30 fps sustained) and React Flow render churn in `scripts/perf/collab-bench.mjs` (following the existing `scripts/perf/workbench-bench.sh` + `e2e/scene-sync.e2e.mjs` harness pattern); document the run in `specs/011-realtime-collaborative-react-flow/quickstart.md`
- [ ] T031 Optimize only measured bottlenecks from T030 in the modules they implicate (e.g. `src/services/collab/awareness.ts`, `src/components/workbench/CursorOverlay.tsx`, `src/components/workbench/hooks/useWorkbenchGraphProjection.ts`); do not move authoritative graph state back into Zustand; re-run until all target metrics pass

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T032 Verify existing documents are adopted without data loss and current durable scene state remains available (plan Phase 5 rollout) in `server/collab/persistence.test.ts`
- [ ] T033 Confirm server persistence stores current document state only — never awareness or undo history — in `server/collab/persistence.test.ts`
- [ ] T034 Document rollback behavior if the collaboration provider or local persistence cannot initialize (UI reports connection state, does not claim offline durability when storage is unavailable) in `src/components/workbench/hooks/useCollabSession.ts` and the workbench status view in `src/components/workbench/`
- [ ] T035 Run full quality gates via `package.json` scripts: `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run test:ci`, `pnpm run build`; confirm coverage floor not regressed
- [ ] T036 Execute all quickstart.md scenarios end-to-end (convergence, offline recovery, awareness/authorization, performance) and record results

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phases 3–7)**: All depend on Foundational phase completion.
- **Scale verification (Phase 8)**: Requires US1–US5 complete (measures the integrated system).
- **Polish (Phase 9)**: Depends on Phase 8 metrics passing.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories.
- **User Story 2 (P1)**: Can start after US1 — undo/redo routes through the document-command transaction origins introduced in Phase 3.
- **User Stories 3, 4, 5 (P1)**: Independent of each other once Foundational is done; US4 benefits from US1's projection but can proceed in parallel with US2–US3.

### Within Each User Story

Tests are written first (red), then implementation makes them green (constitution II). Test tasks marked [P] touch different files and can run in parallel.

### Parallel Opportunities

- T001 ∥ T002 (Phase 1)
- T003/T004 ∥ T005/T006 (Phase 2, different files)
- T009 ∥ T007/T008 (Phase 3 test-writing tasks, different files)
- T016 ∥ T015 (Phase 4, different files)
- T018 ∥ T019 ∥ T020 (Phase 5 test-writing tasks)
- T024 ∥ T023 (Phase 6, same file — run sequentially if conflicts arise)
- T029 ∥ T028 (Phase 8, different files)
- US3/US4/US5 phases can run as parallel tracks after Phase 2

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (test-first):
pnpm exec vitest src/services/collab/sceneDocCommands.test.ts &
pnpm exec vitest src/components/workbench/hooks/useWorkbenchGraphProjection.test.ts &
pnpm exec vitest src/components/workbench/CollabStatusChip.test.tsx &

# Then implement in dependency order:
# T010 (commands) → T011 (projection) → T012 (routing) → T013 (bridge removal) → T014 (status chip)
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1

**MVP = User Story 1** (Phases 1–3): explicit document commands + one-way projection + two-session convergence. This alone delivers the primary value and removes the dual-authority gate (FR-002/FR-016/FR-021).

### Incremental Delivery

1. **Increment 2**: US2 (per-user history) — makes collaborative editing safe.
2. **Increment 3**: US3 + US4 + US5 in parallel tracks — presence, offline resilience, and authorization hardening.
3. **Final**: Phase 8 scale verification against SC-007, then Phase 9 rollout polish.

### Parallel Team Strategy

- Developer A: Phase 2 → US1 (critical path)
- Developer B: Phase 2 → US5 (server-side auth, independent files)
- Developer C: Phase 2 → US3 (awareness extraction, independent files)
- After US1 lands: Developer D joins US4 (offline merge touches provider factory — coordinate with B/C on `collabProviderFactory.ts`)

## Notes

- Every task names its file path(s); logic-layer tasks name the test file first.
- "Edge" = entry in the Y.Doc `connections` map (see Path Conventions).
- The plan gate condition applies: do not claim FR-002/FR-016/FR-021 complete until T013 (bridge removal) is done and its regression test passes.
