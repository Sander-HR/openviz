# Contract: Scene Persistence Under Collaboration

Covers how the shared document becomes durable state and how it interacts with the existing single-user autosave path.

## Single-Writer Rule (research Decision 9)

- **Room active** → the collab server is the ONLY writer for that scene's `scenes` row. The client's existing JSON-PATCH autosave (`useAutoSaveScene`) is suspended for that scene for the duration of the session.
- **No room active** → the existing autosave + versioned PATCH path behaves exactly as before (spec FR-012: single-user behavior unchanged).
- The optimistic-concurrency machinery (`expectedVersion`, `409` on stale writes) remains intact for the single-user path and any non-collab writers.

## Server Save Semantics (room active)

| Trigger | Action |
|---------|--------|
| Document changed, debounced ~2 s after last change | Extract scene JSON from the document → upsert `scenes.data`; bump `version`; set `updatedBy` to the last editor known in the room; store encoded document in `scenes.ydoc`; refresh `updatedAt`. |
| Last client leaves the room (or idle timeout) | Immediate final save with the same field updates, then discard the in-memory room. |

- Saves are idempotent upserts on the scene's primary key; a failed save is retried and logged server-side — it must never block live collaboration or roll back converged state (durability liveness: clients keep working; the next save re-attempts).
- `version` continues to monotonically increase per collaborative save, so any external single-user writer that PATCHes concurrently still receives `409` protection.

## Load / Lazy Import Semantics (research Decision 5)

On room load for a scene:

1. If `scenes.ydoc` is present → decode it into the shared document (lossless; preserves CRDT metadata).
2. Else if `scenes.data` JSON is present → seed the document from it. **This seeding is the lazy import** (spec US5): every saved node and connection must appear in the initial shared state (SC-007).
3. Else → start an empty document (new project scene).

- No bulk migration exists or is required; adoption happens per-scene on first collaborative open/save.
- Seeding maps scene JSON into the keyed document structure defined in [../data-model.md](../data-model.md); the mapping is a shared, unit-tested service (`sceneDocMapping`) used by both server (seed) and client projection paths where applicable.

## Consistency Guarantees

- After convergence and the next save, `scenes.data` equals the converged state visible to collaborators (spec FR-011).
- Reopening the project later (single-user or collaborative) loads the current saved state, never a stale snapshot (spec US5 scenario 3).
- The encoded `ydoc` column is always written together with the JSON on collaborative saves; readers that do not understand `ydoc` (existing tooling, admin inspection) continue to read `data` JSON.

## Testing Requirements (per constitution, test-first)

- Debounced save writes data + version bump + ydoc; room-close triggers an immediate final save.
- Load prefers `ydoc` over JSON when both exist; seeds from JSON when `ydoc` is absent (lazy import preserves 100% of nodes/connections).
- Client autosave suspension: with an active session, no PATCH is issued for the scene; after session close, the single-user path resumes.
- Save failure does not disturb live document state and is retried on the next save trigger.
