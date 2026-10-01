# Collaboration Contract

## Document ownership

Y.Doc is the authoritative source for collaborative nodes, edges, and shared metadata. React Flow renders a projection of Y.Doc. Zustand is not an authoritative graph store.

## Local operation contract

Every local graph command must:

1. validate the current UI interaction and permissions;
2. mutate the Y.Doc in one transaction using the local origin — as an explicit document command (FR-021); no store-diff flush or full-scene write-back is permitted;
3. update React Flow through the document observer/projection;
4. become one local UndoManager stack item when it is a completed gesture.

Same-field concurrent edits resolve last-update-wins by Yjs update order; no conflict metadata is stored in the document.

Intermediate pointer positions may update the local Y.Doc during an active gesture only if the transaction capture policy groups them into one history item; historical pointer events must never be queued for reconnect replay.

## Undo/Redo contract

Each client has its own in-memory Y.UndoManager. It tracks only the client’s origin. Undo and Redo operate on the current Y.Doc and do not transmit an undo command or persist the stack. Remote transactions remain outside the local history.

## Awareness contract

Awareness carries ephemeral user identity, color, connection status, and cursor world coordinates. Cursor updates are throttled to approximately 30–40 Hz. Stale entries are removed immediately on clean disconnect and after a 30-second timeout for abnormal drops (FR-013). Awareness is not included in document persistence, graph history, or server version history.

## Connection contract

Connection states are Connected, Reconnecting, and Offline. Reconnection authenticates and authorizes before room admission, exchanges missing Yjs updates via symmetric state-vector reconciliation (both sides' missing updates applied; neither replica discarded — FR-011), merges local and remote state, and republishes current awareness. Unauthorized sessions receive no document or awareness data.

## Performance contract

Acceptance workload: 50 collaborators per document, 30–40 cursor updates/sec/user, p95 document synchronization below 200 ms, p95 cursor latency below 150 ms, interaction latency (local edit → visible render) p95 below 100 ms with ≥30 fps sustained during concurrent cursor traffic (the SC-007 "unacceptable degradation" threshold), and no full React Flow rerender for a cursor-only update.
