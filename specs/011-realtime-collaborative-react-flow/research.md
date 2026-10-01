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

## Documentation lookup note

Context7 lookup for Yjs, Hocuspocus, and y-indexeddb was attempted but the environment could not resolve the Context7 host. This plan therefore relies on the installed package versions, existing repository implementation, and existing tests; API changes must be verified against installed package typings before implementation.
