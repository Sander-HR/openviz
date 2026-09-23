# Decision: Atomic Node Undo

- **Slug**: atomic-node-undo
- **Decided**: 2026-04-21T00:00:00Z
- **Verdict**: go
- **Artifacts reviewed**: intake.md | research.md | problem.md | concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | A direct user report identifies a concrete, reproducible Undo problem, and repository inspection confirms that each position update currently enters the Workbench history path. |
| Evidence strength | adequate | Evidence includes the user report, current implementation behavior, React Flow’s documented repeated position-change model, and existing history controls; breadth of user demand and production frequency remain unknown. |
| Value vs. inaction | adequate | Solving the issue would make one completed movement reversible in one logical step and reduce consumption of the finite history window; the scale of the impact is not yet measured. |
| Feasibility / appetite | strong | The recommended concept has a medium appetite and builds on an existing Workbench snapshot history and persistence workflow rather than requiring a full collaboration system. |
| Strategic fit | strong | The concept aligns with the repository constitution’s Zustand state architecture, Postgres/Drizzle persistence direction, test-first workflow, and future multi-user readiness without expanding into a full collaboration product. |
| Risk posture | adequate | Major risks—gesture boundaries, multi-selection, cancellation, persistence failure, and scope creep—are identified, but several require clarification during specification. |

## Verdict & Rationale

**Go.** The problem is sufficiently concrete and technically evidenced to justify specification, and Option A provides a bounded response to both the reported Undo behavior and the request for durable completed Workbench state. The evidence is adequate rather than broad: the handoff must preserve the open questions around gesture scope, persistence failure, and future collaboration semantics. This decision authorizes the next specification stage; it does not authorize implementation yet.

## If go — Handoff to `__SPECKIT_COMMAND_SPECIFY__`

- **Problem**: Workbench users can experience one node movement as many Undo steps through intermediate pointer positions, while the durable state boundary for completed manipulations is not clearly defined for future sessions or multi-user support.
- **Chosen approach**: Option A — Atomic gestures with durable final state.
- **In scope / out of scope**: Specify one logical history action per explicitly included completed node manipulation, correct Undo/Redo endpoints, no-op handling, and persistence of the completed final state. Exclude full multi-user editing, presence, identity, permissions, conflict resolution, offline collaboration, audit trails, database/schema/protocol selection, unrelated Studio history, and unapproved text-edit semantics.
- **Success metrics**: A completed movement produces one logical Undo step; Undo and Redo restore the exact before/final states; no-op gestures add no history; durable state matches the final visible state without intermediate drag states; included node-manipulation types behave consistently; history capacity is consumed by logical actions rather than pointer samples.
- **Carried-forward open questions**:
  - [NEEDS CLARIFICATION: Which node manipulations are included in the first release: movement only, resize, arrow handles, text edits, or others?]
  - [NEEDS CLARIFICATION: Should multi-selection movement be one atomic action?]
  - [NEEDS CLARIFICATION: What happens for no-op, cancelled, interrupted, or pointer-lost gestures?]
  - [NEEDS CLARIFICATION: Does “sync to database” mean completed final-state persistence now, or only compatibility with future multi-user support?]
  - [NEEDS CLARIFICATION: What consistency, ordering, conflict, retry, and offline expectations must future collaboration preserve?]
  - [NEEDS CLARIFICATION: How are persistence failures surfaced and reconciled with local Undo/Redo?]
  - [NEEDS CLARIFICATION: What acceptance threshold and production-impact evidence should be used?]
