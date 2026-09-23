# Problem Definition: Atomic Node Undo

- **Slug**: atomic-node-undo
- **Created**: 2026-04-21T00:00:00Z
- **Inputs used**: intake.md and research.md, plus user input

## Problem Statement

OpenViz Workbench users who move nodes can experience Undo as a sequence of intermediate pointer positions instead of a reversal of the single movement they just completed. This makes recovering from an unwanted move slower and less predictable, and the absence of a clearly defined completed-action boundary also leaves uncertainty about what state should be persisted for future sessions or future multi-user collaborators.

## Affected Users & Stakeholders

- **Users**: OpenViz Workbench users — may need multiple Undo actions to reverse one node movement and may have difficulty predicting what Undo will restore (source: intake.md; research.md).
- **Users**: Users moving multiple or different node types — [NEEDS CLARIFICATION: the current evidence directly confirms only a sticky-note report].
- **Future collaborators**: People who may work on the same Workbench state in a future multi-user workflow — may need a durable, coherent representation of completed user actions; [NEEDS CLARIFICATION: collaboration workflow and requirements are not yet defined].
- **Stakeholders**: OpenViz product and engineering maintainers — own the Workbench interaction semantics, history behavior, and persistence reliability (source: repository history and current Workbench implementation).
- **Stakeholders**: [NEEDS CLARIFICATION: database/backend owners and support or UX stakeholders, if multi-user persistence is an immediate product requirement].

## Goals

- Make Undo behavior correspond to meaningful completed node-manipulation actions from the user’s perspective.
- Ensure a completed node manipulation has a consistent final state that can be recovered through Undo and Redo.
- Preserve predictable behavior for no-op interactions and other existing Workbench edits.
- Ensure the durable Workbench state reflects completed user actions rather than an unbounded stream of transient pointer positions, so the state remains suitable for future multi-user use.
- Reduce the chance that high-frequency pointer updates consume history capacity or create confusing persisted state (source: research.md).

## Non-Goals

- Defining or implementing a full multi-user collaboration product, presence model, conflict-resolution policy, or permissions system.
- Choosing a database technology, schema, transport protocol, synchronization algorithm, or API contract at this problem-definition stage.
- Establishing market demand or claiming that the issue affects all OpenViz users; current evidence is one direct report with no telemetry.
- Changing unrelated Studio canvas history semantics unless a later specification demonstrates a shared requirement.
- Defining text-editing history semantics beyond identifying them as a separate open question.
- Replacing the existing Workbench Undo/Redo concept with a different user-facing history model.

## Success Metrics

- A completed node movement is represented by one logical Undo step rather than multiple intermediate movement positions (baseline: current behavior can record repeated position updates; exact rate is unknown; source: research.md).
- After Undo, the affected node or node group is at the position/state from before the completed manipulation; after Redo, it is at the final completed state (baseline: not reliably satisfied for the reported drag; exact automated coverage is unknown).
- No-op node interactions do not increase the logical history count (baseline: unknown; must be measured by focused tests).
- The durable Workbench representation after a completed manipulation matches the final user-visible state and does not expose intermediate drag states to a later session (baseline: persistence behavior and database synchronization requirements are [NEEDS CLARIFICATION]).
- The behavior is consistent across the node-manipulation types included in the eventual specification (baseline: only sticky-note movement is directly evidenced; coverage for other types is unknown).
- History capacity is consumed by completed logical actions rather than by every high-frequency pointer update (baseline: Workbench history is capped at 100 snapshots and current position updates enter the update path; source: research.md).

## Cost of Inaction

The reported user experience remains in place: reversing one unwanted movement may require repeated Undo actions through intermediate positions. High-frequency movement updates can continue to consume the finite Workbench history window disproportionately. If persistence and future multi-user expectations remain undefined, later sessions or collaborators may lack a clear notion of which transient or completed node state should be durable, increasing the risk of inconsistent user expectations and rework when collaboration is introduced. The frequency and business impact of these costs are currently unknown.

## Open Questions

- [NEEDS CLARIFICATION: Is the desired one-action behavior limited to node movement, or does it include resize, arrow-handle movement, text editing, and other manipulations?]
- [NEEDS CLARIFICATION: Should a multi-selection movement be one action for the entire group?]
- [NEEDS CLARIFICATION: What is the required behavior for no-op, cancelled, interrupted, or pointer-lost manipulations?]
- [NEEDS CLARIFICATION: Which node types must be covered for the first release?]
- [NEEDS CLARIFICATION: What database or persistence boundary is intended by “sync to database”: completed actions, final snapshots, or another durable representation?]
- [NEEDS CLARIFICATION: Is database synchronization required now, or is the requirement only that the history semantics not block future multi-user support?]
- [NEEDS CLARIFICATION: What consistency, ordering, conflict, retry, and offline expectations will future multi-user Workbench users have?]
- [NEEDS CLARIFICATION: How should persistence failures be surfaced, retried, or reconciled with local Undo/Redo?]
- [NEEDS CLARIFICATION: What production frequency, user impact, and acceptance threshold should be used to prioritize this fix?]
