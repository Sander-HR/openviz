# Feature Specification: Real-Time Workbench Collaboration

**Feature Branch**: `003-workbench-collaboration`

**Created**: 2026-09-21

**Status**: Implemented

**Input**: Go-decision handoff from `.specify/assessments/react-flow-yjs-collaboration/decision.md`: "Internal team members cannot co-edit the same workbench scene concurrently without data-loss risk, lack presence visibility, and have no offline resilience. Chosen approach: Option C (phased) — M1 shared scene editing + presence/cursors; M2 offline edit queue with merge on reconnect." All 12 assessment open questions were resolved by the requester (recorded in `.specify/assessments/react-flow-yjs-collaboration/clarifications.md`).

## Clarifications

### Session 2026-09-21 (from idea assessment, answered by the requester)

- Q: Who needs this collaboration? → A: Internal team co-editing — small design/AI teams editing the same project's workbench concurrently.
- Q: What is the minimum first-release scope? → A: Shared scene graph plus presence and cursor indicators (matches the referenced React Flow collaborative example). No shared viewport, selection sync, or comments in v1.
- Q: What defines success? → A: No data loss on concurrent edits — changes converge and no one's work is silently overwritten. Latency is best-effort, not a hard target.
- Q: What happens if this is never built? → A: Nice-to-have for now — the shipped near-real-time phase (snapshot streaming + soft locks + versioned writes) already mitigates most conflicts.
- Q: Which synchronization approach and server model? → A: A live shared-document (CRDT-style) synchronization layer on a self-hosted realtime server, with client-side offline queuing. The specific technology stack is deferred to planning (full record in the assessment clarifications).
- Q: What is the durable source of truth for scenes? → A: The existing saved scene state in the project database. Collaboration is a live synchronization layer on top; periodic snapshots keep the saved state current.
- Q: How should Undo/Redo behave when remote changes arrive? → A: Local-only undo — a user's Undo reverts only their own completed edits; remote collaborators' changes are never undone by it.
- Q: Is offline editing required in v1? → A: Yes — full offline editing with merge on reconnect (edits made while disconnected are not lost).
- Q: How is collaboration access controlled? → A: Reuse existing project membership checks; no new access paths or invite mechanisms.
- Q: What scale must the first release support? → A: 2–5 concurrent editors, scenes under ~100 nodes.
- Q: What happens to existing scenes at launch? → A: Lazy import — a scene's saved content becomes the shared scene on its first collaborative open; no bulk migration.
- Q: What does a collaboration session map to? → A: One project's main workbench scene (same identity as the existing per-project scene).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Two teammates edit the same scene without losing work (Priority: P1)

Two project members open the same workbench scene and edit it at the same time — moving nodes, adding or deleting nodes, changing connections. Each sees the other's changes appear live, and when both finish, every completed edit from both users is present in both sessions.

**Why this priority**: This is the core problem the feature solves (serialized editing with data-loss risk) and the primary value for internal teams.

**Independent Test**: Open the same project scene in two browser sessions. In each session, perform several edits (move a node, add a node, delete a node, change a connection), overlapping in time. Verify that both sessions converge to an identical final scene containing every completed edit from both users.

**Acceptance Scenarios**:

1. **Given** two connected collaborators in the same scene, **When** one moves a node and the other adds a new node at the same time, **Then** both sessions show both the moved node and the new node without either performing a reload.
2. **Given** two collaborators editing different nodes simultaneously, **When** both complete their edits, **Then** every completed edit from both users is present in both sessions' final state.
3. **Given** two collaborators working on the same node at the same time (for example one moves it while the other resizes it), **When** both edits complete, **Then** both sessions converge to a single consistent state and neither session shows a partially applied or contradictory result.
4. **Given** a connected collaborator, **When** another collaborator deletes a node, **Then** the deleted node (and its connections) disappear from the first collaborator's scene without a reload.
5. **Given** a connected collaborator, **When** another collaborator changes a connection between nodes, **Then** the change is reflected in the first collaborator's scene.

---

### User Story 2 - See who is working and where (Priority: P1)

A user opening a shared scene can see which teammates are currently in it and where their cursors are on the canvas, so they can avoid stepping on each other's work and coordinate naturally.

**Why this priority**: Presence is the requested second half of the collaboration experience (matching the referenced collaborative example) and makes concurrent editing safe to use socially.

**Independent Test**: Open the same project scene in two sessions. Verify that each session lists the other as present, that moving the pointer in one session moves a visible cursor indicator in the other, and that leaving or disconnecting one session removes its presence and cursor.

**Acceptance Scenarios**:

1. **Given** one collaborator already in a scene, **When** a second project member opens the same scene, **Then** the first collaborator sees the second listed as present within a couple of seconds.
2. **Given** two connected collaborators, **When** one moves their pointer across the canvas, **Then** the other sees a cursor indicator for that collaborator tracking the corresponding positions.
3. **Given** a present collaborator, **When** they leave the scene or their connection drops, **Then** their presence entry and cursor disappear from the other sessions.
4. **Given** a collaborator has selected an item (or is actively editing it), **When** another collaborator tries to select, move, resize, edit, or delete that item, **Then** the attempt is blocked and the item shows who holds it.
5. **Given** two collaborators select the same item at nearly the same time, **When** both sessions resolve the conflict, **Then** exactly one deterministically wins (earliest selection timestamp; ties broken by client id) and the other's selection of that item is released automatically.
6. **Given** a collaborator holding an item lock, **When** they deselect the item, switch projects, or disconnect, **Then** the lock is released and others can edit the item again.

---

### User Story 3 - Keep working offline and merge when back (Priority: P2)

A user's connection drops mid-session. They keep editing locally — the edits stay visible to them — and when the connection returns, everything merges: their offline edits plus everyone else's edits made in the meantime, with nothing lost on either side.

**Why this priority**: Explicitly requested requirement (full offline + merge). It is P2 because online collaboration (M1) delivers value first; offline resilience (M2) completes it.

**Independent Test**: With two sessions open on the same scene, disconnect one from the network. Make several edits in the disconnected session and several in the connected one. Restore the connection. Verify both sessions converge to a state containing all edits from both sides.

**Acceptance Scenarios**:

1. **Given** an editor whose connection drops, **When** they continue editing locally, **Then** their edits remain visible and usable in their own session while disconnected.
2. **Given** offline edits made during a disconnection, **When** the connection is restored, **Then** all offline edits are merged into the shared scene and become visible to other collaborators with none lost.
3. **Given** an editor who was offline while others edited the scene, **When** they reconnect, **Then** they receive the others' changes without losing their own offline edits.
4. **Given** two collaborators who both edited the same node while disconnected from each other, **When** they reconnect, **Then** both sessions converge to a single consistent state and no session shows lost or contradictory content.
5. **Given** an editor who made offline edits and then closed their browser, **When** they reopen the project and connect, **Then** the earlier offline edits are not lost and merge into the shared scene.

---

### User Story 4 - Only project members can join a shared scene (Priority: P2)

Collaboration does not widen access: only users who already have access to the project can join its shared scene; everyone else is treated exactly as before this feature.

**Why this priority**: Collaboration changes the trust boundary from single-user persistence to shared live state; reusing the existing access model was an explicit requirement.

**Independent Test**: With a user who has project access and one who does not, attempt to open the same project scene in each. Verify the member joins the shared session normally and the non-member is blocked exactly as by the existing project access rules.

**Acceptance Scenarios**:

1. **Given** a user with access to a project, **When** they open its workbench scene, **Then** they join the shared session and can see and interact with collaborators.
2. **Given** a user without access to a project, **When** they attempt to open or join its workbench scene, **Then** they cannot view or edit the shared scene and no new access path is created by this feature.

---

### User Story 5 - Existing scenes keep working, and adopt collaboration on first shared open (Priority: P3)

Projects created before this feature continue to behave exactly as before when used single-user. When a scene is opened collaboratively for the first time, its saved content becomes the starting point of the shared scene with nothing lost — no migration step is required.

**Why this priority**: Protects the existing user base and makes rollout frictionless; it bounds the feature's blast radius.

**Independent Test**: Open an existing project single-user and verify unchanged behavior. Then open the same project in two sessions, make edits in both, and verify the scene started from the saved content with no missing nodes or connections.

**Acceptance Scenarios**:

1. **Given** an existing saved scene that is never opened collaboratively, **When** a user opens and saves it single-user, **Then** its behavior and persistence are unchanged by this feature.
2. **Given** an existing saved scene, **When** it is opened in a shared session for the first time, **Then** every saved node and connection is present in the shared scene as its starting state.
3. **Given** a scene already adopted collaboratively, **When** it is reopened later by any member, **Then** the current converged state (not an older snapshot) is loaded.

### Edge Cases

- A user's Undo/Redo never reverts another collaborator's changes; undoing one's own edits leaves all remote changes intact, and a new local edit after Undo clears the local redo path per existing history expectations.
- A disconnection occurring mid-gesture (for example during a drag) does not lose the gesture: it completes locally and is included in the offline merge on reconnect.
- After a long disconnection during which the shared scene changed substantially, reconnecting performs a full state reconciliation with no data loss from either side.
- Concurrent creation and deletion of the same node by two collaborators resolves to one deterministic result that is identical in all sessions, with no dangling connections or orphaned content visible.
- Two collaborators triggering an AI-assisted generation on the same node at the same time do not corrupt the scene; the graph structure stays consistent and the node ends with one completed output.
- Two collaborators select the same item within milliseconds of each other: exactly one session keeps the selection (earliest timestamp wins, ties broken by client id) and the other releases it without error or corruption.
- A collaborator is editing an item when another collaborator's lock on that item would normally block them — locks only restrict edits initiated from a session that does not hold the lock; the holder keeps full control until they release it.
- Behavior beyond the target scale (more than five concurrent editors, or scenes far larger than ~100 nodes) is not guaranteed in this release, but exceeding it must not corrupt the shared scene state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow two to five project members to edit the same project's main workbench scene concurrently, with each user's completed changes visible to every connected collaborator without a reload.
- **FR-002**: The system MUST converge all connected sessions to the same final scene state after concurrent edits; no collaborator's completed edit MAY be silently overwritten or lost.
- **FR-003**: The system MUST show which collaborators are currently present in the shared scene.
- **FR-004**: The system MUST show each collaborator's cursor position on the canvas to the other collaborators as a live indicator.
- **FR-005**: The system MUST remove a collaborator's presence entry and cursor indicator when they leave the scene or their connection drops.
- **FR-006**: The system MUST allow an editor to continue making edits while disconnected, with those edits remaining visible and usable in the editor's own session.
- **FR-007**: The system MUST merge all offline edits into the shared scene when a connection is restored, without losing either the offline edits or the edits made by others during the disconnection.
- **FR-008**: The system MUST limit Undo/Redo to the invoking user's own completed edits; remote collaborators' changes MUST NOT be reverted by a local Undo.
- **FR-009**: The system MUST restrict joining a shared scene session to users who already have access to that project, and MUST NOT create any new access path (no invite links or external-stakeholder mechanisms) in this release.
- **FR-010**: The system MUST initialize a shared scene from the existing saved state of the scene on its first collaborative open, preserving all saved nodes and connections.
- **FR-011**: The system MUST keep the durable saved scene state consistent with the converged shared state, so that reopening the project later loads the current scene rather than a stale snapshot.
- **FR-012**: The system MUST NOT change single-user behavior, editing, or persistence for scenes that are never opened collaboratively.
- **FR-013**: The system MUST NOT include shared viewport synchronization, visual selection-state sharing, or comments in this release. (Selection-derived soft locks are in scope per FR-015.)
- **FR-014**: The system MUST keep collaboration within the existing project access and permission model; external stakeholder access is out of scope for this release.
- **FR-015**: While a collaborator has an item selected or is actively editing it, the system MUST present that item as locked to all other collaborators: they MUST NOT be able to select, move, resize, edit, or delete it, and the item MUST visibly indicate which collaborator holds it.
- **FR-016**: Item locks MUST be released automatically when the holder deselects the item, stops editing it, switches projects, or disconnects; concurrent claims for the same item MUST resolve to a single deterministic winner across all sessions.

### Key Entities *(include if data involved)*

- **Shared scene state**: The concurrently edited state of a project's main workbench scene — nodes, connections, and node content — as seen by all collaborators in one shared session.
- **Collaborator session**: One user's participation in a shared scene, connected (live) or locally queued (disconnected), including their identity within the project.
- **Presence record**: The per-collaborator information shown to others — that they are in the scene and where their cursor is on the canvas.
- **Offline edit queue**: The set of an editor's completed edits made while disconnected, awaiting merge into the shared scene on reconnect; must survive closing and reopening the app.
- **Scene adoption event**: The first collaborative open of a previously single-user saved scene, at which point its saved content becomes the shared scene's starting state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of automated concurrent-edit tests (2–5 simulated collaborators on scenes under ~100 nodes), every completed edit from every collaborator is present in the final converged state of every session — zero lost edits.
- **SC-002**: In 100% of concurrent-edit tests, after convergence all connected sessions display an identical scene state (no persistent divergence between sessions).
- **SC-003**: A newly joined collaborator's presence entry and cursor are visible to existing collaborators within 2 seconds of joining.
- **SC-004**: In 100% of offline tests, after reconnection every edit made during the disconnection — by any collaborator — is present in the shared scene; zero lost offline edits, including edits made before the app was closed.
- **SC-005**: In 100% of mixed local/remote history tests, undoing a user's own actions leaves all remote collaborators' changes intact.
- **SC-006**: In 100% of access-control tests, users without project access cannot join, view, or edit the shared scene; users with access always can.
- **SC-007**: First collaborative open of an existing saved scene preserves 100% of its saved nodes and connections.
- **SC-008** (qualitative): In a manual team review, two or more teammates work in the same scene simultaneously without coordinating who edits when, and neither loses work.

## Assumptions

- One collaboration session maps to one project's main workbench scene; multi-scene rooms are out of scope.
- Target scale is 2–5 concurrent editors on scenes under ~100 nodes; latency at that scale is best-effort (no strict latency SLA was requested).
- Undo/Redo remains local per user and composes with the existing atomic gesture-history behavior from the prior workbench history feature; remote changes are never part of a user's undo stack.
- The existing project access model (workspace/project membership) is reused unchanged for collaboration authorization; no new roles, invitations, or tenant-isolation mechanisms are introduced.
- Existing scenes require no bulk migration; adoption happens lazily on first collaborative open.
- Advisory indicators from the prior near-real-time phase (for example lock/presence badges) may remain as informational signals but do not block a collaborator from editing a node another collaborator is working on.
- AI-assisted generation remains a per-node operation; concurrent triggers on the same node resolve to one completed output without corrupting graph structure.
- The synchronization technology, server deployment, and offline-queue mechanism are plan-stage decisions (the assessment recommends a CRDT-based live sync layer on a self-hosted realtime server with client-side offline queuing); they do not constrain this specification.
