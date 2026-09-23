# Contract: Collaboration Transport (WebSocket)

## Endpoint

- `ws(s)://<host>:<collab-port>/` — Hocuspocus server (standalone process, research Decision 2).
- Room name: the project's main **scene ID** (one room per project scene; spec assumption + clarification #12).
- Host/port exposed to the client via existing app configuration (env-driven), never hardcoded in components.

## Authentication Handshake

1. Client obtains a room token from `POST /api/projects/:id/scenes/collab-token` (see [room-token-api.md](./room-token-api.md)).
2. Client opens the WebSocket and presents the token during Hocuspocus authentication (first message / connection context).
3. Server `onAuthenticate`: verifies signature, scope (`sceneId` matches requested room), expiry, then re-checks project membership in Postgres for the token's `userId`.
4. Outcomes:
   - **Admitted** → document sync begins; client receives current document state (or seeded/lazy-imported state per [scene-persistence-collab.md](./scene-persistence-collab.md)).
   - **Rejected** → connection closed with an authentication error code; client enters `denied` state and must request a fresh token before retrying. No anonymous or partial access is ever granted (spec FR-009, SC-006).

## Sync Semantics (Yjs protocol over the connection)

- Standard Yjs state-vector synchronization on join: each side exchanges only missing updates; convergence is guaranteed by CRDT semantics with no server-side ordering service.
- Local edits are applied as single transactions tagged with the editor's origin (research Decision 6); remote transactions carry their own origins and are never tracked into local undo stacks.
- Document size expectation at target scale: tens of KB (<100 nodes). No chunking/compression requirements in v1.

## Awareness Channel (presence/cursors)

- Relayed by the server between room members; payload shape and throttling defined in [presence-awareness.md](./presence-awareness.md).
- Awareness is transient: it is dropped when a client leaves and never persisted.

## Disconnect / Reconnect Behavior

- **Client-side disconnect** (network loss, tab sleep): local editing continues against the locally bound document; edits accumulate in the IndexedDB offline queue (research Decision 4). The session state machine moves to `offline-queued`.
- **Reconnect**: client re-authenticates with a valid (or freshly requested) token and performs full state-vector sync; both sides converge with no data loss from either side (spec FR-007, SC-004), including edits made before an app close.
- **Server-side restart**: rooms are in-memory; on next client join the document is loaded from `scenes.ydoc` (or seeded from JSON) — no update log exists or is required (research Decision 5).
- **Last client leaves**: server flushes a final save and discards the in-memory room after its idle timeout.

## Compatibility Notes

- The existing SSE endpoint (`GET /api/projects/[id]/scenes/stream`) is untouched by this contract and remains available for non-collab consumers (research Decision 8). The workbench itself consumes only this WebSocket transport for collaboration state.
- Multi-instance server fan-out is out of scope: v1 assumes a single collab process per deployment.
