# Data Model: Real-Time Collaborative React Flow Editor

## Shared Y.Doc

The document is the authoritative graph state.

```text
Y.Doc
├── nodes: Y.Map<Y.Map<unknown>>
├── edges: Y.Map<Y.Map<unknown>>
└── metadata: Y.Map<unknown>
```

### Node

- **Key**: stable node ID.
- **Fields**: type, position, dimensions, data, project content, and other existing Workbench node properties.
- **Mutation rule**: update changed nested fields, not the entire node value, except for explicit schema migrations.
- **Conflict rule**: same-field concurrent edits resolve last-update-wins by Yjs update order; no extra metadata or clocks are stored in the document.
- **Deletion rule**: delete the keyed node and remove or deterministically prune dangling edges in the document projection.

### Edge

- **Key**: stable edge ID.
- **Fields**: source/from, target/to, handles, type, and existing edge data.
- **Mutation rule**: update changed fields inside the edge map.
- **Conflict rule**: same-field concurrent edits resolve last-update-wins by Yjs update order.
- **Deletion rule**: delete the keyed edge or prune it when an endpoint no longer exists.

## Transaction

- **Origin**: local session origin identifying user and client/tab.
- **Scope**: one completed command or gesture.
- **Examples**: move selection, resize node, update node data, create/delete node, create/delete edge.
- **Write path (FR-021)**: every transaction is an explicit document command — a typed operation applied directly to the Y.Doc under the local origin. There is no store-diff flush; React Flow renders only a projection of the document.
- **History behavior**: local origin is tracked by that client’s Y.UndoManager; remote origins are not.
- **Offline behavior**: transaction applies to the local Y.Doc immediately and is later exchanged by state-vector synchronization.

## Reconnection Merge

- **Mechanism**: symmetric state-vector reconciliation (FR-011) — both sides exchange missing updates and apply them; neither the locally persisted replica nor the server document is discarded.
- **Guarantee**: confirmed local edits have zero loss in supported offline/reconnection scenarios (SC-006).
- **Exclusions**: historical pointer/cursor positions are never replayed; only completed document operations synchronize.

## Awareness State

- user ID, display name, avatar/color;
- connection/presence status;
- cursor world position;
- optional selection/lock projection if retained by the existing product behavior.

Awareness is ephemeral, excluded from Y.Doc persistence and Undo/Redo. Stale entries are removed immediately on clean disconnect (awareness protocol clears peer state) and after a 30-second timeout for abnormal drops (FR-013).

## Local UI State

Zustand/local React state may contain selected tool, panels, local selection/gesture coordination, connection status, pending UI state, and derived awareness projections. It must not be the authoritative source for collaborative nodes, edges, or shared metadata.

## Validation Rules

- Node and edge IDs are stable and unique within the document.
- Every document mutation has a typed transaction origin.
- Graph projection is deterministic: stable ordering and no dangling edges.
- Cursor and presence state is never serialized into the shared document.
- Undo/Redo stack items are not persisted to server or IndexedDB.
