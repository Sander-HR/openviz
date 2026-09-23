# Concept: Yjs Collaboration for the React Flow Workbench

- **Slug**: react-flow-yjs-collaboration
- **Created**: 2026-09-21T15:05:49Z
- **Recommended option**: Option C — Full collaborative workbench with offline merge (phased)

## Options

### Option A — Status quo: keep SSE + soft locks + versioned writes
- **Sketch**: No new collaboration layer. Teammates continue to see near-real-time snapshot updates and lock indicators; concurrent edits are still serialized, conflicts surface as `409` refetch/merge/retry, and any disconnect ends editing until reload.
- **Appetite**: small (days — effectively zero build cost)
- **Trade-offs**: Wins: no new infrastructure to operate, no CRDT semantics to test, existing quality gate stays green. Sacrifices: no true concurrent editing, no cursors/presence beyond lock badges, no offline work — the three things the requester asked for.
- **Rabbit holes**: None new; but conflict friction accumulates as team usage grows.

### Option B — Shared graph + presence via self-hosted Hocuspocus (online-first)
- **Sketch**: One Yjs document per project scene, synced through a self-hosted Hocuspocus server that reuses existing project-membership checks to gate room joins. Nodes/edges live in the shared document; awareness carries who's-online and cursors. Postgres scene JSON stays the durable source of truth via periodic snapshots; local undo tracks only own edits (transaction origins). On reconnect, the client resyncs full document state — offline edits made while disconnected are not queued.
- **Appetite**: medium (weeks)
- **Trade-offs**: Wins: true concurrent editing with convergence, presence/cursors matching the React Flow example, minimal schema change, standard Yjs undo behavior. Sacrifices: a realtime server to run and secure; offline edits are lost on disconnect (fails the requester's explicit offline requirement).
- **Rabbit holes**: Interaction between the existing versioned-PATCH autosave path and Yjs snapshot writes (two writers to the same scene); controlled-update hardening in React Flow under remote changes.

### Option C — Full collaborative workbench with offline merge (phased)
- **Sketch**: Option B plus client-side CRDT persistence (e.g., y-indexeddb): while disconnected, edits accumulate locally against the last-known document state; on reconnect, Yjs merges them with server state and other peers' changes. Lazy import seeds each scene's Yjs document from stored scene JSON on first collaborative open. Shipped in two milestones: M1 = Option B behavior (online collaboration + presence), M2 = offline queue + merge.
- **Appetite**: medium–large (weeks for M1; weeks more for M2 — total months-scale upper bound)
- **Trade-offs**: Wins: meets every clarified requirement including the explicit full-offline+merge demand; phasing means M1 delivers value before M2's hardest testing is done. Sacrifices: largest test surface of the three (offline/merge paths, long-disconnect scenarios), and IndexedDB storage/lifecycle handling per browser.
- **Rabbit holes**: Conflicting offline operations on the same node (move vs. delete) after long disconnects; stale-scene rehydration when the server document has diverged far; undo stack integrity across a disconnect/reconnect cycle; snapshot cadence keeping Postgres fresh enough for the lazy-import path.

## Recommendation

**Option C, phased.** The requester explicitly chose full offline + merge and graph + presence/cursors scope, and the success metric (no data loss on concurrent edits) includes offline sessions — Option B fails that requirement by construction. Phasing M1 → M2 keeps risk bounded: if M2's offline-merge testing proves heavier than expected, M1 alone still ships a credible collaborative workbench and M2 can be re-scoped without abandoning the architecture. The medium–large appetite is acceptable because the cost of inaction is low (nice-to-have), so there is no schedule pressure that would force Option A.

## Out of Scope (for the recommended option)

- Shared viewport, selection sync, comments (v1 non-goal).
- External stakeholder access: invite links, expiring tokens, tenant isolation beyond project membership.
- Strict latency targets; rooms beyond 2–5 users or <100 nodes.
- Replacing Postgres scene JSON as durable source of truth; bulk migration of existing scenes.
- Multi-scene rooms (room = one project scene, keyed by project ID).

## Assumptions to Validate

- Hocuspocus can be deployed alongside the existing app stack with a membership-check auth hook that reuses current workspace/project access logic.
- y-indexeddb + Hocuspocus reconnect produces correct CRDT merges for graph operations (move/resize/delete/create) at <100 nodes, including conflicting offline operations.
- Yjs UndoManager origin tracking composes cleanly with spec-002's atomic gesture history under local-only undo (no double-undo, no lost gestures).
- Periodic snapshot cadence keeps Postgres scene JSON fresh enough that lazy import on first collaborative open stays simple and lossless.
- Awareness (cursor) traffic at 2–5 users / <100 nodes is negligible for the existing transport budget.
