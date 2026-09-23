# Contract: Presence & Cursor Awareness

## Payload Shape

Each connected client publishes one awareness state for the room:

```json
{
  "user": { "id": "<uuid>", "name": "<display name>" },
  "cursor": { "x": 412.5, "y": -88.0 },
  "activeNodeIds": ["node-1", "node-2"],
  "selectedAt": 1737000000000
}
```

| Field | Type | Required | Description |
|---|---|---:|---|
| `user.id` | UUID | yes | Collaborator identity; equals the room token's `userId`. Used to key the presence list and to exclude one's own cursor from the overlay. |
| `user.name` | string | yes | Display name shown in the presence indicator (from the authenticated user profile). |
| `cursor` | `{ x: number, y: number }` or null | no | Pointer position in **canvas (world) coordinates**, not screen pixels — so cursors stay correct under pan/zoom. `null` when the pointer is idle or outside the canvas. |
| `activeNodeIds` | string[] | no | Node ids this client currently holds a soft lock on: its selected nodes plus any node mid-gesture (drag/resize). Empty array when nothing is held. |
| `selectedAt` | epoch ms | no | When the current `activeNodeIds` set was acquired. Used for first-come-first-served lock conflicts; only changes when the id SET changes (not on transient position updates). |

## Update Rules

- Cursor updates are throttled to at most one per animation frame (~16 ms) while the pointer moves; no periodic emission when idle (research Decision 7).
- Source of truth for local cursor position: the workbench's existing pointer-tracking hook; no new tracking mechanism is introduced.
- `user` fields are published once on join and updated only if identity data changes (it does not, in v1).

## Derivation & Lifecycle

- **Presence list** = current awareness states of the room, excluding the local client for "others" views. Rendered by `PresenceIndicator`.
- **Cursor overlay** = remote cursor entries with non-null `cursor`, rendered by `CursorOverlay` (one indicator per REMOTE CLIENT — two tabs of one user show two cursors — labeled with display name).
- **Node locks** = union of remote clients' `activeNodeIds`. Per node, the lock holder is the client with the earliest `selectedAt`; ties break to the lower awareness client id. The derivation is a pure function of the awareness snapshot, so every session converges on the same holder (spec FR-016).
- **Lock enforcement** (spec FR-015): a node locked by another client is not selectable or draggable in this session (per-node React Flow `selectable`/`draggable = false`, plus store/handler guards for resize, double-click editing, data changes, and deletion). A session that loses a conflict automatically releases its local selection of the contested node. Locks only restrict edits initiated by non-holders; the holder keeps full control.
- A presence entry, its cursor, and its locks disappear automatically when the peer disconnects or tears down its provider (awareness removal) — spec FR-005/FR-016. No manual "leave" action is required; closing the workbench or switching projects tears down the session.
- Visibility timing: a newly joined collaborator's presence must be visible to existing members within 2 seconds (SC-003).

## Boundaries

- Awareness is transient and never persisted (not part of the shared document, not written to `scenes`).
- v1 carries identity + cursor + soft locks. Viewport position and comments remain out of scope (spec FR-013); visual selection-state sharing is out of scope — only the lock implication of selection is published.
- Lock badges are now ENFORCING, not advisory (requester decision 2025-07; supersedes the prior near-real-time assumption): a remote-held lock blocks local editing of that item.

## Testing Requirements (per constitution, test-first)

- Published cursor state is visible to a second in-memory client over the fake provider bus; own cursor is excluded from the remote list.
- rAF throttling: simulated high-frequency pointer events produce at most one awareness update per frame.
- Peer teardown removes its presence entry, cursor, and locks from the other client's derived state.
- Canvas-coordinate mapping: a cursor published under pan/zoom renders at the same world position in another session's viewport.
- Lock derivation: earliest `selectedAt` wins; equal timestamps break to the lower client id; the local client's own `activeNodeIds` never lock nodes for itself.
- Enforcement: locked nodes map to `selectable=false`/`draggable=false`; deletion, resize, double-click, and data-change entry points ignore remotely locked ids.
