# Concept: Atomic Node Undo

- **Slug**: atomic-node-undo
- **Created**: 2026-04-21T00:00:00Z
- **Recommended option**: Option A — Atomic gestures with durable final state

## Options

### Option A — Atomic gestures with durable final state

- **Sketch**: Workbench users experience each completed node manipulation as one logical history action: a movement, included group movement, or other explicitly included manipulation can be undone and redone as a whole rather than traversed point by point. The completed state is also treated as the durable state for the current project, so later sessions see the result of the completed action rather than transient pointer positions. The concept deliberately prepares a coherent persistence boundary without attempting to define the full future collaboration product.
- **Appetite**: medium (weeks)
- **Trade-offs**: Best balance between the reported user pain, history-capacity concerns, and the request for database durability. It limits risk by treating future multi-user support as a compatibility goal rather than implementing collaboration now. It still requires agreement about which manipulation types and cancellation cases count as completed actions, and database failure behavior may remain unresolved.
- **Rabbit holes**: Expanding from movement to every editable node property; handling browser-lost-pointer events; reconciling local Undo/Redo with persistence failure; assuming that a final durable state is sufficient for future multi-user conflict handling; changing text-edit semantics unintentionally.

### Option B — Collaboration-ready action history

- **Sketch**: Treat completed Workbench actions as durable, ordered user changes suitable for later sessions and future simultaneous collaborators. The user-facing result includes atomic Undo/Redo for node manipulations, while the broader concept also establishes expectations for ordering, retries, concurrent changes, and recovery so that another user can observe a coherent Workbench state.
- **Appetite**: large (months)
- **Trade-offs**: Provides the strongest long-term foundation for multi-user Workbench support and makes persistence requirements explicit early. It carries substantially more scope and depends on unresolved product decisions about conflicts, permissions, offline behavior, identity, and failure recovery. The evidence currently supports the local Undo problem but not the need for a full collaboration foundation now.
- **Rabbit holes**: Conflict resolution; presence and permissions; offline edits; version migration; reconnect/retry semantics; audit history; ordering guarantees; database and transport choices; attempting to solve all future collaboration needs before validating the local interaction fix.

### Option C — Defer and preserve current behavior

- **Sketch**: Do not change node history or database behavior until more evidence is available about frequency, affected users, node types, and future collaboration requirements. Continue using the current Workbench behavior and document the issue as an open usability concern.
- **Appetite**: small (days)
- **Trade-offs**: Avoids implementation and regression risk while demand is supported by only one direct report. It does not improve the reported Undo experience, continues allowing high-frequency updates to consume the finite history window, and leaves the persistence boundary undefined for future collaboration.
- **Rabbit holes**: Spending time collecting evidence without a clear decision date; additional manual workarounds; allowing the current behavior to become relied upon; postponing persistence decisions until they are more expensive to change.

## Recommendation

Recommend **Option A — Atomic gestures with durable final state**. It directly addresses the observed failure mode and the success criteria around one logical Undo step, correct Undo/Redo endpoints, no-op behavior, and reduced history consumption. It also acknowledges the database requirement at the level of durable completed state without taking on the unsupported and currently undefined scope of a complete multi-user collaboration system. Option B should be reconsidered only after collaboration requirements and evidence are clarified; Option C does not clear the bar because it leaves the reported user problem and the persistence ambiguity unchanged.

## Out of Scope (for the recommended option)

- Full multi-user editing, presence, identity, permissions, conflict resolution, offline collaboration, and audit trails.
- Selecting a database schema, synchronization protocol, API shape, or specific implementation architecture.
- Defining a complete action model for every possible future Workbench edit.
- Changing Studio canvas history unless separately justified.
- Automatically changing text typing into one history action without explicit product confirmation.
- Treating interrupted or failed persistence as solved before its required user-visible behavior is defined.

## Assumptions to Validate

- Users expect a completed node movement to undo directly to its pre-movement state and redo directly to its final state.
- Multi-selection movement, if supported, should be perceived as one user action.
- Intermediate pointer positions are transient and should not be durable project state.
- The current project persistence path can represent the final Workbench state without requiring a new collaboration system immediately.
- Future multi-user support benefits from coherent completed-state boundaries, but does not yet require a full collaboration implementation in this effort.
- The scope of included manipulations can be agreed before specification, especially resize, arrow handles, text edits, and cancellation.
- Persistence failures can be given an acceptable behavior without blocking the local Undo/Redo correction.
- The user impact is meaningful enough to justify a medium-sized change despite the absence of telemetry.
