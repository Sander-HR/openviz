# Presence and Awareness Contract

## Payload

Each Hocuspocus awareness client may publish these ephemeral fields:

| Field | Shape | Purpose |
|---|---|---|
| `user` | `{ id: string, name?: string }` | Stable user identity for the active tab |
| `color` | `string` | Cursor/peer display color when provided by the UI |
| `cursor` | `{ x: number, y: number } \| null` | World-space pointer; `null` means no active pointer |
| `activeNodeIds` | `string[]` | Soft-lock/selection projection |
| `selectedAt` | `number` | Epoch milliseconds for the current lock-set acquisition |

The peer is keyed by the Yjs awareness client ID, so separate tabs are distinct collaborators for cursor rendering and local undo ownership. Connection status is derived from provider lifecycle; it is not persisted as graph data.

## Publication and projection

- Publish pointer positions in world coordinates after converting from screen coordinates.
- Throttle cursor changes to 30–40 updates per second per active user; clear cursor on pointer leave and session teardown.
- Keep awareness updates outside the Y.Doc and React Flow node/edge state. Cursor-only updates render only the cursor overlay and must not trigger a full graph rerender.
- Awareness content is not included in server document persistence, IndexedDB document state, or Undo/Redo.

## Cleanup

- A clean disconnect removes the peer state immediately through the awareness protocol/provider lifecycle.
- An abnormal drop expires the peer after 30 seconds without a refresh. Cleanup timers are keyed by client ID and are cancelled when fresh state arrives.
- On reconnect, a user republishes current identity, cursor, and active-node state; historical cursor positions are never replayed.
