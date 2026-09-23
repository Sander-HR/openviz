# Feature Specification: Atomic Node Gesture History

**Feature Branch**: `002-atomic-node-undo`

**Created**: 2026-04-21

**Status**: Implemented

**Input**: User description: "Implement Option A: atomic Workbench gestures with durable final state. Each completed node movement, included group movement, resize, and arrow-handle manipulation is one Undo/Redo action; no-op gestures add no history; persist completed Workbench state for future multi-user support without implementing full collaboration."

## Clarifications

### Session 2026-04-21

- Q: Should this feature persist each completed Workbench gesture’s final state to the database now, while leaving live multi-user collaboration for a later feature? → A: Yes. Persist the final state after each completed gesture, without persisting intermediate pointer positions or implementing live collaboration.
- Q: When a node gesture is interrupted before a normal release, should the node return to its pre-gesture state without creating history or a database write? → A: Yes. Revert the interrupted gesture and create neither a history action nor a database write.
- Q: If the database cannot save a completed gesture, should the local final state remain visible while the user is told it is unsaved and can retry? → A: Yes. Keep the final state locally; expose the persistence failure through console diagnostics or the TanStack Query developer tools rather than adding a new production UI status.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move a node as one history action (Priority: P1)

A Workbench user selects a node, drags it through multiple intermediate positions, and releases it. The user expects Undo to return the node to its position before the gesture and Redo to restore the final released position.

**Why this priority**: This is the reported usability problem and the primary value of the feature.

**Independent Test**: Place a sticky note on the Workbench, drag it through at least three visibly different positions, release it, press Undo once, and verify that it returns directly to its original position; press Redo once and verify that it returns directly to its final position.

**Acceptance Scenarios**:

1. **Given** a selected node at position A, **When** the user drags it through intermediate positions and releases it at position B, **Then** the completed movement is represented by exactly one logical history action.
2. **Given** a completed movement from A to B, **When** the user selects Undo, **Then** the node is at A and no intermediate drag position is displayed as an undo state.
3. **Given** Undo restored the node to A, **When** the user selects Redo, **Then** the node is at B.
4. **Given** a node is clicked or selected without changing its position, **When** the interaction ends, **Then** no new history action is created.

---

### User Story 2 - Manipulate selected groups and supported node types consistently (Priority: P1)

A Workbench user moves multiple selected nodes together or manipulates supported node geometry. The user expects each completed manipulation to behave as one reversible action, regardless of which supported node type is involved.

**Why this priority**: Users should not need to learn different history rules for a sticky note, text node, media node, or other supported Workbench node.

**Independent Test**: Select two nodes and move them together, then separately resize a supported node and move an arrow handle through multiple points. Verify that each completed gesture is one Undo/Redo action and restores all affected state together.

**Acceptance Scenarios**:

1. **Given** multiple nodes are selected, **When** the user moves the group and releases it, **Then** Undo restores all affected nodes to their pre-gesture positions in one action.
2. **Given** a supported node is resized through multiple intermediate dimensions, **When** the resize ends, **Then** Undo restores the original dimensions and position in one action and Redo restores the final dimensions and position.
3. **Given** an arrow handle is moved through multiple intermediate points, **When** the handle manipulation ends, **Then** Undo restores the complete original arrow geometry in one action and Redo restores the complete final geometry.
4. **Given** a supported manipulation ends without changing the node state, **When** the interaction ends, **Then** no new history action is created.

---

### User Story 3 - Preserve completed state for later sessions (Priority: P2)

A Workbench user completes a node manipulation and later reloads or reopens the project. The user expects the saved Workbench to contain the final completed state, not transient intermediate pointer positions. This creates a coherent durable state boundary for future multi-user Workbench support without introducing live multi-user editing in this feature.

**Why this priority**: Durable final state prevents the local interaction fix from diverging from the state seen by a later session and establishes a predictable foundation for future collaboration.

**Independent Test**: Complete a node movement, reload or reopen the project, and verify that the node is at its final released position and that no intermediate drag position appears as the durable project state.

**Acceptance Scenarios**:

1. **Given** a node manipulation completes at a final state, **When** the project is persisted and reopened, **Then** the reopened Workbench reflects that final state.
2. **Given** a manipulation is still in progress, **When** intermediate pointer updates occur, **Then** they do not become separate durable completed actions.
3. **Given** a new completed edit occurs after Undo, **When** the project is persisted, **Then** the durable state reflects the new edit and the abandoned Redo path is not treated as the current completed state.
4. **Given** the persistence operation cannot complete, **When** the user remains in the Workbench, **Then** the local final state remains visible, is distinguishable from confirmed durable state through development diagnostics, and can be retried without silently discarding the completed interaction.

### Edge Cases

- A click, selection change, or drag that ends at the original state creates no history action.
- A multi-selection movement restores every affected node together, including nodes that move only because they are part of the selection.
- A gesture interrupted before normal release returns the visible state to the pre-gesture state and creates neither a history action nor a database write.
- Pointer release outside the node or canvas must not leave the history system in an unfinished gesture state.
- Undo or Redo invoked while a manipulation is active must not expose an inconsistent half-gesture state.
- A new completed edit after Undo clears the redo path according to existing history expectations.
- Project switching, reload, or unmount during an active gesture must not write an incomplete gesture as a completed durable action.
- Existing node creation, deletion, duplication, reorder, connection, and freehand actions remain individually undoable and are not merged with an unrelated node manipulation.
- Text entry remains a separate editing interaction unless explicitly included by a future requirement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record each completed supported node movement as one logical history action, regardless of how many intermediate positions occur during the movement.
- **FR-002**: The system MUST restore the complete pre-movement state when the user undoes a supported node movement.
- **FR-003**: The system MUST restore the complete final state when the user redoes a supported node movement.
- **FR-004**: The system MUST record a multi-selection movement as one logical history action containing all affected nodes.
- **FR-005**: The system MUST apply the same one-action history behavior to supported node resizing gestures.
- **FR-006**: The system MUST apply the same one-action history behavior to supported arrow-handle geometry gestures.
- **FR-007**: The system MUST NOT create a history action for a completed supported gesture that leaves the relevant node state unchanged.
- **FR-008**: The system MUST prevent intermediate pointer positions from appearing as separate Undo or Redo states for a supported gesture.
- **FR-009**: The system MUST cancel an active gesture deterministically when the normal pointer-release path is interrupted, restoring the pre-gesture state without creating a history action or database write.
- **FR-010**: The system MUST keep existing independent Workbench actions—such as node creation, deletion, duplication, reorder, connection changes, and freehand edits—separately undoable.
- **FR-011**: The system MUST persist the final state to the database after each completed supported gesture for the current Workbench project.
- **FR-012**: The system MUST NOT represent intermediate pointer positions as separate completed durable actions or database writes.
- **FR-013**: The system MUST preserve the relationship between the user-visible final Workbench state and the state available after reopening the project.
- **FR-014**: The system MUST retain the existing distinction between Workbench history and unrelated Studio history.
- **FR-015**: The system MUST retain the local final state when persistence fails and MUST expose diagnostic failure information through console logging or the TanStack Query developer tools, without requiring a new production-facing error UI.
- **FR-016**: The system MUST leave full live multi-user editing, presence, identity, permissions, conflict resolution, offline collaboration, and audit history outside this feature.

### Key Entities *(include if data involved)*

- **Workbench gesture**: One user-completed manipulation of one node or a selected group, including its starting state, final state, affected nodes, and completion/cancellation outcome.
- **Workbench history action**: A user-recoverable before/after state transition used by Undo and Redo.
- **Completed Workbench state**: The final user-visible node and connection state recognized as durable for the current project after a completed action.
- **Supported node manipulation**: Movement, selected-group movement, resizing, or arrow-handle geometry editing included by the feature’s acceptance rules.
- **Persistence confirmation**: The product-visible state indicating whether the latest completed Workbench state has been successfully saved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of automated acceptance tests for supported movement gestures, one completed drag with at least three intermediate positions produces no more than one new logical history action.
- **SC-002**: In 100% of automated acceptance tests, one Undo after a completed supported gesture restores every affected node or geometry property to its exact pre-gesture state, and one Redo restores the exact final state.
- **SC-003**: In 100% of automated no-op gesture tests, clicking or completing a supported gesture without a state change adds zero history actions.
- **SC-004**: In 100% of persistence acceptance tests, each successfully completed supported gesture writes the final state to the database, and reopening the project shows that final released state with no intermediate pointer position.
- **SC-005**: During a manual review of the supported node types, each type follows the same one-action history rule for movement and the applicable resize or arrow-handle interactions.
- **SC-006**: Existing Workbench Undo/Redo acceptance tests for creation, deletion, connections, duplication, reorder, and freehand actions continue to pass without additional history steps caused by unrelated gestures.
- **SC-007**: In 100% of simulated persistence-failure acceptance tests, the local final state remains available, the failure is visible through the agreed development diagnostics, and the system does not silently claim that the state is durably saved.

## Assumptions

- The first release covers Workbench node movement, selected-group movement, resizing, and arrow-handle geometry editing; text typing is a separate interaction and is excluded unless later clarified.
- A gesture that ends without a state change is a no-op and does not create history.
- An interrupted gesture is reverted to its pre-gesture state and is not recorded as completed or persisted.
- Existing Workbench Undo/Redo controls and keyboard shortcuts remain the user-facing controls.
- The current project persistence capability can store the final Workbench state without implementing live multi-user editing in this feature.
- Successfully completed persistence is the durability boundary; transient pointer updates are local interaction state only.
- Persistence failures are primarily a development diagnostic in this feature: console logging or the TanStack Query developer tools are sufficient, and a new production-facing error status is not required.
- Undo and Redo are evaluated within the current Workbench project context and do not become cross-user conflict-resolution operations.
