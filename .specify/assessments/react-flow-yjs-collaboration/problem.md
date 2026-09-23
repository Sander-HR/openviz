# Problem Definition: Real-Time Co-Editing of the Workbench

- **Slug**: react-flow-yjs-collaboration
- **Created**: 2026-09-21T15:05:49Z
- **Inputs used**: intake.md ✓ | research.md ✓ | clarifications.md ✓ (all 12 open questions resolved by the requester)

## Problem Statement

Members of a small internal team working on the same OpenViz project cannot edit the workbench graph at the same time: concurrent edits are serialized through versioned scene snapshots (stale writes fail with `409`), teammates cannot see who else is in the scene or where they are working, and any network interruption ends editing until a full reload.

## Affected Users & Stakeholders

- **Users**: Internal team members (designers / AI-workflow builders) — they co-edit one project's workbench; today they must take turns, hand off projects, or screen-share to collaborate.
- **Stakeholders**: Product owner (requester of the idea) — owns the roadmap decision and the operational cost of a realtime server. End consumers of shared projects — benefit indirectly from fewer lost edits.

## Goals

- Two to five teammates edit the same project scene concurrently; all changes converge with **no data loss**.
- Collaborators see **presence** (who is online) and **cursors** in the shared scene, matching the behavior of the React Flow Collaborative example named in intake.
- Editing survives network interruptions: offline edits are queued locally and **merge on reconnect** without losing local work (explicit requester requirement).
- Existing single-user scenes keep working unchanged; collaboration activates with no bulk migration (lazy import on first collaborative open).

## Non-Goals

- Shared viewport, selection sync, or comments in v1.
- External stakeholder/client collaboration (invite links, tenant isolation beyond existing project membership).
- Strict latency SLA — latency is best-effort at 2–5 users / <100 nodes.
- Large rooms: 20+ concurrent users or 1000+ node graphs.
- Replacing the durable scene model: Postgres scene JSON remains the source of truth.

## Success Metrics

- **Zero lost edits** in concurrent-edit tests: 2–5 simulated clients editing a <100-node graph simultaneously; every local edit present in all replicas after convergence. (Baseline: none — today, concurrent writes risk `409` and overwrite-without-merge.)
- **Offline recovery**: after a simulated disconnect with local edits, reconnect yields full merge of offline changes on both sides. (Baseline: none — no offline capability exists.)
- **Presence visibility**: online collaborators and their cursors are visible to each other in-scene. (Baseline: lock/presence indicators only, via SSE snapshot polling.)

## Cost of Inaction

Requester assessment: **nice-to-have for now**. The shipped near-real-time phase (SSE stream + soft locks + versioned writes, `feature-product-plan.md`) already mitigates most conflicts; teams can serialize edits or hand off projects. No quantified adoption blocker or competitive loss is claimed — the value is reduced friction and lost-work risk for internal teams, not a gating capability.

## Open Questions

- [NEEDS CLARIFICATION: Hocuspocus deployment topology — where the realtime server runs relative to the existing app (same process, sidecar, separate service) and how it is hosted in dev vs. production.]
- [NEEDS CLARIFICATION: Exact integration of spec-002 atomic gesture history with Yjs UndoManager under local-only undo — which layer owns the undo stack and how gestures map to transaction origins.]
- [NEEDS CLARIFICATION: Awareness (cursor) update rate and its traffic impact at <100 nodes / 2–5 users — to be validated during specification, not a blocker.]
