# Tasks: Real-Time Workbench Collaboration

**Input**: Design documents from `/specs/003-workbench-collaboration/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: MANDATORY here — the project constitution (`.specify/memory/constitution.md`, Principle II) requires test-first TDD for all logic layers (services, hooks, store slices, server modules) and behavior tests from spec acceptance criteria before component implementation. Every logic-layer task below names its test file first; tests must FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and tooling for the collaboration stack

- [X] T001 Add collaboration dependencies to `package.json`: runtime `yjs`, `y-indexeddb`, `@hocuspocus/server`, `@hocuspocus/extension-database`, `@hocuspocus/provider`; dev `fake-indexeddb`; plus script `"dev:collab": "tsx server/collab/index.ts"`
- [X] T002 [P] Configure Vitest so tests under `server/collab/` run in node environment against the Drizzle schema (environment override or workspace entry) in `vitest.config.ts`, and confirm `fake-indexeddb` is available to client-side suites

**Checkpoint**: Dependencies installed; both client and server test environments run.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The collaboration kernel — token service, document mapping, schema, Hocuspocus server (auth + persistence), token API route, client provider factory. All user stories build on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Write failing tests in `src/services/collab/roomTokenService.test.ts`: issue produces payload of exactly `{ projectId, sceneId, userId, issuedAt, expiresAt }` with TTL ≈ 5 minutes; verify accepts valid tokens and rejects expired, tampered, and out-of-scope (sceneId mismatch) tokens
- [X] T004 Implement signed room-token issue/verify (HMAC/JWT, shared secret from env) in `src/services/collab/roomTokenService.ts` (depends on T003)
- [X] T005 [P] Write failing tests in `src/services/collab/sceneDocMapping.test.ts`: JSON→document seed preserves 100% of nodes and connections; document→JSON extraction round-trips; nodes and connections stored in keyed collections (per node ID / connection ID); orphaned connections (referencing absent node IDs) are pruned during projection
- [X] T006 Implement scene JSON ↔ shared-document mapping (seed + extract + orphan pruning) in `src/services/collab/sceneDocMapping.ts` (depends on T005)
- [X] T007 [P] Add the nullable bytea `ydoc` column to `scenes`: update `src/lib/db/schema.ts`, generate the migration with `pnpm run db:generate` (`drizzle/000N_add_scenes_ydoc.sql`), apply with `pnpm run db:migrate`; verify pre-existing rows are untouched (column NULL)
- [X] T008 [P] Write failing tests in `server/collab/auth.test.ts`: valid token with current project membership is admitted; malformed, expired, and out-of-scope tokens are rejected; a token whose user has lost workspace membership is rejected at join time (SC-006)
- [X] T009 Implement the Hocuspocus `onAuthenticate` hook (token verification via roomTokenService + database membership re-check for the token's userId) in `server/collab/auth.ts` (depends on T008, T004)
- [X] T010 [P] Write failing tests in `server/collab/persistence.test.ts`: debounced save ~2 s after last change writes extracted JSON to `scenes.data`, bumps `version`, sets `updatedBy` to the last editor known in the room, and stores the encoded document in `ydoc`; immediate final save when the last client leaves; load prefers `ydoc` over JSON when both exist; seeds from JSON when `ydoc` is absent (SC-007); a failed save is retried on next trigger and never blocks or rolls back live document state
- [X] T011 Implement `onLoadDocument`/`onSaveDocument` persistence hooks (debounce ~2 s, final save on room close, single-writer Drizzle upsert) in `server/collab/persistence.ts` (depends on T010, T006, T007)
- [X] T012 Wire the Hocuspocus server bootstrap (env-driven port/token-secret/DB URL, auth + database extensions, lifecycle logging; fail fast at boot if the token secret is missing) in `server/collab/index.ts` (depends on T009, T011)
- [X] T013 [P] Write failing tests in `src/app/api/projects/[id]/scenes/collab-token/route.test.ts`: 200 with a scoped token for a workspace member; 401 without session; 403 for a non-member using the existing `canAccessProject` membership pattern; 404 for missing project and for a project without a main scene
- [X] T014 Implement `POST /api/projects/:id/scenes/collab-token` (NextAuth `auth()` + membership check + main-scene resolution + roomTokenService issue) in `src/app/api/projects/[id]/scenes/collab-token/route.ts` (depends on T013, T004)
- [X] T015 [P] Write failing tests in `src/services/collab/collabProviderFactory.test.ts`: provider connects to the room named by the scene ID; local transactions are tagged with the per-user origin; awareness channel is active on connect; the local client's own awareness state is excluded from derived remote states
- [X] T016 Implement the client provider factory (Hocuspocus provider + awareness + per-user local origin) in `src/services/collab/collabProviderFactory.ts` (depends on T015)

**Checkpoint**: Foundation ready — a token can be issued, a room admits only members, documents persist and lazy-import, and the client factory can connect. User story implementation can now begin.

---

## Phase 3: User Story 1 - Two teammates edit the same scene without losing work (Priority: P1) 🎯 MVP

**Goal**: Concurrent editing of one project's main scene with guaranteed convergence — every completed edit from every collaborator present in every session, no reloads.

**Independent Test**: Open the same project scene in two browser sessions; overlap edits (move/add/delete/connection changes, including both users touching the same node); verify both sessions converge to an identical scene containing every completed edit (SC-001, SC-002).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T017 [P] [US1] Write failing convergence tests in `src/services/collab/convergence.test.ts`: N (2–5) in-memory documents over a fake provider bus perform concurrent node moves, adds, deletes, and connection changes from all clients → every completed edit is present in every final state and all final states are identical (SC-001, SC-002)
- [X] T018 [P] [US1] Write failing tests in `src/components/workbench/hooks/useCollabSession.test.ts`: session lifecycle idle→connecting→connected; document changes project into the workbench store nodes/edges via `applyNodeChanges`/`applyEdgeChanges`; teardown on project switch and unmount
- [X] T019 [P] [US1] Write failing tests in `src/services/collab/undoOrigin.test.ts`: one completed gesture (per feature 002 atomicity) applies as exactly one origin-tagged transaction; the per-client UndoManager uses `trackedOrigins: [own origin]`; undoing own actions leaves all remote changes intact (SC-005); a new local edit after Undo truncates the redo path
- [X] T020 [P] [US1] Write failing tests in `src/hooks/useAutoSaveScene.test.ts`: while a collab session is active for a scene, no JSON PATCH autosave is issued for that scene; after session close the single-user autosave path resumes unchanged (FR-012, single-writer rule)

### Implementation for User Story 1

- [X] T021 [US1] Implement `useCollabSession` hook (token fetch from the collab-token route, provider lifecycle via the factory, document→store projection, session status into the collaboration slice) in `src/components/workbench/hooks/useCollabSession.ts` (depends on T016, T014, T018)
- [X] T022 [US1] Route workbench graph mutations through origin-tagged shared-document transactions while a session is active (preserving feature 002 one-gesture-one-action semantics) and wire the per-user UndoManager in `src/store/slices/workbenchCollaborationSlice.ts` + `src/services/collab/collabProviderFactory.ts` (depends on T021, T019)
- [X] T023 [US1] Suspend/resume the autosave JSON-PATCH path around the collab session in `src/hooks/useAutoSaveScene.ts` (depends on T020, T021)
- [X] T024 [US1] Integrate `useCollabSession` into the workbench: join on main-scene load, teardown on project switch/unmount, in `src/components/workbench/workbench.tsx` (depends on T021)

**Checkpoint**: MVP — two sessions co-edit one scene with convergence, local-only undo, and single-writer persistence. Validate independently per the quickstart before proceeding.

---

## Phase 4: User Story 2 - See who is working and where (Priority: P1)

**Goal**: Live presence list and labeled remote cursors so collaborators can coordinate without stepping on each other.

**Independent Test**: With one session in the scene, join a second; verify the first sees the second listed within ~2 seconds (SC-003), sees its labeled cursor track canvas/world positions (including under pan/zoom), and that both disappear when the second leaves.

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Write failing tests in `src/store/slices/workbenchCollaborationSlice.test.ts`: presence list derived from awareness states excludes the local client; a peer's entry is removed when its awareness state disappears; cursor entries are null when idle
- [X] T026 [P] [US2] Write failing behavior tests in `src/components/workbench/PresenceIndicator.test.tsx` (from spec US2 acceptance scenarios): renders other collaborators' display names; excludes self; hidden when no other collaborator is present
- [X] T027 [P] [US2] Write failing behavior tests in `src/components/workbench/CursorOverlay.test.tsx`: one labeled indicator per remote non-null cursor mapped to canvas/world coordinates under pan/zoom; none for the local client; indicators removed when a peer leaves (SC-003)

### Implementation for User Story 2

- [X] T028 [US2] Extend the collaboration slice with awareness-derived presence list and remote cursor state in `src/store/slices/workbenchCollaborationSlice.ts` (depends on T025)
- [X] T029 [P] [US2] Implement `PresenceIndicator` (Tailwind chip, Framer Motion transitions) in `src/components/workbench/PresenceIndicator.tsx` (depends on T028, T026)
- [X] T030 [P] [US2] Implement `CursorOverlay` (remote cursor markers with display-name labels; viewport-transform mapping so cursors track world coordinates under pan/zoom) in `src/components/workbench/CursorOverlay.tsx` (depends on T028, T027)
- [X] T031 [US2] Publish awareness state `{ user: { id, name }, cursor: { x, y } | null, activeNodeIds: string[], selectedAt: number }` from the existing pointer-tracking hook with rAF throttling (at most one update per animation frame ≈ 16 ms while moving; `cursor: null` when idle) in a new `src/components/workbench/hooks/useCollabPresencePublisher.ts` wired from `useWorkbenchCollabSession.ts` (depends on T028)
- [X] T032 [US2] Integrate `PresenceIndicator` + `CursorOverlay` into the workbench shell, replacing the SSE-derived presence/lock chip in `src/components/workbench/workbench.tsx` (depends on T029, T030, T031)

### Soft item locks (requester addition 2025-07 — spec FR-015/FR-016)

- [X] T050 [P] [US2] Write failing tests in `src/store/slices/workbenchCollaborationSlice.test.ts`: `applyRemoteAwareness` derives presence, remote cursors (keyed by client id), and node locks — earliest `selectedAt` wins per node, ties break to lower client id, local client excluded, departed peers fully cleared
- [X] T051 [US2] Extend the collaboration slice with `remoteCursors` state + `applyRemoteAwareness` action (pure derivation of presence/cursors/locks from an awareness snapshot) in `src/store/slices/workbenchCollaborationSlice.ts` (depends on T050, covers T025/T028)
- [X] T052 [P] [US2] Write failing tests in `src/components/workbench/hooks/useCollabPresencePublisher.test.ts`: publishes `activeNodeIds`/`selectedAt` when selection or gesture changes (epoch only changes when the id SET changes); cursor published in world coordinates rAF-throttled and set null on pointer leave; a lost lock conflict releases the local selection of the contested node
- [X] T053 [US2] Implement `useCollabPresencePublisher` (awareness publishing for user/cursor/activeNodeIds/selectedAt + yield-on-lost-conflict effect) in `src/components/workbench/hooks/useCollabPresencePublisher.ts`; expose the provider from `useCollabSession` (depends on T051, T052)
- [X] T054 [P] [US2] Write failing tests: flow-node mapping sets `selectable=false`/`draggable=false` for remotely locked nodes (`useWorkbenchGraph`); `removeWorkbenchNode` skips remotely locked ids; resize/double-click/data-change entry points in `useWorkbenchNodeHandlers` ignore remotely locked nodes
- [X] T055 [US2] Enforce locks: pass `nodeLocks` into `useWorkbenchGraph` node mapping; add lock guards to `removeWorkbenchNode` (store) and `useWorkbenchNodeHandlers` (resize, resizeEnd, double-click, transient/data change, select changes) in `src/store/slices/workbenchSlice.ts` + `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts` (depends on T054)
- [X] T056 [P] [US2] Write failing behavior tests in `src/components/workbench/NodeLockBadges.test.tsx`: one holder-name badge per remotely locked node positioned at the node's screen location under pan/zoom; no badges when no remote locks
- [X] T057 [US2] Implement `NodeLockBadges` (Tailwind, world→screen mapping) in `src/components/workbench/NodeLockBadges.tsx` and integrate presence/cursor/lock overlays into the workbench shell in `src/components/workbench/workbench.tsx` (depends on T032, T056)

**Checkpoint**: User Stories 1 AND 2 both work independently — concurrent editing with visible presence, cursors, and enforced soft item locks.

---

## Phase 5: User Story 3 - Keep working offline and merge when back (Priority: P2)

**Goal**: Full offline editing with CRDT merge on reconnect — edits made while disconnected (including before an app close) are never lost.

**Independent Test**: Disconnect one session (DevTools offline or stop the collab server); make edits in both sessions; restore connectivity; verify both converge with every edit from both sides present, including a close-and-reopen variant (SC-004).

### Tests for User Story 3 ⚠️

- [X] T033 [P] [US3] Write failing tests in `src/services/collab/offlineSync.test.ts` using `fake-indexeddb`: the per-scene y-indexeddb binding persists edits across a simulated disconnect and across store close/reopen; on reconnect, state-vector synchronization merges both sides with zero lost edits (SC-004)
- [X] T034 [P] [US3] Write failing tests (extend `src/components/workbench/hooks/useCollabSession.test.ts`): transport loss moves the session to `offline-queued`; local edits continue while queued; reconnect returns to `connected` with a converged document
- [X] T035 [P] [US3] Write failing behavior tests in `src/components/workbench/CollabStatusChip.test.tsx`: chip reflects connected vs offline-queued states and never claims durable save while edits are queued

### Implementation for User Story 3

- [X] T036 [US3] Bind the shared document to a per-scene y-indexeddb store (offline queue survives disconnects and browser close; continues mirroring the converged document after sync) in `src/services/collab/collabProviderFactory.ts` (depends on T033, T016)
- [X] T037 [US3] Implement the `offline-queued` lifecycle and reconnect resync (status transitions into the collaboration slice; local editing continues while queued) in `src/components/workbench/hooks/useCollabSession.ts` (depends on T034, T036)
- [X] T038 [P] [US3] Implement `CollabStatusChip` (connected / offline-queued indicator, Tailwind + Framer Motion) in `src/components/workbench/CollabStatusChip.tsx` (depends on T035, T037)
- [X] T039 [US3] Integrate `CollabStatusChip` into the workbench shell in `src/components/workbench/workbench.tsx` (depends on T038)

**Checkpoint**: Offline resilience complete — a dropped connection no longer ends editing.

---

## Phase 6: User Story 4 - Only project members can join a shared scene (Priority: P2)

**Goal**: Collaboration stays strictly inside the existing access model — no new access paths; non-members are blocked at both the token API and the WebSocket layer.

**Independent Test**: As a non-member, `POST .../collab-token` returns 403 and direct WS connections with forged/absent/expired tokens are rejected; as a member, joining always succeeds (SC-006).

### Tests for User Story 4 ⚠️

- [X] T040 [P] [US4] Write failing tests (extend `src/components/workbench/hooks/useCollabSession.test.ts`): an authentication rejection moves the session to `denied`; no retry occurs with the same token; requesting a fresh token and reconnecting succeeds

### Implementation for User Story 4

- [X] T041 [US4] Implement the `denied` state and fresh-token re-request/reconnect flow in `src/components/workbench/hooks/useCollabSession.ts` (depends on T040)
- [X] T042 [US4] Verify SC-006 end-to-end per quickstart: non-member 403 at the token route; forged/absent/expired/out-of-scope tokens rejected at WS join; membership re-check applies when membership is lost; members always admitted — automated suites green plus the manual check in `specs/003-workbench-collaboration/quickstart.md`

**Checkpoint**: Access control verified at both layers; no anonymous or partial access path exists.

---

## Phase 7: User Story 5 - Existing scenes keep working, adopt collaboration on first shared open (Priority: P3)

**Goal**: Zero-migration adoption — pre-feature scenes behave unchanged single-user and become shared scenes with full content on first collaborative open.

**Independent Test**: Open a pre-feature scene in two sessions — all saved nodes/connections present before any edit (SC-007); after collaborative edits, reload loads the current converged state; a never-collaborated scene saved single-user behaves exactly as before (FR-012).

### Tests for User Story 5 ⚠️

- [X] T043 [P] [US5] Write failing tests (extend `src/services/collab/sceneDocMapping.test.ts` and `server/collab/persistence.test.ts`): first collaborative open of a scene with no `ydoc` seeds from JSON with 100% node/connection preservation; subsequent loads prefer `ydoc`; the single-user autosave path for never-collaborated scenes is behaviorally unchanged (FR-012, SC-007)

### Implementation for User Story 5

- [X] T044 [US5] Verify and fix the adoption flow end-to-end per quickstart US5 scenarios: pre-feature scene opens fully in two sessions; collaborative edit → reload loads the converged state (not a stale snapshot); single-user save of a never-collaborated scene is unchanged — touching `src/components/workbench/hooks/useCollabSession.ts` and `src/hooks/useAutoSaveScene.ts` only if verification finds gaps (depends on T043)

**Checkpoint**: All user stories independently functional; rollout requires no migration step.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, hardening, and full validation across all stories

- [X] T045 [P] Remove superseded SSE-derived presence/lock consumption from the workbench shell (the SSE endpoint itself stays for compatibility per research Decision 8) in `src/components/workbench/workbench.tsx` and related hooks
- [X] T046 [P] Security hardening: boot-time env validation in `server/collab/index.ts` (fail fast on missing port/secret/DB URL); confirm tokens and secrets never appear in server logs or client diagnostics
- [X] T047 [P] Performance pass: verify rAF cursor throttling under fast drags, ~2 s save debounce behavior, and that no server-only dependency (`@hocuspocus/server`) leaks into the client bundle
- [X] T048 Run the full `specs/003-workbench-collaboration/quickstart.md` validation (all SC scenarios + edge cases: mid-drag disconnect, long offline divergence, concurrent create+delete, double AI-generation trigger)
- [X] T049 Quality gate: `pnpm run lint`, `pnpm exec tsc --noEmit`, and full `pnpm test --run` green with the coverage floor not regressed (constitution gates)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–7)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 and can proceed in parallel once Phase 2 completes (different files except `workbench.tsx` integration tasks T024/T032 — sequence those two)
  - US3 depends on US1's session hook existing (extends `useCollabSession`); US4 also extends `useCollabSession` (sequence T037 → T041 or vice versa); US5 is verification-heavy and can run after US1
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories (MVP)
- **User Story 2 (P1)**: Can start after Foundational; integrates with US1 only at the workbench shell (T032 after T024)
- **User Story 3 (P2)**: Extends US1's `useCollabSession` — start after US1 checkpoint
- **User Story 4 (P2)**: Server/route enforcement already exists from Foundational; client denied-state extends US1's hook — start after US1 checkpoint
- **User Story 5 (P3)**: Verification of Foundational mapping/persistence plus US1 integration — start after US1 checkpoint

### Within Each User Story

- Tests MUST be written and FAIL before implementation (constitution Principle II)
- Models/types before services; services before hooks; hooks before view integration
- Core implementation before shell integration
- Story complete (checkpoint validated) before moving to next priority

### Parallel Opportunities

- T001 ∥ T002 (Setup)
- All [P] test tasks within a phase run in parallel (distinct files)
- Foundational: T003/T005/T007/T008/T010/T013/T015 (test writing) in parallel; implementations follow their tests
- US2's component work (T026–T030) is parallel to US1's hook work once Phase 2 completes (different files)
- T045 ∥ T046 ∥ T047 (Polish)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (must FAIL before implementation):
Task: "T017 Convergence tests in src/services/collab/convergence.test.ts"
Task: "T018 useCollabSession tests in src/components/workbench/hooks/useCollabSession.test.ts"
Task: "T019 Undo-origin tests in src/services/collab/undoOrigin.test.ts"
Task: "T020 Autosave-suspension tests in src/hooks/useAutoSaveScene.test.ts"

# Then implementation, in dependency order:
Task: "T021 useCollabSession hook" → "T022 origin-tagged mutations + UndoManager" ∥ "T023 autosave suspension" → "T024 workbench integration"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: two-session convergence per quickstart (SC-001/SC-002)
5. Deploy/demo if ready — this is the assessment's M1 milestone

### Incremental Delivery

1. Setup + Foundational → collaboration kernel ready
2. US1 → validate → **MVP (M1: online collaboration)**
3. US2 → validate → presence/cursors live
4. US3 → validate → **M2 complete (offline + merge)**
5. US4 → validate → access control proven end-to-end
6. US5 → validate → zero-migration adoption confirmed
7. Polish → full quickstart + quality gates

### Parallel Team Strategy

1. One person finishes Setup + Foundational (kernel is sequential per test→impl pairs)
2. Then: Developer A on US1 (hooks/services), Developer B on US2 tests + components (distinct files); merge at shell integration (T024 before T032)
3. US3/US4/US5 proceed sequentially after the US1 checkpoint (they share `useCollabSession.ts`)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to a specific user story for traceability
- Every logic-layer task names its test file first; verify tests fail before implementing (constitution Principle II)
- Commit after each task or logical group (auto-commit hooks are enabled for speckit commands)
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
