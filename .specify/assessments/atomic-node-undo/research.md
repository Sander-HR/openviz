# Idea Research: Atomic Node Undo

- **Slug**: atomic-node-undo
- **Created**: 2026-04-21T00:00:00Z
- **Evidence confidence (overall)**: medium

## Users & Demand

- There is one direct user report describing a sticky note whose Undo history contains multiple drag points rather than the expected before/after positions — [source: `.specify/assessments/atomic-node-undo/intake.md`, user report] (confidence: high, cited).
- The repository contains Workbench Undo/Redo controls and keyboard actions, indicating that this is an existing user-facing workflow rather than a purely internal API — [source: `src/components/workbench/WorkbenchToolbar.tsx:190-207`; `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts:40-52`] (confidence: high, cited).
- No telemetry, support-ticket count, usability study, or frequency measurement for drag-related Undo behavior was found in the repository — [source: repository search and `.specify/` contents] (confidence: medium, cited).
- Broader demand beyond the reporting user is [NEEDS CLARIFICATION: no observed usage data or additional user reports are available].

## Prior Art

- OpenViz already has a dedicated Workbench history stack containing snapshots of nodes, connections, selection, and active-node state, with a maximum of 100 snapshots and redo-branch truncation on new commits — [source: `src/store/slices/workbenchSlice.ts:80-122`] (confidence: high, cited).
- OpenViz already suppresses duplicate snapshots by comparing the current snapshot with the proposed snapshot, but the comparison occurs after each `updateWorkbenchNode` call — [source: `src/store/slices/workbenchSlice.ts:94-108`] (confidence: high, cited).
- React Flow documents node position changes as repeated `NodePositionChange` events and documents `OnNodeDrag` callbacks with the dragged node and affected node collection; its official undo/redo example uses an explicit history stack and index — [source: https://github.com/xyflow/xyflow/blob/main/_autodocs/types.md; https://github.com/xyflow/xyflow/blob/main/_autodocs/examples-and-patterns.md] (confidence: high, cited).
- The current Workbench integration handles every position change in `handleNodesChange`, while `onNodeDragStop` performs another update at release — [source: `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts:38-69`; `src/components/workbench/workbench.tsx:180-188`] (confidence: high, cited).
- Arrow handle movement also emits repeated data updates during pointer movement and has a pointer-up boundary in the component, creating a separate existing gesture lifecycle — [source: `src/components/nodes/ArrowNode.tsx:32-75`] (confidence: high, cited).
- The repository has an earlier Workbench baseline commit that introduced the current large Workbench/history-related code area, but no prior decision or assessment specifically addresses drag-history granularity — [source: `git show --format=fuller --no-patch afbe835c`; repository search under `.specify/`] (confidence: medium, cited).

## Market & Context

- This is a local interaction-quality issue in an existing node-editor workflow. No market sizing, competitor comparison, or external customer research was found in the repository — [source: repository search] (confidence: medium, cited).
- The current alternative for a user is to press Undo repeatedly until the desired earlier drag position is reached, based on the reported behavior — [source: `.specify/assessments/atomic-node-undo/intake.md`, user report] (confidence: high, cited).
- The cost of doing nothing is [NEEDS CLARIFICATION: frequency of affected drags, number of users affected, and whether repeated Undo causes meaningful workflow loss have not been measured].

## Data & Constraints

- Workbench history is capped at 100 snapshots, so high-frequency drag commits can consume the available history window faster than logical user actions would — [source: `src/store/slices/workbenchSlice.ts:80,110-115`] (confidence: high, cited).
- Workbench node updates also mirror the node list into `projectNodes` when a project is active, so any history-related behavior must preserve that synchronization — [source: `src/store/slices/workbenchSlice.ts:192-208`] (confidence: high, cited).
- The current implementation explicitly sends every non-resize position change to the store, while resize handling and arrow data changes use separate update paths — [source: `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts:38-69,110-206`; `src/components/workbench/hooks/useWorkbenchGraph.ts:69-94`] (confidence: high, cited).
- The relevant files are already substantial: `workbenchSlice.ts` is 951 lines and `workbench.tsx` is 284 lines in the current checkout — [source: `wc -l` on repository files] (confidence: high, cited).
- The application uses `@xyflow/react` version `^12.10.0`, so callback and event behavior must be evaluated against that installed API rather than assumed from another React Flow version — [source: `package.json`] (confidence: high, cited).
- No compliance, legal, or sensitive-data constraint specific to undo granularity was identified — [source: repository search] (confidence: low, cited).

## Evidence Against the Idea

- Demand evidence is currently limited to one user report; there is no quantitative evidence that the issue is widespread or costly — [source: intake note and repository search] (confidence: high, cited).
- The existing snapshot system intentionally records complete Workbench state and already avoids exact duplicate snapshots; changing gesture granularity could affect established Undo/Redo behavior for other operations — [source: `src/store/slices/workbenchSlice.ts:97-122`; `src/store/slices/workbenchSlice.ts:903-945`] (confidence: medium, cited).
- Expanding the behavior from movement to resize, arrow handles, or other gestures would touch multiple event lifecycles and could introduce inconsistencies if gesture completion or cancellation is not observable in every path — [source: `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts:110-206`; `src/components/nodes/ArrowNode.tsx:32-75`] (confidence: medium, cited).
- No evidence currently establishes that users expect all node gestures, multi-selection movement, or interrupted gestures to share the same history semantics — [source: `.specify/assessments/atomic-node-undo/intake.md`, unresolved questions] (confidence: high, cited).

## Gaps & Open Questions

- [NEEDS CLARIFICATION: How often do users move nodes and then use Undo in production?]
- [NEEDS CLARIFICATION: Are there additional reports involving image, video, render, animate, text, freehand, or arrow nodes?]
- [NEEDS CLARIFICATION: What exact semantics are expected for multi-selection movement?]
- [NEEDS CLARIFICATION: What exact semantics are expected for no-op, cancelled, interrupted, or browser-lost-pointer gestures?]
- [NEEDS CLARIFICATION: Should text typing remain per-edit or become an atomic editing gesture?]
- [NEEDS CLARIFICATION: Is a successful immediate scene save required after every completed gesture, and how is save failure represented to users?]
- [NEEDS CLARIFICATION: Are there existing browser-level tests or reproducible recordings for the supplied project?]

## Sources

- `http://localhost:3000/projects/9ad32117-9cda-4a96-a112-b7591439e61f` (host: localhost, policy: auto-refused: loopback host; not fetched)
- `src/store/slices/workbenchSlice.ts` (internal repository source)
- `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts` (internal repository source)
- `src/components/workbench/workbench.tsx` (internal repository source)
- `src/components/nodes/ArrowNode.tsx` (internal repository source)
- `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts` (internal repository source)
- `src/components/workbench/WorkbenchToolbar.tsx` (internal repository source)
- `package.json` (internal repository source)
- `git show --format=fuller --no-patch afbe835c` (internal repository history)
- https://github.com/xyflow/xyflow/blob/main/_autodocs/types.md (host: github.com, policy: allowlisted)
- https://github.com/xyflow/xyflow/blob/main/_autodocs/examples-and-patterns.md (host: github.com, policy: allowlisted)
