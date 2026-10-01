# Research: Real-Time Collaborative React Flow Editor

## Decision 1: Keep Yjs and Hocuspocus as the collaboration layer

**Decision**: Use the installed Yjs 13.6, Hocuspocus provider/server 4.7, and y-indexeddb 9 stack already present in the repository.

**Rationale**: The repository already has provider lifecycle, room-token authentication, IndexedDB binding, awareness, server persistence, convergence tests, and a per-origin UndoManager. Replacing the stack would increase risk without addressing the actual defect: Zustand currently duplicates authoritative graph state.

**Alternatives considered**:

- A custom patch server: rejected because it duplicates CRDT conflict, reconnect, and state-vector behavior.
- REST mutation synchronization: rejected because it violates no-request-per-operation and offline merge requirements.
- A hosted collaboration service: rejected because the current project already has a self-hosted collaboration process and existing persistence/auth boundaries.

## Decision 2: Y.Doc is authoritative; React Flow is a projection

**Decision**: Store nodes and edges in keyed Yjs collections. React Flow receives a derived view. Zustand contains local UI and interaction state only.

**Rationale**: The PRD requires one authoritative collaborative graph. The current `collabStoreSync` is bidirectional and flushes store snapshots back into Y.Doc, which permits stale store state to compete with the document. A one-way document projection removes that ambiguity.

**Alternatives considered**:

- Keep Y.Doc ↔ Zustand synchronization: rejected because it creates two graph authorities and complicates offline/remote conflict behavior.
- Keep Zustand as the primary graph with Y.Doc as transport: rejected by the PRD and unsafe for reconnect merges.

## Decision 6: Local edits are explicit document commands (clarified 2026-10-01, FR-021)

**Decision**: Every local create/edit/move/delete is a typed operation applied directly to the Y.Doc under the local origin (`sceneDocCommands.ts`). React Flow renders only a projection of the document; the store-diff flush bridge (`collabStoreSync.ts`) is removed, not retained.

**Rationale**: Clarification Q1 chose explicit commands over keeping the store-diff flush. Explicit commands make per-entity field-level merges and one-gesture transactions deterministic, remove the dual-authority risk entirely, and satisfy FR-016/FR-021 without runtime assertions having to police a second write path.

**Alternatives considered**:

- Keep the store-diff flush with guard tests: rejected by clarification — it leaves Zustand as an authoritative working copy and keeps the migration gate (FR-002/FR-016) open.

## Decision 3: Use field-level Yjs mutations, not full-node replacement

**Decision**: Represent node/edge content with nested Y.Map/Y.Array values and apply changed paths inside one origin-tagged transaction per completed operation.

**Rationale**: The current mapping can create nested Y types, but the current sync bridge calls `nodesMap.set(node.id, fullValue)`, which replaces the entity value. Field-level mutation is required for concurrent edits to different properties and for non-destructive per-user history.

**Alternatives considered**:

- Full entity replacement: rejected because it magnifies conflicts and makes undo of a stale snapshot capable of clobbering newer fields.
- Application-level JSON patch log as the source of truth: rejected because Yjs already provides operation identity, merge, persistence, and transport.

## Decision 4: Per-origin Y.UndoManager for collaborative history

**Decision**: Keep the existing `createCollabUndoManager` and make it the Workbench collaborative history adapter. Group each completed gesture in one transaction with `captureTimeout: 0` and the local origin.

**Rationale**: Yjs tracks local authored items separately from remote updates, supports undo against the current document, and keeps history session-local. This directly satisfies the PRD without serializing undo stacks.

**Alternatives considered**:

- Whole-scene Zustand snapshots: rejected for collaborative mode because they can restore stale remote state and duplicate the document.
- Custom Immer patch history over the shared graph: useful for single-user local state, but insufficient alone for CRDT-aware concurrent undo.

## Decision 5: Awareness for ephemeral presence and cursors

**Decision**: Use the provider awareness channel initially, throttle cursor updates to 30–40/sec, and keep cursor rendering outside React Flow node state. Measure at 50 users before introducing a dedicated channel. Stale cleanup is immediate on clean disconnect (the awareness protocol clears peer state) plus a 30-second timeout for abnormal drops (clarified 2026-10-01, FR-013).

**Rationale**: The current provider and collaboration slice already handle awareness identity, cursors, locks, and cleanup. Awareness is not persisted in the Y.Doc and is appropriate for ephemeral state.

**Alternatives considered**:

- Persist cursors in the shared document: rejected because cursor history must not be durable.
- Dedicated cursor WebSocket immediately: deferred until measurements show awareness fan-out cannot meet the target.

## Decision 7: Conflict, reconnection, and degradation semantics (clarified 2026-10-01)

**Decision**: Same-field concurrent edits resolve last-update-wins by Yjs update order (no extra metadata or clocks stored in the document). Reconnection merges via symmetric state-vector reconciliation — both sides' missing updates are applied and neither replica is discarded. The "unacceptable degradation" threshold for 50 collaborators is interaction latency (local edit → visible render) p95 <100 ms with ≥30 fps sustained during concurrent cursor traffic (SC-007).

**Rationale**: Clarifications Q2–Q5 fixed these previously open semantics. LWW is Yjs's native scalar behavior and needs no document schema additions; symmetric reconciliation is what FR-011/FR-020/SC-006 require for zero-loss reconnect; the quantified threshold makes Phase 4 pass/fail testable.

**Alternatives considered**:

- User-id tie-break for same-field conflicts: rejected — timing-based LWW is simpler, native to Yjs, and deterministic once updates are exchanged.
- Server-wins or local-wins reconnect merge: rejected — both discard one side's confirmed edits, violating SC-006 zero-loss.

## Decision 8: Preserve persisted collection names and share only the scene name

**Decision**: Keep Y.Doc root maps named `nodes` and `connections`; treat `connections` entries as React Flow edges. Add `metadata.name` as the one shared scene-level field. Mirror it to the existing `scenes.name` column and hydrate legacy Y.Docs that lack it from that row.

**Rationale**: `sceneDocMapping.ts`, `SceneDataJson`, and server persistence already use `connections`, while the database already has a scene name. Keeping those shapes avoids renaming persisted data or adding a migration. Server ownership, main-scene status, version, and audit timestamps are not collaborative fields.

**Alternatives considered**:

- Rename the Y.Doc map to `edges`: rejected because it diverges from the persisted `connections` shape and adds conversion/migration risk.
- Synchronize all scene-row metadata: rejected because authorization and lifecycle fields are server-managed, not collaborative user content.
- Omit scene name: rejected by clarified FR-002 scope.

## Decision 9: Enforce the 50-peer room cap in the application server

**Decision**: Maintain an authenticated per-document reservation keyed by Hocuspocus `socketId` and `documentName`; reserve only after token and membership verification, reject a new admission once 50 peers are reserved, and release on `onDisconnect`. Add tests for cap, release, reconnect, and failed-admission cleanup. Use an explicit Hocuspocus server context type `{ userId: string }` rather than its default `any`.

**Rationale**: Hocuspocus documents pre-authentication buffer limits, but its server configuration does not provide a per-document collaborator cap. Its authentication and disconnect payloads expose the document name, socket ID, and authenticated context, allowing the existing standalone process to enforce the product limit before synchronization. Admission remains fail-closed. An in-memory reservation is valid for the current single-process deployment; horizontal replicas would require shared coordination.

**Alternatives considered**:

- Treat 50 only as a benchmark target: rejected because FR-018 and T001 require bounded room admission.
- Add an external coordination service: deferred; horizontal collaboration-server scaling is outside this feature's stated scope.

## Decision 10: Use one repeatable 50-client performance profile

**Decision**: Benchmark 50 peers publishing 30–40 cursor updates/sec each, while one editor submits one graph operation/sec. Measure document sync p95, cursor p95, local edit-to-visible-render p95, and sustained frame rate under that same profile.

**Rationale**: The clarified SC-003/004/007 workload makes these measurements comparable and exercises cursor fan-out without inventing an unrequested 50-writes/sec product target.

**Alternatives considered**:

- Cursor-only benchmark: rejected because it cannot validate document-sync and local-edit latency.
- One graph operation/sec from every peer: rejected as a substantially heavier workload than the clarified target.

## Documentation and repository evidence

- The current code uses Y.Doc maps `nodes` and `connections`, JSON node `x`/`y`, and persists the encoded document plus projected JSON in `server/collab/persistence.ts` and `src/services/collab/sceneDocMapping.ts`.
- Yjs documents state-vector reconciliation as exchanging each side's state vector and applying each side's missing update; see [Document Updates](https://docs.yjs.dev/api/document-updates).
- Yjs UndoManager supports tracked transaction origins and explicit capture boundaries; see [Y.UndoManager](https://docs.yjs.dev/api/undo-manager).
- y-indexeddb emits `synced` after local content has loaded, including when the store is empty; see [y-indexeddb API](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb).
- Hocuspocus supports rejecting access in `onAuthenticate` and provides a disconnect lifecycle hook; explicit generic context types avoid its default `any`; see [Server Hooks](https://tiptap.dev/docs/hocuspocus/server/hooks) and [Server Configuration](https://tiptap.dev/docs/hocuspocus/server/configuration).
- Hocuspocus server configuration lists unauthenticated buffer limits but no per-document client cap; see [Server Configuration](https://tiptap.dev/docs/hocuspocus/server/configuration).
- Installed versions are Yjs 13.6.32, Hocuspocus 4.7.0, y-indexeddb 9.0.12, and React Flow 12.10.0 in `package.json`. Verify any version-sensitive API against installed package typings during implementation.
