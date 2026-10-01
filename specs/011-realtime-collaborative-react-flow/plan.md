# Implementation Plan: Real-Time Collaborative React Flow Editor

**Branch**: `011-realtime-collaborative-react-flow` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-realtime-collaborative-react-flow/spec.md`, plus the existing collaboration implementation and the prior `003-workbench-collaboration` design.

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Make the Y.Doc the sole authoritative source for collaborative nodes, edges, and shared metadata. Local edits are explicit document commands (FR-021): typed operations applied directly to the Y.Doc under the local origin — no store-diff flush. React Flow renders a one-way projection of the document; Zustand remains responsible for local UI, selection/interaction state, and connection status. Each client uses an origin-scoped Y.UndoManager for in-memory, per-user Undo/Redo. IndexedDB persists the local Y.Doc for offline work, while WebSocket synchronization exchanges Yjs updates via symmetric state-vector reconciliation after authentication and reconnection.

The existing collaboration stack already contains Yjs, Hocuspocus, y-indexeddb, awareness, room-token authorization, and an origin-scoped UndoManager. The main implementation work is removing the Y.Doc ↔ Zustand graph ownership loop (replacing `collabStoreSync.ts` with explicit commands + a projection adapter), applying field-level document mutations, preserving atomic gestures, and measuring the system against the 50-collaborator target and the SC-007 degradation threshold.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript strict mode, React 19, Next.js 16 app runtime, Node.js/tsx collaboration process

**Primary Dependencies**: Yjs 13.6, Hocuspocus provider/server 4.7, y-indexeddb 9, React Flow 12.10, Zustand 4.5, TanStack Query, Drizzle/Postgres, Vitest, React Testing Library

**Storage**: Current shared Y.Doc persisted server-side through the existing collaboration persistence path and locally through y-indexeddb; cursor/presence remain Awareness-only; no undo stack persistence

**Testing**: Vitest, React Testing Library, in-memory multi-document convergence tests, fake IndexedDB/provider tests, authorization tests, browser performance harness, `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run test:ci`, and `pnpm run build`

**Target Platform**: Modern browsers with WebSocket and IndexedDB; standalone Node.js collaboration server

**Project Type**: Next.js web application with a standalone Hocuspocus collaboration process

**Performance Goals**: 50 collaborators per document; p95 document sync <200 ms; p95 cursor latency <150 ms; interaction latency (local edit → visible render) p95 <100 ms with ≥30 fps sustained during concurrent cursor traffic (the defined "unacceptable degradation" threshold, SC-007); cursor publication ~30–40 updates/sec/user; remote cursors must not cause full React Flow rerenders; offline editing remains responsive

**Constraints**: No `any` or `@ts-ignore`; Y.Doc is authoritative for graph state; local edits are explicit document commands — no store-diff flush back into the document (FR-021); no REST request per graph operation; effects/fetch in hooks/services; Tailwind-only UI; named exports; existing project authorization; generated database migrations only; undo history in memory; no cursor/presence persistence

**Scale/Scope**: One project document per room, initial target 50 concurrent collaborators, existing Workbench node/edge types, temporary offline periods, no shared viewport, no long-term version history, no manual conflict-resolution UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| Type safety | PASS | Yjs/provider/server boundaries and document projections receive explicit types; no `any` escape hatches. |
| Test-first layered changes | PASS | Document mapping, sync, history, persistence, auth, and hooks require tests before implementation; UI behavior tests cover status, cursors, and graph projection. |
| State architecture | PASS after migration | Y.Doc owns collaborative graph state; Zustand stores UI/interaction/awareness projections only; token/network effects remain in hooks/services. |
| Styling and primitives | PASS | Existing Tailwind, Radix, and Framer Motion surfaces are reused. |
| Module boundaries and file limits | PASS | Sync, mapping, history, provider, awareness, server, and UI concerns remain split into focused modules under 300 lines. |
| Quality gates | PASS | Lint, typecheck, full Vitest coverage, build, and performance/convergence checks are required. |
| No second bundler entry point | JUSTIFIED | The existing standalone `server/collab` process is retained because WebSocket upgrades are not provided by the App Router route surface. |

**Gate condition**: Do not implement the new architecture while Zustand remains an authoritative second graph store in collaborative mode. Per FR-021, local edits must become explicit document commands and `collabStoreSync.ts` must be replaced by a one-way Y.Doc → UI projection adapter (no store-diff flush) before claiming FR-002/FR-016/FR-021 complete.

## Project Structure

### Documentation (this feature)

```text
specs/011-realtime-collaborative-react-flow/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/collab/
├── index.ts                         # Hocuspocus bootstrap and limits
├── auth.ts                          # token validation and room authorization
└── persistence.ts                   # current Y.Doc persistence

src/types/collab.types.ts            # document, awareness, status, and contract types
src/services/collab/
├── sceneDocMapping.ts                # schema and Y.Map/Y.Array field mapping
├── sceneDocCommands.ts               # NEW: explicit document commands (FR-021) — typed create/edit/move/delete operations on the Y.Doc
├── collabStoreSync.ts                # REMOVE: replaced by sceneDocCommands + projection adapter (no store-diff flush)
├── collabProviderFactory.ts          # Hocuspocus + y-indexeddb lifecycle
├── undoOrigin.ts                     # per-user Y.UndoManager adapter
├── awareness.ts                      # cursor/presence throttling and projection
└── performanceTelemetry.ts           # sync/cursor/interaction-latency measurements for acceptance

src/components/workbench/hooks/
├── useCollabSession.ts               # auth, lifecycle, status, doc subscription
├── useCollabPresencePublisher.ts     # local awareness publication
└── useWorkbenchGraphProjection.ts   # NEW: Y.Doc → React Flow node/edge projection (one-way)

src/store/slices/workbenchCollaborationSlice.ts  # UI status/awareness only
src/store/slices/workbenchSlice.ts               # remove collaborative graph authority
src/components/workbench/                         # status, cursor, and graph views
specs/011-realtime-collaborative-react-flow/       # design and validation artifacts
```

**Structure Decision**: Retain the existing Next.js client and standalone collaboration server. The migration is architectural within the existing boundaries: Y.Doc owns collaborative graph state, React Flow consumes a projection, Zustand owns local UI/interaction state, and Awareness owns ephemeral presence/cursors. No new backend or client dependency is planned.

## Implementation Phases

### Phase 0: Establish document and history contracts

- Define the Y.Doc schema for keyed nodes, keyed edges, and shared metadata.
- Ensure nested node/edge fields are updated without replacing an entire entity for ordinary field edits.
- Define transaction origins, gesture capture boundaries, same-field CRDT semantics (last-update-wins by Yjs update order — no extra metadata or clocks in the document), and local undo/redo behavior.
- Add red tests for move-after-remote-move, undo/redo interleaving, field-level merge, no cursor persistence, and one-gesture capture.

**Validation**: in-memory Yjs tests pass and document state converges across at least three simulated clients.

### Phase 1: Make Y.Doc authoritative in the client

- Replace the bidirectional graph bridge (`collabStoreSync.ts`) with explicit document commands (FR-021): every create/edit/move/delete is a typed operation applied directly to the Y.Doc under the local origin — no store-diff flush back into the document.
- Add a one-way Y.Doc subscription/projection adapter (`useWorkbenchGraphProjection.ts`) that feeds React Flow nodes and edges from the current Y.Doc projection.
- Keep Zustand only for tools, selection/interaction state, connection status, lock/presence/cursor projections, and other local UI state.
- Preserve local drag ownership so external document updates do not interrupt an active gesture.
- Keep single-user behavior working through the same document adapter or an explicitly separate non-collaborative path with no duplicate authority.

**Validation**: create/edit/move/delete nodes and edges in one client; projection and React Flow behavior remain correct without Zustand graph writes acting as the source of truth.

### Phase 2: Integrate per-user history and offline persistence

- Bind each session to one origin-scoped Y.UndoManager with gesture transactions captured as one stack item.
- Route toolbar and keyboard Undo/Redo to that manager in collaborative mode.
- Keep history session/in-memory only; never persist the undo stack to server or IndexedDB.
- Verify y-indexeddb local document persistence, refresh recovery, reconnect merge via symmetric state-vector reconciliation (both sides' missing updates applied; neither replica discarded — FR-011), and no mouse-movement replay.

**Validation**: two clients make interleaved edits, disconnect one, edit/undo/redo offline, refresh, reconnect, and converge without remote edits being undone.

### Phase 3: Awareness, presence, authorization, and status

- Define typed awareness payloads for user identity, color, cursor world position, and connection presence.
- Throttle cursor publications to 30–40 updates/sec and isolate cursor rendering from graph state.
- Add stale cursor/presence cleanup (immediate on clean disconnect; 30-second timeout for abnormal drops — FR-013) and correct viewport transformation.
- Enforce token authentication and project/document authorization before room join and on reconnect.
- Expose Connected, Reconnecting, and Offline states without putting status into the shared document.

**Validation**: authorized/unauthorized join matrix, reconnect token refresh, cursor pan/zoom tests, stale cleanup tests, and awareness-only persistence checks.

### Phase 4: Scale and convergence verification

- Build a deterministic multi-client test harness for node/edge operations, same-field conflicts, offline edits, and per-user history.
- Add browser performance scenarios for 50 collaborators, 30–40 cursor updates/sec/user, document p95 sync, cursor p95 latency, interaction latency (local edit → visible render) p95, sustained frame rate, and React Flow render churn.
- Apply the measurable “unacceptable degradation” threshold defined in SC-007: interaction latency p95 <100 ms and ≥30 fps sustained during concurrent cursor traffic.
- Optimize only measured bottlenecks; do not move authoritative graph state back into Zustand.

**Validation**: all target metrics and convergence criteria pass under the documented workload.

### Phase 5: Persistence rollout and convergence

- Verify existing documents are adopted without data loss and current durable scene state remains available.
- Confirm server persistence stores current document state, not awareness or undo history.
- Run full lint, typecheck, test/coverage, build, authorization, offline, and browser checks.
- Document rollback behavior if the collaboration provider or local persistence cannot initialize.

**Validation**: quickstart scenarios pass and all quality gates are green.

## Risks and Mitigations

- **Dual graph authority remains accidentally**: per FR-021, local edits must be explicit document commands; add runtime/test assertions that collaborative graph mutations go through Y.Doc and prohibit any store-to-doc diff or full-scene flush (the current `collabStoreSync.ts` bridge is the migration target).
- **Whole-node replacement defeats field-level merge**: update nested Y.Map fields or use explicit path-level document operations; test concurrent edits to different fields.
- **Undo clobbers remote edits**: use origin-scoped Y.UndoManager transactions and test undo after remote same-node edits; never restore whole-scene snapshots in collaborative mode.
- **Awareness overwhelms rendering**: throttle publications, keep awareness state separate, memoize cursor rendering, and measure React Flow update counts.
- **Offline state diverges after refresh**: await IndexedDB readiness before treating a local doc as authoritative and rely on Yjs state-vector reconciliation on reconnect.
- **Authorization leakage during initial sync**: authenticate and authorize before room admission and document sync; test denied sessions receive no document or awareness state.
- **50-user target is unbounded**: the degradation threshold is now fixed by SC-007 (interaction latency p95 <100 ms, ≥30 fps sustained); define a repeatable workload in Phase 4 and tune only measured bottlenecks against it.

## Testing Strategy

- Document mapping: schema, nested field updates, deterministic ordering, malformed data, dangling edge pruning.
- History: per-origin undo/redo, gesture grouping, undo-after-remote-edit, redo-after-conflict, offline history, and no history persistence.
- Sync: multi-client convergence, same-field last-update-wins determinism, reconnect symmetric state-vector merge (both sides' updates applied), local/remote interleavings, no REST-per-operation.
- Client projection: Y.Doc changes update React Flow; UI state changes do not mutate shared graph unless an explicit document command is issued.
- Awareness: throttling, coordinate transforms, stale cleanup, 50-user fan-out, and render isolation.
- Security: token authentication, project membership, expired token, reconnect authorization, and denied-room non-disclosure.
- Gates: `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run test:ci`, `pnpm run build`, plus documented browser performance runs.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Standalone collaboration process | WebSocket room synchronization requires a server capable of upgrade handling and document fan-out outside the App Router route surface. | Reusing only REST route handlers cannot provide the required bidirectional realtime transport. |
