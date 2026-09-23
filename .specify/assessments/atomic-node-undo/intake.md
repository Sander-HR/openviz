# Idea Intake: Atomic Node Undo

- **Slug**: atomic-node-undo
- **Created**: 2026-04-21T00:00:00Z
- **Source**: pasted text / OpenViz repository context; URL policy: `auto-refused: loopback host (localhost)`; sanitized URL: `http://localhost:3000/projects/9ad32117-9cda-4a96-a112-b7591439e61f`
- **Type**: fix

## Idea (as captured)

> when moving a node such as the sticky note with text "Test" in the OpenViz project at `http://localhost:3000/projects/9ad32117-9cda-4a96-a112-b7591439e61f` the undo button remembers more drag points while it should just remember the position from when i just selected the node. And then remember when i drop/release the node. Can you make this work for all nodes like this? What would be expected behaviour you think? Make a plan and dont do any codechanges yet

The idea concerns Workbench node history behavior in the OpenViz repository. The referenced loopback URL was not fetched under the URL Trust Policy because `localhost` is a refused loopback host.

## Restated

Change node movement history so the interaction is treated as a single undoable action rather than multiple remembered positions during a drag. Apply the expected behavior consistently across applicable node types.

## Origin & Context

- **Raised by**: User
- **Trigger**: A report that undoing a dragged sticky note steps through intermediate drag points instead of returning directly to the position before the drag.

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Which node interactions beyond movement are included in the requested behavior?]
- [NEEDS CLARIFICATION: Should dragging multiple selected nodes be recorded as one action or separate actions?]
- [NEEDS CLARIFICATION: What should happen for a click or interrupted drag that produces no final position change?]
- [NEEDS CLARIFICATION: Should existing Studio history and Workbench history retain separate behavior?]
- [NEEDS CLARIFICATION: Are resize, arrow-handle, text-edit, and other node gestures in scope?]
