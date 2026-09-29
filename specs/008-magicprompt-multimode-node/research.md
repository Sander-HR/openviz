# Research: Shared Multi-Mode Generation Node

**Feature**: `008-magicprompt-multimode-node` | **Date**: 2026-09-28

## R1: Shared node representation

- **Decision**: Introduce a shared generation-node representation with a discriminated mode (`base`, `variation`, `new-view`, `extract`) and a per-mode configuration object. Keep a compatibility boundary that maps legacy `variate`, `new-view`, and `extract` nodes into the shared representation when scenes are loaded.
- **Rationale**: FR-001, FR-008, and FR-011 require one canvas node with lossless mode transitions and legacy compatibility. A discriminated mode keeps rendering exhaustive and avoids duplicated node state.
- **Alternatives considered**: Keep three node types and share only visual components (rejected: violates the single-node requirement); store mode in untyped JSON (rejected: violates the constitution's type-safety principle).

## R2: Connection semantics

- **Decision**: The shared generation node exposes exactly one target handle and accepts an image source. Extend the existing connection policy to permit `image -> shared-generation`; enforce a one-inbound cap and replace the prior source when a new image is connected. Preserve the canonical `image-source` source handle.
- **Rationale**: FR-005, FR-009, and the specification edge cases require a reference image prerequisite, exactly one input, and replacement without losing mode configuration.
- **Alternatives considered**: Add multiple reference handles (rejected: contradicts FR-009); bypass the policy in the component (rejected: connection rules belong in the service layer and must be testable).

## R3: State and undo/redo

- **Decision**: Store mode and mode configuration as node properties in the existing Zustand workbench state. Route mode transitions and field edits through the existing node-data update path so each user action participates in workbench history.
- **Rationale**: FR-008 and FR-013 require lossless persistence and undo/redo; the existing store already snapshots node property changes.
- **Alternatives considered**: Local React state (rejected: not persisted and not undoable); a new feature-specific store (rejected: duplicates the established workbench state architecture).

## R4: Generation service boundary

- **Decision**: Keep generation requests behind `src/services/renderService.ts` and its existing target implementations. Add or adapt a typed shared-generation request only where required by the current backend contract; components invoke typed callbacks/hooks, never backend clients directly.
- **Rationale**: The constitution and existing architecture require service-owned integration and backend neutrality. The feature scope is primarily state and UI; generation remains an existing pipeline concern.
- **Alternatives considered**: Add fetch calls to node components (rejected: violates state/service boundaries); create a new backend-specific endpoint (rejected: unnecessary for the UI state-machine feature).

## R5: Accessible mode controls

- **Decision**: Use semantic buttons, labels, radiogroup/segmented controls, listbox/select behavior, and an accessible info control. Keep focus and keyboard behavior in the component layer and test user-visible state changes with React Testing Library.
- **Rationale**: FR-002, FR-004, FR-005, FR-006, and FR-012 require editable controls and discoverable descriptions. Accessible primitives satisfy the constitution without pixel-only tests.
- **Alternatives considered**: Canvas-only controls (rejected: poor keyboard and screen-reader behavior); custom unlabelled div click targets (rejected: inaccessible and difficult to test).

## R6: File boundaries

- **Decision**: Split shared node types, mode state helpers, connection normalization, and mode body views by concern. Keep each touched file below 300 lines; extract pure transition/validation helpers for strict unit testing.
- **Rationale**: Constitution V and the repository's existing node-component pattern require small, testable modules.
- **Alternatives considered**: One monolithic shared node component (rejected: likely exceeds the limit and couples unrelated mode behavior).
