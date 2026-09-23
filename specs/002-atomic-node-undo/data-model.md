# Data Model: Atomic Node Gesture History

## Workbench Gesture Transaction

Represents one active user manipulation before it becomes a history action or durable save.

| Field | Type | Required | Description |
|---|---|---:|---|
| `kind` | `move \| resize \| arrow-handle` | yes | User interaction category. |
| `projectId` | string or null | yes | Project context at gesture start. |
| `startedAt` | number | yes | Local start timestamp for lifecycle/debugging. |
| `startSnapshot` | Workbench history snapshot | yes | Complete pre-gesture state. |
| `affectedNodeIds` | string[] | yes | Node IDs included in the gesture, including a selected group. |
| `status` | `active \| committed \| cancelled` | yes | Lifecycle outcome; only `committed` can create history/persistence. |

Validation rules:

- `affectedNodeIds` contains unique IDs that exist in the start snapshot.
- An active transaction belongs to one project and cannot be reused after project switching.
- A transaction that finishes with a state equal to `startSnapshot` is a no-op and does not append history or trigger a completed-gesture save.
- A cancelled transaction restores `startSnapshot` and produces no history entry or database write.
- A committed transaction contains the final state for all affected nodes and is finalized once.

## Workbench History Action

Uses the existing `WorkbenchHistorySnapshot` shape as the before/after unit represented by the history stack.

| Field | Type | Description |
|---|---|---|
| `workbenchNodes` | WorkbenchNode[] | Full node state, including position, dimensions, scale, and node data. |
| `connections` | Connection[] | Connections associated with the snapshot. |
| `selectedNodeIds` | string[] | Selection state restored by Undo/Redo. |
| `activeNodeId` | string or null | Active node state restored by Undo/Redo. |

Relationships and invariants:

- A committed gesture appends one final snapshot after its start snapshot.
- Undo moves the history index to the start snapshot; Redo moves it to the final snapshot.
- A new committed edit after Undo truncates the abandoned redo branch according to existing history behavior.
- Existing non-gesture edits remain separate history actions.

## Completed Scene State

Represents the durable state written for the current project after a completed gesture.

| Field | Type | Description |
|---|---|---|
| `projectId` | UUID | Project whose main scene is being saved. |
| `data.nodes` | WorkbenchNode[] | Final Workbench node state. |
| `data.connections` | Connection[] | Final Workbench graph connections. |
| `expectedVersion` | number or undefined | Version used to detect stale writes. |
| `version` | number | Server-assigned scene version after successful persistence. |
| `updatedBy` | UUID | Authenticated user recorded by the existing scene persistence path. |
| `updatedAt` | timestamp | Server update time. |

Persistence invariants:

- Intermediate active-gesture states are not completed scene writes.
- A completed gesture writes the latest final `nodes` and `connections` state.
- A version conflict follows the existing scene-save conflict/retry behavior; this feature does not define multi-user conflict resolution.
- A failed write does not remove the local final state; diagnostics identify the failure and existing pending-save behavior may retry it.

## State Transitions

```text
idle
  -> active       first meaningful movement/resize/handle update
  -> idle         no-op click or unchanged gesture
active
  -> committed    normal release with changed final state
  -> cancelled    interruption, project switch, unmount, or explicit cancellation
committed
  -> idle         history append and final-state persistence request dispatched
cancelled
  -> idle         start snapshot restored; no history or persistence action
```

## Existing Storage Mapping

The first release maps `Completed Scene State` to the existing project main-scene JSON data rather than adding a new table or action log. The existing scene record’s project relation, version, updater, and timestamp remain authoritative for persistence. Future collaboration may introduce additional entities, but those are intentionally outside this feature.
