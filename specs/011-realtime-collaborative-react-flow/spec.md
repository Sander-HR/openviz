# Feature Specification: Real-Time Collaborative React Flow Editor

**Feature Branch**: `011-realtime-collaborative-react-flow`
**Created**: 2026-10-01
**Status**: Draft
**Input**: Product Requirements Document: "Real-Time Collaborative React Flow Editor"

## Clarifications

### Session 2026-10-01

- Q: Should local graph edits during an active collaboration session be applied as explicit document commands (typed Y.Doc operations, React Flow renders a pure projection) or via the current store-diff flush bridge? → A: Explicit document commands — every create/edit/move/delete is a typed operation applied directly to the shared document; React Flow renders only a projection of it; local UI state never holds collaborative nodes/edges as an authoritative copy.
- Q: What concrete, measurable threshold defines "unacceptable editor degradation" for the 50-collaborator target? → A: Interaction latency (local edit → visible render) p95 <100 ms AND ≥30 fps sustained during concurrent 50-user cursor traffic.
- Q: When two users edit the same field of the same node concurrently, which value must win in the converged document? → A: Last-update-wins — the later write (by Yjs update order) wins; no extra metadata or clocks are stored in the document.
- Q: After how long should a disconnected collaborator's cursor and presence be removed from other sessions? → A: Immediately on clean disconnect (awareness protocol clears peer state); 30 s timeout for abnormal drops.
- Q: On reconnect after offline edits (including refresh + IndexedDB restore), which document takes precedence when merging? → A: Symmetric Yjs merge — exchange state vectors and apply both sides' missing updates; neither the local replica nor the server document is discarded.
- Q: Should the p95 document-sync and cursor-latency targets be measured under the same 50-collaborator cursor-traffic workload defined for the interaction-latency and frame-rate target? → A: Measure all targets with 50 collaborators generating cursor traffic.
- Q: When a collaboration join is rejected because authentication or document access fails, what should the editor tell the user? → A: Show a generic access-unavailable message with a safe sign-in/retry action; do not disclose document existence or permission details.
- Q: Which shared document metadata should the first release synchronize alongside nodes and edges? → A: The scene name only; ownership, main-scene status, version, and audit timestamps remain server-managed.
- Q: During the 50-collaborator performance test, how much graph-edit traffic should accompany each client’s 30–40 cursor updates per second? → A: One controlled editor sends one graph operation per second while all 50 clients publish cursors.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit a shared graph in real time (Priority: P1)

As a designer, I can edit the same React Flow document with other authorized collaborators and see shared node and edge changes without manually refreshing or saving each operation.

**Why this priority**: Concurrent graph editing is the primary value of the feature.

**Independent Test**: Open one document in two or more authorized browser sessions, perform overlapping node and edge edits, and verify that every session converges to the same graph.

**Acceptance Scenarios**:

1. **Given** two authorized users are connected to the same document, **when** either user creates, edits, moves, or deletes a node or edge, **then** the change appears in the other session automatically.
2. **Given** users concurrently edit different graph entities, **when** their changes complete, **then** both changes are present in the converged document.
3. **Given** users concurrently edit the same entity, **when** synchronization completes, **then** all sessions converge deterministically without manual conflict resolution.
4. **Given** the document is open, **when** graph edits occur, **then** they do not require one REST request per operation.
5. **Given** collaborators are connected to the same scene, **when** one collaborator changes the scene name, **then** the updated name is shared and persisted for all collaborators.

### User Story 2 - Undo and redo my own collaborative work (Priority: P1)

As a collaborator, I can undo and redo my own completed graph changes while other users continue editing, without undoing another user’s work.

**Why this priority**: Collaborative history must be safe and predictable in a shared document.

**Independent Test**: Have users make interleaved edits, then invoke undo and redo independently in each session. Verify that each user’s history is independent and operates against the current shared document.

**Acceptance Scenarios**:

1. **Given** a user completes a move, creation, deletion, edge edit, or node-data edit, **when** they invoke Undo, **then** their own most recent completed change is reversed.
2. **Given** another user has edited the same document after the first user’s change, **when** the first user invokes Undo, **then** the other user’s change is not reverted.
3. **Given** a user has undone a local change, **when** they invoke Redo, **then** their local change is reapplied against the current document state.
4. **Given** a user is offline, **when** they edit and then undo or redo, **then** the operation works against their local document immediately.
5. **Given** a user completes one gesture containing many pointer updates, **when** they invoke Undo, **then** the gesture is one history action rather than many mouse-movement actions.

### User Story 3 - See collaborators and their cursors (Priority: P1)

As a collaborator, I can see who is active in the document and where other collaborators are working without those ephemeral indicators becoming part of the saved graph.

**Why this priority**: Presence and cursor context make simultaneous editing understandable and reduce accidental interference.

**Independent Test**: Open a document in multiple sessions, move cursors, change connection state, and verify identity, color, positions, and stale-user cleanup.

**Acceptance Scenarios**:

1. **Given** another user is connected, **when** they move their pointer, **then** their identified cursor appears at the correct world position despite local pan and zoom.
2. **Given** a collaborator is present, **when** their connection drops or they leave, **then** their cursor and presence disappear after the configured stale timeout.
3. **Given** many collaborators are connected, **when** cursor updates arrive, **then** remote cursor rendering does not trigger a full React Flow graph rerender.
4. **Given** the document is persisted or reopened, **when** graph state is loaded, **then** cursor and presence records are absent.

### User Story 4 - Continue working through network loss (Priority: P1)

As a designer, I can keep editing while temporarily disconnected and have my local edits survive refresh and synchronize after reconnection.

**Why this priority**: Temporary network loss must not cause confirmed local work to disappear.

**Independent Test**: Disconnect a session, make graph edits, refresh or close/reopen when local persistence is available, reconnect, and verify convergence with a connected collaborator.

**Acceptance Scenarios**:

1. **Given** the WebSocket connection is unavailable, **when** the user edits the graph, **then** changes apply immediately to the local document.
2. **Given** local edits were made while disconnected, **when** the connection returns, **then** missing updates exchange and the local and remote documents converge without losing confirmed edits.
3. **Given** the user reconnects after a refresh, **when** the local document is restored, **then** it merges with the current server document rather than discarding local changes.
4. **Given** the user was moving a node while disconnected, **when** they reconnect, **then** historical pointer positions are not replayed; only the completed document operation is synchronized.

### User Story 5 - Join only authorized documents (Priority: P1)

As a project member, I can join shared documents I am authorized to access, while unauthorized users receive no document, cursor, or presence data.

**Why this priority**: Real-time synchronization expands the data boundary and must preserve document permissions.

**Independent Test**: Attempt to join as an authorized and unauthorized user, including token expiry and reconnect scenarios.

**Acceptance Scenarios**:

1. **Given** an authenticated user has document access, **when** they join, **then** the collaboration server admits them to the document room.
2. **Given** a user is unauthenticated or lacks document access, **when** they attempt to join, **then** the connection is rejected and no document, cursor, or presence data is disclosed.
3. **Given** a user reconnects, **when** authentication and authorization succeed, **then** they rejoin and republish current presence and cursor state.
4. **Given** a collaboration join is rejected, **when** the editor reports the failure, **then** it shows a generic access-unavailable message with a safe sign-in/retry action without disclosing whether the document exists or the specific permission failure.

### Edge Cases

- A user undoes a move after another user has moved the same node; the other user’s change remains intact and all sessions converge.
- Two users concurrently update different fields of one node; independent fields merge without unnecessary whole-node replacement.
- A user closes the browser while offline; locally persisted document updates remain available for later reconnection.
- A cursor is published while the local viewport is panning or zooming; the remote cursor remains correctly transformed.
- Fifty collaborators connect or disconnect in bursts; presence cleanup and cursor throttling remain bounded.
- Undo or redo is attempted while a gesture is active; the active gesture is not exposed as a partial history entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The collaborative document MUST support creating, editing, moving, and deleting nodes and edges for multiple authorized users.
- **FR-002**: The shared document MUST be the authoritative source of truth for collaborative nodes, edges, and the shared scene name. Ownership, main-scene status, version, and audit timestamps remain server-managed.
- **FR-003**: The editor MUST render the current shared document state without requiring a REST request for every graph operation.
- **FR-004**: Concurrent document updates MUST merge deterministically and all connected sessions MUST converge to the same graph state.
- **FR-005**: Each user MUST have an independent Undo/Redo history over their own completed document operations.
- **FR-006**: Undo MUST operate against the current shared document and MUST NOT revert another user’s operation.
- **FR-007**: Undo history MUST be session/in-memory state and MUST NOT be treated as permanent document version history.
- **FR-008**: A completed drag, resize, or other multi-event gesture MUST be represented as one undoable operation; intermediate pointer positions MUST NOT become separate history entries.
- **FR-009**: The editor MUST apply graph operations locally while disconnected and MUST synchronize missing document updates after reconnection.
- **FR-010**: Local document persistence MUST allow edits to survive temporary network failures and browser refresh when local persistence is available.
- **FR-011**: Reconnection MUST authenticate the user, verify document access, exchange missing updates via symmetric state-vector reconciliation (applying both sides' missing updates; neither the local replica nor the server document is discarded), merge local and remote document changes, and refresh presence/cursor state.
- **FR-012**: Cursor and presence data MUST be ephemeral, MUST NOT be stored in document history, and MUST NOT be persisted as graph data.
- **FR-013**: Cursor updates MUST be throttled to approximately 30–40 updates per second per user, and stale cursors MUST be removed immediately on clean disconnect and after a 30-second timeout for abnormal drops.
- **FR-014**: Remote cursor rendering MUST remain independent of React Flow node state and local pan/zoom transformations.
- **FR-015**: The UI MUST expose Connected, Reconnecting, and Offline connection states.
- **FR-016**: Local UI/application state MAY be managed separately, but it MUST NOT become an authoritative duplicate of collaborative nodes, edges, or shared document metadata.
- **FR-021**: While a collaboration session is active, local graph edits MUST be applied as explicit document commands (typed operations on the shared document); the editor MUST render a projection of the shared document and MUST NOT flush a local working copy back into it.
- **FR-017**: Every collaboration connection MUST authenticate the user and enforce document permissions before transmitting document, cursor, or presence data.
- **FR-018**: The system MUST support an initial target of 50 concurrent collaborators per document without unacceptable editor degradation.
- **FR-019**: The system MUST achieve p95 document synchronization latency below 200 ms and p95 cursor latency below 150 ms under normal target conditions.
- **FR-020**: Confirmed local edits MUST have zero loss during temporary network failures in supported offline/reconnection scenarios.

### Key Entities *(include if feature involves data)*

- **Shared document**: The collaborative graph containing nodes, edges, and the shared scene name; ownership and lifecycle metadata remain server-managed.
- **Document update**: A merged operation applied to the shared document and propagated to authorized peers.
- **User history**: The current user’s in-memory undo/redo stack over their own document operations.
- **Awareness state**: Ephemeral user identity, presence, cursor, color, and connection information.
- **Local document replica**: A browser-local persisted copy used for offline editing and reconnection merge.
- **Collaboration session**: An authenticated user’s connection to one document room.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two or more authorized users can concurrently edit a document and 100% of convergence tests end with identical node and edge state in every session.
- **SC-002**: In 100% of mixed local/remote history tests, a user’s Undo/Redo changes only that user’s operations and preserves other users’ completed edits.
- **SC-003**: p95 document synchronization latency is below 200 ms while one editor submits one graph operation per second and all 50 collaborators publish 30–40 cursor updates per second.
- **SC-004**: p95 cursor latency is below 150 ms under the same workload: one graph operation per second from one editor and 30–40 cursor updates per second from each of 50 collaborators.
- **SC-005**: Cursor traffic is limited to approximately 30–40 updates per second per active user, and remote cursor updates do not cause full graph rerenders.
- **SC-006**: In 100% of supported offline/reconnection tests, confirmed local edits survive and converge after reconnection with zero lost edits.
- **SC-007**: The system supports 50 concurrent collaborators on one document with interaction latency (local edit → visible render) p95 <100 ms and ≥30 fps sustained while one editor submits one graph operation per second and all 50 collaborators publish 30–40 cursor updates per second — the defined "unacceptable degradation" threshold.
- **SC-008**: In 100% of authorization tests, users without valid authentication and document access receive no document, cursor, or presence data.
- **SC-009**: No cursor or presence record is present in persisted document state or document history after any test run.

## Assumptions

- One collaboration room represents one project document.
- The existing project membership model is reused for document authorization.
- Local persistence is best-effort where browser storage is unavailable; the UI reports the connection state and does not claim offline durability when storage is unavailable.
- Same-field concurrent edits resolve with last-update-wins semantics (the later write by Yjs update order wins); the product does not require manual conflict-resolution UI in this release.
- Long-term named versions, audit history, and historical snapshots are separate future functionality and are not part of Undo/Redo.
- Shared viewport synchronization is not required; each user retains an independent viewport.
- Cursor and presence may use the existing awareness channel initially; a dedicated high-concurrency transport is an optimization if measurement requires it.
