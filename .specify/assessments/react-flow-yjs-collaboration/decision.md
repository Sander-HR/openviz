# Decision: Real-Time Yjs Collaboration for the Workbench

- **Slug**: react-flow-yjs-collaboration
- **Decided**: 2026-09-21T15:05:49Z
- **Verdict**: go
- **Artifacts reviewed**: intake.md ✓ | research.md ✓ | problem.md ✓ | concept.md ✓ (plus clarifications.md — all 12 open questions resolved by the requester)

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Real, concretely stated pain for a clear user group (serialized concurrent edits, `409` conflicts, no presence, no offline work); but only one stated request and no usage metrics — research flags demand as unobserved. |
| Evidence strength | adequate | Technical prior art is well-supported (Yjs/Hocuspocus ecosystem, React Flow collaborative pattern; high-confidence citations) and codebase constraints are documented; demand-side evidence is a single request, now reinforced by the requester's explicit answers to all 12 clarification questions. Overall research confidence was medium. |
| Value vs. inaction | adequate | Requester rates cost of inaction as nice-to-have (shipped SSE + locks + versioned writes mitigate most conflicts); value is reduced friction and lost-work risk for internal teams — real but non-blocking. |
| Feasibility / appetite | adequate | Credible phased option (C: M1 online collaboration, M2 offline merge) within medium–large appetite; stack-compatible (React/TS/Zustand/React Flow), no schema change beyond existing scene versioning, lazy import avoids migration risk. |
| Strategic fit | strong | This is the explicitly planned "follow-up CRDT phase" from `feature-product-plan.md` ("CRDT explicitly out of this phase"), aligns with the Miro-like workbench direction, and respects constitution constraints (typed state, effects/fetch in hooks, no `any`). |
| Risk posture | adequate | Major risks identified with credible mitigations: phasing M1→M2 bounds offline-merge risk; origin-based local undo avoids shared-history confusion; self-hosted Hocuspocus keeps auth on the existing membership boundary; lazy import defers migration. Residual unknowns (deployment topology, spec-002 undo integration) are carried forward to specification. |

## Verdict & Rationale

**go.** Every criterion rates `adequate` or better — no `weak` or `unknown` scores — and a shaped concept with a recommended option exists, satisfying the gate for handing off to specification. The decisive factors: (1) this is the pre-planned successor to the shipped near-real-time phase, so strategic alignment and architectural continuity are strong; (2) all 12 previously open product questions are now resolved by the requester, converting an assumption-driven idea into a bounded one (2–5 users, <100 nodes, per-project-scene rooms, Postgres as source of truth); (3) the two heaviest risks — offline-merge complexity and undo integration — are mitigated by phasing M1 (online collaboration + presence) before M2 (offline queue + merge), so value ships even if M2 needs re-scoping. The honest caveat: demand evidence remains a single stated request, which is why problem validity caps at `adequate` — the go is defensible for an internal-team enhancement, not as a bet on unvalidated external demand.

## If go — Handoff to `/speckit.specify`

- **Problem**: Internal team members cannot co-edit the same workbench scene concurrently without data-loss risk, and lack presence visibility and offline resilience.
- **Chosen approach**: Option C (phased) — Yjs document per project scene synced via self-hosted Hocuspocus with project-membership auth; M1 = shared nodes/edges + awareness presence/cursors + local-only undo (transaction origins) + Postgres snapshot persistence + lazy import on first collaborative open; M2 = client-side CRDT queue (y-indexeddb) for full offline editing with merge on reconnect.
- **In scope / out of scope**: In — concurrent graph editing with convergence, presence/cursors, local-only undo, offline merge (M2), lazy scene import. Out — shared viewport/selection/comments, external stakeholder invites, strict latency SLA, rooms >2–5 users or ≥1000 nodes, replacing Postgres scene JSON as source of truth, bulk migration.
- **Success metrics**: Zero lost edits across 2–5 concurrent clients on <100-node graphs; offline session fully merged after reconnect; presence and cursors visible to all collaborators.
- **Carried-forward open questions**: (1) Hocuspocus deployment topology (process/sidecar/service; dev vs. prod hosting); (2) exact spec-002 atomic-gesture-history ↔ Yjs UndoManager integration under local-only undo; (3) awareness cursor update rate and traffic validation at target scale.
