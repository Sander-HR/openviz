# Clarifications: React Flow Yjs Collaboration

- **Slug**: react-flow-yjs-collaboration
- **Created**: 2026-07-15
- **Purpose**: Resolves `[NEEDS CLARIFICATION]` items carried from intake.md and research.md, gathered directly from the requester. Answers feed `define` (problem-side) and `shape` (solution-side).

## Problem-Side (for `define`)

| # | Question | Answer |
|---|----------|--------|
| 1 | Who needs this collaboration, and what demand does it serve? | **Internal team co-editing.** Small design/AI teams editing the same project's workbench concurrently; primary users are the owner and their team. (Resolves: "Which users or customers require collaboration…") |
| 2 | Minimum first-release scope? | **Graph + presence/cursors.** Shared nodes and edges plus who's-online and cursor indicators — matches the behavior of the React Flow Collaborative example named in intake. No shared viewport, selection sync, or comments in v1. (Resolves: "minimum first-release scope", "which React Flow state is shared", "what presence information") |
| 3 | Success bar? | **No data loss on concurrent edits.** Two or more users edit simultaneously; changes converge and no one's work is silently overwritten. Latency is best-effort, not a hard target. (Resolves: "measurable latency, convergence, reliability, and data-loss targets") |
| 4 | Cost of inaction? | **Nice-to-have for now.** The shipped near-real-time SSE + soft locks + versioned writes (feature-product-plan.md) already mitigate most conflicts; live CRDT collaboration is an enhancement, not a blocker. (Resolves: cost-of-doing-nothing gap) |

## Solution-Side (for `shape`)

| # | Question | Answer |
|---|----------|--------|
| 5 | Yjs provider/server model? | **Self-hosted Hocuspocus.** Node.js Yjs server with auth hooks, awareness (presence/cursors), and persistence plugins; runs alongside the app. (Resolves: "which Yjs synchronization provider and server deployment model") |
| 6 | Durable source of truth for scenes? | **Keep Postgres scene JSON.** Yjs is the live sync layer only; periodic snapshots persist as existing scene JSON, reusing the shipped autosave/versioning path. Minimal schema change. (Resolves: "should live state be persisted as Yjs updates, periodic snapshots, or the existing scene JSON?", "should the existing database remain the durable source") |
| 7 | Undo semantics when remote changes arrive? | **Local-only undo.** Track only own edits via Yjs transaction origins; remote changes are never undone (standard Yjs UndoManager behavior). (Resolves: "how should local Undo/Redo behave when remote changes arrive?") |
| 8 | Offline editing required in v1? | **Yes — full offline + merge.** Edits queue locally (CRDT) and sync on reconnect. Requester explicitly chose this over the lighter options; adds testing burden and interacts with #6 (client-side local persistence, e.g. y-indexeddb, is implied for catch-up). (Resolves: "is offline editing required, and what reconnect guarantees are expected?")
| 9 | Room authentication/authorization? | **Reuse project membership.** Hocuspocus verifies existing workspace/project access before room join — same trust boundary as today's API routes. (Resolves: "how are users authenticated and authorized for a room?") |
| 10 | Scale targets (users per room, graph size)? | **2–5 users, <100 nodes.** Small team sessions with modest update rates; keeps perf engineering light. (Resolves: "how many collaborators and how large a graph must a room support?", consistency/latency level) |
| 11 | Migration of existing scenes? | **Lazy import on first open.** First collaborative open seeds the Yjs document from stored scene JSON; no bulk migration. (Resolves: "migration/initialization behavior for existing OpenViz scenes") |
| 12 | Room identity/scope and lifecycle? | **Per project scene, keyed by project ID** — matches the existing `/api/projects/:id/scenes/stream` endpoint and scene persistence model. (Resolves: "collaboration room/document identity and lifecycle") |

## Status

All 12 open questions from intake.md / research.md are resolved. Ready for `define` → `shape` → `decide`.
