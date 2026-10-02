---
description: "Task list for real-time collaborative React Flow editor"
---

# Tasks: Real-Time Collaborative React Flow Editor

**Input**: Design documents in `/specs/011-realtime-collaborative-react-flow/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`.

**TDD**: Required by Constitution II. Logic-layer test tasks precede the implementation task they make green; component behavior tests precede component implementation. Keep every changed source file below 300 lines and do not add `any` or `@ts-ignore`.

**Y.Doc schema terminology**: Nodes use the `nodes` Y.Map; React Flow edges are persisted in the existing `connections` Y.Map. `metadata.name` is the shared scene name. Scene ownership/lifecycle fields remain server-managed. Local pointer motion stays transient; only the completed gesture is committed.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing toolchain and dependency assumptions before modifying collaboration code.

- [X] T001 [P] Verify installed versions in `package.json` against the plan (Yjs 13.6, Hocuspocus provider/server 4.7, y-indexeddb 9, React Flow 12.10) and confirm the existing Vitest, Next.js build, and collaboration-server scripts are available; report drift without changing unrelated dependencies.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish bounded room admission, backward-compatible Y.Doc schema, and deterministic transaction conventions before story work.

- [X] T002 [P] Write unit tests for per-document capacity reservations in `server/collab/roomCapacity.test.ts`: admit 50 distinct authenticated socket IDs, reject the 51st, release on disconnect, allow a later reconnect, isolate counts by document, and release failed admissions.
- [X] T003 Implement typed room-capacity reservations in `server/collab/roomCapacity.ts` and wire `onAuthenticate`/`onDisconnect` in `server/collab/index.ts` so rejected or unauthorized sessions never hold a reservation; use explicit Hocuspocus context `{ userId: string }` and enforce a 50-connection cap per document (FR-017, FR-018).
- [X] T004 Write red schema/mapping tests in `src/services/collab/sceneDocMapping.test.ts` for nested field mutation without whole-entity replacement, deterministic ID-sorted projection, malformed-entry skipping, dangling-edge pruning, and `metadata.name` initialization/read/write while preserving `nodes` and `connections`.
- [X] T005 Extend `src/services/collab/sceneDocMapping.ts` with typed accessors and field-path updates for keyed nodes/connections plus `metadata.name`; preserve flat persisted node `x`/`y`, project deterministically, and make T004 green.
- [X] T006 Write red multi-client tests in `src/services/collab/convergence.test.ts` for same-field last-update-wins by Yjs update order, disjoint-field merge, three-client convergence, and a completed gesture producing one origin-tagged history unit; assert no conflict metadata is added.
- [X] T007 Adjust transaction/origin helpers in `src/services/collab/collabProviderFactory.ts` and `src/services/collab/undoOrigin.ts` as needed to make T006 green: use `user:<id>:<clientID>` origin, apply only completed commands under that origin, and expose an explicit capture boundary for gestures.

## Phase 3: User Story 1 - Edit a shared graph in real time (Priority: P1) 🎯 MVP

**Goal**: Explicit Y.Doc commands and a one-way React Flow projection replace collaborative Zustand graph authority and synchronize scene name.

**Independent Test**: In two authorized sessions, create/edit/move/delete nodes and connections and rename the scene; verify both projections converge, a REST call is not made per graph operation, single-user behavior remains intact, and Zustand changes cannot write back to the shared document.

### Tests for User Story 1

- [X] T008 [P] [US1] Write red command-service tests in `src/services/collab/sceneDocCommands.test.ts` for create/update/move/delete node, create/update/delete connection, scene rename, field-level updates, stable IDs, origin tagging, invalid/missing entities, and one transaction per completed operation.
- [X] T009 [P] [US1] Write hook behavior tests in `src/components/workbench/hooks/useWorkbenchGraphProjection.test.ts` proving Y.Doc updates project to React Flow node/edge shapes, `metadata.name` is exposed, updates unsubscribe on teardown, and local UI/store changes do not mutate the Y.Doc.
- [X] T010 [P] [US1] Write server persistence tests in `server/collab/persistence.test.ts` for mirroring `metadata.name` to `scenes.name` and hydrating legacy Y.Docs from the row name without replacing graph state.
- [X] T011 [P] [US1] Write behavior tests for accessible inline scene renaming in `src/components/workbench/WorkbenchSceneNameEditor.test.tsx`, including submit, cancel, blank-name rejection, remote name updates, and separation from the project-name editor.
- [X] T012 Implement typed explicit commands in `src/services/collab/sceneDocCommands.ts` for graph operations and scene rename, applying changes directly to the Y.Doc with the local origin and field-level mutation helpers; make T008 green.
- [X] T013 Implement `src/components/workbench/hooks/useWorkbenchGraphProjection.ts` as a Y.Doc observer producing deterministic React Flow projections and scene name; hold in-progress drag preview locally and reconcile remote changes without overwriting the active gesture; make T009 green.
- [X] T014 Update `server/collab/persistence.ts` to seed `metadata.name` from the authoritative row for legacy documents and mirror the converged document name back to `scenes.name` while preserving encoded Y.Doc and projected `scenes.data`; make T010 green without adding a migration.
- [X] T015 Implement `src/components/workbench/WorkbenchSceneNameEditor.tsx` and wire it through `src/components/workbench/WorkbenchChrome.tsx`/`src/components/workbench/workbench.tsx` to the projection and rename command; keep the existing project name control unchanged and make T011 green.
- [X] T016 [P] [US1] Add handler integration tests in `src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts`, `src/components/workbench/hooks/useWorkbenchConnectionHandlers.test.ts`, and `src/store/workbenchConnections.test.ts` proving node edits, resize, move, deletion, and connection create/delete use document commands in collaboration mode while single-user tests still pass.
- [X] T017 [US1] Route node create/update/resize/move/delete paths through typed commands in `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`, `src/components/workbench/hooks/useWorkbench.ts`, and `src/store/slices/workbenchSlice.ts`; route connection policy changes and edge removal through `src/components/workbench/hooks/useWorkbenchConnectionHandlers.ts`/`src/components/nodes/CustomEdge.tsx`; keep transient gesture previews local and commit completed values only.
- [X] T018 [US1] Remove `src/services/collab/collabStoreSync.ts` and `src/services/collab/collabStoreSync.test.ts`, remove its imports and lifecycle from `src/components/workbench/hooks/useCollabSession.ts`, and add a regression assertion in `src/components/workbench/hooks/useCollabSession.test.ts` that store-only graph changes do not write back to Y.Doc (FR-016, FR-021).

## Phase 4: User Story 2 - Undo and redo my own collaborative work (Priority: P1)

**Goal**: Per-user in-memory history undoes only local completed commands against the current shared document.

**Independent Test**: Interleave edits from two clients, including offline edits; undo and redo in each and verify remote changes remain and each completed gesture is one history entry.

- [X] T019 [P] [US2] Write red tests in `src/services/collab/undoOrigin.test.ts` for local-origin-only tracking, undo after a remote same-node edit, redo after a conflict, create/delete and field edits, one gesture per stack item, and no history after session teardown.
- [X] T020 [P] [US2] Extend `src/services/collab/offlineSync.test.ts` with tests proving offline undo/redo works locally and Y.UndoManager stack items are absent from encoded server document and IndexedDB after close/reopen (FR-007).
- [X] T021 [US2] Implement or adjust `src/services/collab/undoOrigin.ts` and command transaction boundaries to make T019 green; retain history only in the session’s in-memory UndoManager, never in Y.Doc data or persistence.
- [X] T022 [US2] Verify `src/components/workbench/hooks/useCollabSession.ts`, `src/components/workbench/workbench.tsx`, and toolbar/keyboard handlers route collaborative Undo/Redo through the origin-scoped manager and disable store-snapshot history in collaboration mode; make T019/T020 green.

## Phase 5: User Story 3 - See collaborators and their cursors (Priority: P1)

**Goal**: Typed ephemeral awareness, bounded cursor publication, stale cleanup, and cursor rendering isolated from graph state.

**Independent Test**: In multiple sessions, verify identity/color/world coordinates under pan and zoom, 30–40 cursor updates/sec, immediate clean-disconnect cleanup, 30-second abnormal-drop expiry, and no graph rerender from cursor-only changes.

- [X] T023 [P] [US3] Write unit tests in `src/services/collab/awareness.test.ts` for typed awareness payloads, cursor publication capped at 30–40 Hz, world-coordinate payloads, pointer-leave clearing, immediate clean-disconnect cleanup, 30-second abnormal-drop cleanup, timer refresh/cancellation, and peer reappearance.
- [X] T024 [P] [US3] Write render-isolation and coordinate behavior tests in `src/components/workbench/CursorOverlay.test.tsx` proving cursor updates do not rerender graph nodes and world-to-screen placement follows viewport pan/zoom.
- [X] T025 [US3] Implement `src/services/collab/awareness.ts` and update `src/components/workbench/hooks/useCollabPresencePublisher.ts`/`src/services/collab/collabProviderFactory.ts` to type identity, color, cursor, and active-node presence, throttle publication to 30–40 Hz, and clean stale peers; make T023 green.
- [X] T026 [US3] Memoize and isolate `src/components/workbench/CursorOverlay.tsx` from React Flow graph state while preserving the world-to-screen transform; make T024 green.

## Phase 6: User Story 4 - Continue working through network loss (Priority: P1)

**Goal**: Local document updates survive supported offline periods/refresh and merge symmetrically after reauthorization.

**Independent Test**: Disconnect one session, complete graph edits, refresh with IndexedDB available, reconnect with valid authorization, and verify both local and server updates converge with zero lost completed edits and no pointer replay.

- [X] T027 [US4] Write readiness/recovery tests in `src/components/workbench/hooks/useCollabSession.test.ts` and `src/services/collab/offlineSync.test.ts` proving IndexedDB `whenSynced` completes before the doc is treated as authoritative, including an empty local store and restored local updates.
- [X] T028 [US4] Write reconnect tests in `src/services/collab/offlineSync.test.ts` proving both replicas’ missing state-vector updates are applied after concurrent offline/online edits, and historical pointer positions are never persisted or replayed (FR-011, US4/AC4).
- [X] T029 [US4] Update `src/services/collab/collabProviderFactory.ts` and `src/components/workbench/hooks/useCollabSession.ts` to gate initial local projection on IndexedDB readiness, preserve local edits while disconnected, reauthorize on reconnect, and rely on symmetric Hocuspocus/Yjs reconciliation without discarding either replica; make T027/T028 green.

## Phase 7: User Story 5 - Join only authorized documents (Priority: P1)

**Goal**: Authenticate and recheck document access before synchronization; give rejected joins a safe, generic recovery message.

**Independent Test**: Exercise authorized, unauthenticated, expired-token, lost-membership, and reconnect cases; rejected sessions receive no document or awareness and see the same generic access-unavailable recovery guidance.

- [X] T030 [P] [US5] Verify `server/collab/auth.test.ts` and `src/app/api/projects/[id]/scenes/collab-token/route.test.ts` cover valid/invalid tokens, expiry, wrong scene, membership revocation, missing secret, and unauthorized admission without document/cursor/presence disclosure.
- [X] T031 [P] [US5] Add UI behavior tests in `src/components/workbench/hooks/useCollabSession.test.ts` and `src/components/workbench/CollabStatusChip.test.tsx` proving reconnecting/offline/denied states and a generic access-unavailable message with sign-in/retry guidance that does not expose missing-scene or permission details.
- [X] T032 [US5] Keep `server/collab/auth.ts` and `src/services/collab/roomTokenService.ts` fail-closed; wire capacity admission after token/membership validation and guarantee reservation cleanup on denial/disconnect, making T002/T003/T030 green.
- [X] T033 [US5] Update `src/types/collab.types.ts`, `src/components/workbench/hooks/useCollabSession.ts`, and `src/components/workbench/CollabStatusChip.tsx` to expose Connected, Reconnecting, Offline, and denied states, refresh tokens on retry, and show one generic access-unavailable message with safe sign-in/retry action; make T031 green.

## Phase 8: Scale & Convergence Verification (FR-018, FR-019, SC-003–SC-007)

**Goal**: Validate convergence and all latency/frame-rate targets using the same repeatable 50-collaborator workload.

- [X] T034 [P] Add telemetry tests in `src/services/collab/performanceTelemetry.test.ts` for p95 document-sync, cursor, interaction latency, sustained FPS, cursor update frequency, and cursor-only React Flow render counts using the defined workload.
- [X] T035 Implement typed metric collection/aggregation in `src/services/collab/performanceTelemetry.ts` for document-sync, cursor, interaction latency, FPS, cursor frequency, and graph render counts; make T034 green.
- [X] T036 Extend `src/services/collab/convergence.test.ts` with an integrated deterministic three-client run covering graph/name commands, field-level merge, LWW, isolated undo, disconnect/reconnect merge, and persistence projection; meet SC-001/002/006/009.
- [X] T037 Add `scripts/perf/collab-bench.mjs` using the existing browser/e2e harness to run 50 collaborators publishing 30–40 cursor updates/sec each while one editor submits one graph operation/sec for at least 60 seconds after warm-up; record document-sync p95 <200 ms, cursor p95 <150 ms, interaction p95 <100 ms, ≥30 FPS, and cursor-only render churn (SC-003–SC-007).
- [X] T038 Run the benchmark profile from T037 and optimize only measured bottlenecks in the implicated modules (for example `src/services/collab/awareness.ts`, `src/components/workbench/CursorOverlay.tsx`, or `src/components/workbench/hooks/useWorkbenchGraphProjection.ts`); repeat until every stated target passes and record environment/results in `specs/011-realtime-collaborative-react-flow/quickstart.md`.

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T039 [P] Add persistence rollout tests in `server/collab/persistence.test.ts` proving legacy scene JSON/Y.Docs load without graph loss, `metadata.name` hydrates from `scenes.name`, and subsequent saves preserve name, encoded document, and projected `scenes.data`.
- [X] T040 Update `server/collab/persistence.ts` as needed to pass the T039 migration/adoption cases while storing no awareness state or undo history in `scenes.data`/`ydoc`.
- [X] T041 Document provider/IndexedDB initialization and rollback behavior in `src/components/workbench/hooks/useCollabSession.ts`, `src/components/workbench/CollabStatusChip.tsx`, and `specs/011-realtime-collaborative-react-flow/quickstart.md`: report offline durability unavailable when local storage fails, retain safe single-user fallback where supported, and never claim unsaved offline persistence.
- [X] T042 Run `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run test:ci`, and `pnpm run build` from `package.json`; resolve feature-introduced issues and confirm the coverage floor does not regress.
- [X] T043 Execute the automated collaboration, scene rename, undo/redo, offline recovery, awareness, authorization, and persistence scenarios plus the 50-client performance profile in `specs/011-realtime-collaborative-react-flow/quickstart.md`; record pass/fail measurements and environment notes there.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 is independent; it confirms the repository baseline.
- **Foundational (Phase 2)**: T002–T007 establish the room cap, schema, and transaction conventions; complete before user-story implementation.
- **US1**: Depends on T004–T007; it establishes document commands/projection and removes dual graph authority.
- **US2**: Depends on US1 commands and local origins (T012, T017–T018); history is bound to the completed-command path.
- **US3**: Depends on foundational Y.Doc/awareness types; may proceed independently of US2 and US4 after Phase 2.
- **US4**: Depends on US1 document commands/projection; may run in parallel with US2/US3 where files do not overlap.
- **US5**: Depends on foundational capacity reservations; may run in parallel with US1–US4 except shared session/provider files.
- **Scale verification (Phase 8)**: T036–T038 requires the integrated US1–US5 behavior.
- **Polish (Phase 9)**: T039–T043 follows implementation and measured performance validation.

### User Story Completion Order

- **US1 (P1)** is the MVP and unlocks the other client features.
- **US2 (P1)** follows US1 because undo depends on command transaction origins.
- **US3, US4, and US5 (P1)** are independently testable after the foundational phase; coordinate provider/session file changes to avoid conflicts.

### Parallel Opportunities

- T002 ∥ T004 ∥ T006: room-capacity, mapping, and convergence tests touch separate modules.
- T008 ∥ T009 ∥ T010 ∥ T011: US1 red tests use independent service, hook, server persistence, and component files.
- T019 ∥ T020: undo-manager and offline-persistence tests are separate.
- T023 ∥ T024: awareness-service and cursor-component tests are independent.
- T027 ∥ T028: offline readiness and state-vector/pointer-replay tests share one test file; coordinate edits or run sequentially.
- T030 ∥ T031: server/API auth tests and client UI behavior tests are independent.
- T034 ∥ T036: metric tests and integrated convergence tests use separate files.
- After Phase 2, US3 and US5 can proceed in parallel with US1; US4 can proceed once the command/projection interfaces from US1 are agreed.

## Parallel Example: User Story 1

```bash
# Write and run the independent red tests first:
pnpm exec vitest src/services/collab/sceneDocCommands.test.ts
pnpm exec vitest src/components/workbench/hooks/useWorkbenchGraphProjection.test.ts
pnpm exec vitest server/collab/persistence.test.ts
pnpm exec vitest src/components/workbench/WorkbenchSceneNameEditor.test.tsx

# Then implement the corresponding layers in order:
# commands/mapping -> document projection -> persistence/name UI -> workbench routing -> bridge removal
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases (room limit, schema, origins, test baselines).
2. Complete US1 end-to-end: explicit document commands, one-way projection, shared scene name, migration-safe persistence, routed handlers, and removal of `collabStoreSync`.
3. Verify US1 with two authorized sessions and no per-operation REST mutation path before proceeding.

**MVP = US1**: this satisfies the primary graph-editing flow and closes the FR-002/FR-016/FR-021 dual-authority gate. Do not claim that gate complete while the store-diff bridge remains.

### Incremental Delivery

1. Add US2 per-user Undo/Redo on the command transaction path.
2. Add US3 awareness/presence, US4 offline recovery, and US5 authorization UX/hardening as independent tracks after shared interfaces stabilize.
3. Complete the 50-client workload and latency/FPS benchmarks, then persistence rollout, rollback checks, and full quality gates.

## Notes

- Every task is a checkbox with a sequential ID; user-story tasks carry the matching story label and a concrete file path.
- Logic test tasks precede implementations; component behavior tests precede components per Constitution II.
- Existing persisted edges remain entries in `connections`; do not rename the root Y.Map as part of this feature.
- Existing schema uses flat `x`/`y`; React Flow `position` is a derived projection.
- T002 requires the per-document cap to count authenticated active connections; horizontal multi-process coordination is outside the current single-server deployment scope.

## Phase 10: Convergence

- [X] T044 CRITICAL Split `src/components/workbench/workbench.tsx` into focused view and logic modules, preserving behavior and keeping each file below 300 lines per Constitution V (contradicts).
- [X] T045 CRITICAL Split `src/store/slices/workbenchSlice.ts` into focused state/action modules, preserving behavior and keeping each file below 300 lines per Constitution V (contradicts).
- [X] T046 CRITICAL Split `src/components/workbench/hooks/useCollabSession.test.ts` into focused test suites by concern, preserving coverage and keeping each file below 300 lines per Constitution V (contradicts).
