# Phase 0 Research: Atomic Node Gesture History

## Decision 1: Use an explicit gesture transaction around high-frequency node updates

- **Decision**: Treat drag, resize, and arrow-handle pointer movement as a transaction with a starting state, transient live updates, and one completed or cancelled outcome.
- **Rationale**: The current Workbench handler sends every React Flow position change through `updateWorkbenchNode`, and the store commits history on every update. React Flow documents position changes as repeated `NodePositionChange` events and provides drag lifecycle callbacks, so the history boundary must be tied to the user gesture rather than each event.
- **Alternatives considered**:
  - Keep every position update: rejected because it reproduces the reported Undo behavior and consumes the finite 100-snapshot history window.
  - Deduplicate only adjacent equal positions: rejected because drag positions are usually different, so it would not collapse one gesture into one action.
  - Keep transaction state only in the view: rejected because store mutations, undo/redo, persistence suppression, and project switching need one authoritative lifecycle.
- **Sources**: `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts:38-69`; `src/components/workbench/workbench.tsx:180-208`; `src/store/slices/workbenchSlice.ts:80-122,192-208`; React Flow documentation at https://github.com/xyflow/xyflow/blob/main/_autodocs/types.md.

## Decision 2: Capture the complete Workbench snapshot, not only changed node coordinates

- **Decision**: A gesture transaction compares and commits complete Workbench history state: nodes, connections, selected node IDs, and active node ID. Group movement includes every affected selected node.
- **Rationale**: `WorkbenchHistorySnapshot` already defines the current undo/redo unit. Reusing that semantic keeps undo/redo exact and avoids a separate partial-history format. React Flow’s drag callback supplies the dragged node and affected node collection, which supports group-aware finalization.
- **Alternatives considered**:
  - Record only x/y deltas: rejected because resize and arrow geometry also need exact before/after state, and deltas complicate undo after intervening edits.
  - Record only the primary node: rejected because group movement must undo atomically.
- **Sources**: `src/store/storeTypes.ts:11-16`; `src/store/slices/workbenchSlice.ts:82-95`; React Flow documentation at https://github.com/xyflow/xyflow/blob/main/_autodocs/types.md.

## Decision 3: Suppress persistence while a gesture is active and flush the completed state

- **Decision**: The autosave layer must recognize an active gesture as transient, avoid database writes from intermediate updates, and flush the final state after a completed gesture. Cancellation must restore the starting state without a write.
- **Rationale**: `useAutoSaveScene` currently observes `workbenchNodes`/`connections`, debounces saves by one second, and exposes an immediate flush bus. A long drag can therefore trigger a debounce save before release unless transient gesture state is explicitly respected. The existing scene PATCH endpoint already persists JSON scene data, tracks a version, and returns 409 conflicts; no new database table is required for this feature.
- **Alternatives considered**:
  - Rely only on the existing one-second debounce: rejected because a drag longer than the debounce interval can persist an intermediate position.
  - Add a separate database action/event log: rejected because full multi-user action history is explicitly out of scope and the current scene JSON already represents the durable Workbench state.
  - Add a new persistence endpoint: rejected because the existing scene PATCH contract already supports the required final-state write and version handling.
- **Sources**: `src/hooks/useAutoSaveScene.ts:20-180,339`; `src/services/workbench/sceneSyncBus.ts`; `src/app/api/projects/[id]/scenes/route.ts:97-151`; `src/lib/db/schema.ts:71-84`.

## Decision 4: Preserve local final state on persistence failure and use existing diagnostics

- **Decision**: A completed local gesture remains visible when persistence fails. The save path logs the failure, preserves its pending/retry behavior, and does not add a new production-facing error component for this feature.
- **Rationale**: This matches the clarified specification and current autosave behavior, which already logs failures and stores pending scene data in IndexedDB before network submission. TanStack Query documents mutation error state and developer tooling, but the current scene autosave is implemented in a dedicated hook rather than a mutation, so console diagnostics are the reliable existing signal unless the implementation explicitly adopts a mutation.
- **Alternatives considered**:
  - Revert local state on save failure: rejected because it discards a completed user action and conflicts with the clarification.
  - Silently retry: rejected because developers need a diagnostic signal and the specification requires no silent durability claim.
  - Introduce a new production error UI: rejected by the clarification and outside the focused interaction fix.
- **Sources**: `src/hooks/useAutoSaveScene.ts:100-180`; `src/services/workbench/pendingSceneStore.ts`; TanStack Query documentation at https://tanstack.com/query/latest/docs/framework/react/reference/useMutation (retrieved through Context7).

## Decision 5: No schema or API contract change is needed for the first release

- **Decision**: Persist completed Workbench state through the existing main-scene JSON payload and optimistic version mechanism.
- **Rationale**: The current `scenes` record already stores JSON data, a project relation, version, updater, and timestamps. The existing GET/PATCH route authorizes workspace members and handles version conflicts. This supports durable completed state while leaving future collaboration conflict policy out of scope.
- **Alternatives considered**:
  - Add per-gesture records: rejected as premature action-history infrastructure for a feature that explicitly excludes full collaboration and audit history.
  - Remove version checks: rejected because version checks are an existing protection against stale writes and should remain intact.
- **Sources**: `src/lib/db/schema.ts:71-84`; `src/app/api/projects/[id]/scenes/route.ts:10-29,97-151`; `drizzle/0000_rainy_cerise.sql:35-43`.

## Resolved Technical Unknowns

- **Language/version**: TypeScript with the repository’s React 19 and Next.js runtime.
- **State boundary**: Zustand Workbench slice plus a transient gesture lifecycle consumed by Workbench handlers and the autosave hook.
- **React Flow lifecycle**: Controlled node changes remain live; drag/resize/arrow-handle completion and cancellation define history and persistence boundaries.
- **Persistence**: Existing main-scene PATCH path with versioning; no schema migration expected.
- **Testing**: Vitest unit/component tests, existing React Testing Library setup, and manual browser validation for drag/reload behavior.
- **Performance**: Intermediate pointer updates must not cause history snapshots or database writes; normal visual dragging must remain responsive. No new numeric latency target is required by the specification.

## Scope alignment with the supplied collaboration references

The supplied user input asks for Yjs-based live collaboration matching React Flow's Collaborative example. That is a separate feature from the loaded `002-atomic-node-undo` specification: FR-016 explicitly excludes live multi-user editing, presence, identity, permissions, conflict resolution, and offline collaboration. The references were reviewed to prevent an incorrect implementation decision here:

- React Flow's current Collaborative example identifies `yjs` and `y-websocket` as its integration dependencies and uses a room-scoped collaborative graph.
- Yjs provides shared types, transaction/update events, and observers; a provider transports updates between clients.
- `y-websocket` provides room synchronization plus Awareness for ephemeral presence/cursor state, and supports provider authentication parameters.
- Therefore, Yjs should not be added to this atomic-history feature as an incidental dependency. A dedicated collaboration specification should define room identity, authorization, provider/server deployment, document schema, awareness/presence, persistence, reconnect/offline behavior, and how remote updates interact with local Undo/Redo.

This research resolves the collaboration-related integration unknown by recording it as out of scope for this branch, rather than silently treating durable scene persistence as live collaboration.
