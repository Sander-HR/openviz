# Data Model: Real-Time Workbench Collaboration

## Shared Scene Document (live collaboration state)

The per-room CRDT document representing one project's main workbench scene. Transient in server memory while a room is active; persisted per the `scenes` table rules below.

| Field | Type | Required | Description |
|---|---|---:|---|
| `nodes` | map keyed by node ID → JSON-serializable node payload | yes | Every workbench node (position, dimensions, type, data). Keyed so concurrent operations on different nodes merge independently. |
| `connections` | map keyed by connection ID → JSON-serializable connection payload | yes | Edges between nodes (source/target handles, type, data). Keyed for the same independent-merge property. |

Validation rules:

- Node IDs and connection IDs are unique within the document; a key's latest converged value is authoritative in every session.
- A connection referencing a node ID absent from `nodes` is pruned during projection to the UI (orphan cleanup); pruning is derived state, not an extra write.
- Concurrent create/delete of the same node or connection ID resolves to one deterministic result identical across all sessions (spec edge case); no session may show a half-applied item.
- Awareness data (presence/cursors) is NOT part of this document — it rides on the separate awareness channel and is never persisted.

## Scenes Table Extension (durable state)

Existing `scenes` row gains one optional column; all other fields and semantics are unchanged.

| Field | Type | Required | Description |
|---|---|---:|---|
| `ydoc` | bytea, nullable | no | Encoded CRDT document snapshot written by the collab server on save. Present only after a scene has been saved collaboratively at least once. |

Save rules (single writer while a room is active — research Decision 9):

- Debounced write ~2 s after the last document change, plus an immediate write when the last client leaves the room.
- Each save extracts `data` JSON from the document, upserts it, bumps `version`, sets `updatedBy` to the last editor known in the room, and stores the encoded document in `ydoc`.
- Load order: if `ydoc` is present, decode it (lossless); otherwise seed the document from `data` JSON — this seeding path is the lazy import (spec US5). No bulk migration exists.
- Schema change ships as a generated Drizzle migration; the column is nullable so pre-existing rows are untouched until first collaborative save.

## Room Token (transient, not stored)

Short-lived credential scoping one WebSocket connection to one scene room.

| Field | Type | Required | Description |
|---|---|---:|---|
| `projectId` | UUID | yes | Project the token is scoped to. |
| `sceneId` | UUID | yes | Main scene of the project; equals the room name. |
| `userId` | UUID | yes | NextAuth user the token was issued for. |
| `issuedAt` / `expiresAt` | epoch ms | yes | ~5 minute TTL from issuance. |
| `signature` | HMAC/JWT signature | yes | Verifiable by the collab server with the shared secret. |

Validation rules:

- Issued only after a successful NextAuth session check AND workspace-membership check for the project (existing `canAccessProject` pattern).
- The collab server rejects tokens that are malformed, expired, out of scope for the requested room, or whose `userId` no longer has project membership (re-checked against the database at authentication time).

## Presence Record (transient awareness state)

Per-collaborator information relayed through the awareness channel; never persisted.

| Field | Type | Required | Description |
|---|---|---:|---|
| `user.id` | UUID | yes | Collaborator identity (matches room token user). |
| `user.name` | string | yes | Display name for the presence list. |
| `cursor` | `{ x, y }` or null | no | Canvas-space pointer position; null when idle or not over the canvas. Updated at most once per animation frame while moving. |

Lifecycle: appears when a client joins and publishes state; removed automatically on disconnect or provider teardown (spec FR-005). Presence list = current awareness states for the room.

## Offline Edit Queue (client-local, browser storage)

Per-scene CRDT document state held in IndexedDB via `y-indexeddb`.

| Field | Type | Required | Description |
|---|---|---:|---|
| key | scene ID | yes | One store entry per project main scene. |
| value | encoded Yjs document state + pending updates | yes | Survives disconnects and browser close; merged into the shared document on reconnect via standard state-vector sync. |

Validation rules:

- The queue is strictly client-local: it is never uploaded as a batch, never written to Postgres, and has no server-side counterpart.
- After a successful post-reconnect convergence, the local store continues to mirror the converged document (it remains the offline fallback for the next disconnect).

## Collab Session Lifecycle (state transitions)

```text
idle → connecting → connected ⇄ offline-queued → closed
                ↘ (auth rejected) → denied (no retry with same token; re-request token)
```

- `connecting`: token obtained, WebSocket opening.
- `connected`: document sync active; edits flow live both ways.
- `offline-queued`: transport lost; local edits continue and accumulate in the IndexedDB queue (spec US3).
- `denied`: server rejected authentication; session must request a fresh token before retrying.
- `closed`: user left the workbench or switched projects; provider torn down, awareness removed.
