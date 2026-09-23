# Quickstart: Validate Atomic Node Gesture History

## Prerequisites

- Repository dependencies installed with pnpm.
- A configured local OpenViz database and authenticated test account.
- A project containing at least one sticky note and one additional Workbench node.
- Browser access to the local OpenViz app.

## Automated checks

Run the focused logic and component tests first:

```bash
pnpm exec vitest run \
  src/store/slices/workbenchSlice.test.ts \
  src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts \
  src/components/nodes/ArrowNode.test.tsx \
  src/services/workbench/sceneSyncBus.test.ts
```

Run the complete quality gates:

```bash
pnpm run lint
pnpm run build
pnpm test -- --run
```

Expected outcomes:

- Repeated movement updates produce one history action after release.
- Undo and Redo restore exact before/after states for single and grouped movement.
- Resize and arrow-handle gestures are each one history action.
- No-op and cancelled gestures produce no history action or completed save.
- Persistence-related tests verify final state writes and diagnostic failure handling.

## Manual browser validation

1. Start the app with `pnpm run dev`.
2. Open a Workbench project containing the sticky note with text `Test`.
3. Select the note and drag it through at least three intermediate positions before releasing.
4. Click Undo once. Verify that the note returns directly to its original position rather than stepping through drag points.
5. Click Redo once. Verify that the note returns directly to its final dropped position.
6. Repeat with two selected nodes. Verify that the entire group restores together with one Undo.
7. Resize a node through multiple intermediate dimensions. Verify one Undo restores its original dimensions and position.
8. Move an arrow start, end, or control handle through multiple points. Verify one Undo restores the complete original geometry.
9. Perform a click without movement. Verify that Undo history does not gain an extra action.
10. Interrupt a gesture, where the browser path permits reliable cancellation. Verify the node returns to its pre-gesture state and no completed save is issued.
11. Reload the project after a completed gesture. Verify the final dropped state is present and no intermediate position is loaded.
12. Simulate a save failure or offline request. Verify the local final state remains visible and diagnostic information appears in the console or TanStack Query developer tools when applicable.

## Persistence contract reference

See [`contracts/scene-persistence.md`](contracts/scene-persistence.md) for the existing scene read/write behavior, version conflict handling, and failure expectations.

## Latest automated validation

- `pnpm exec tsc --noEmit`: passed.
- `pnpm run lint`: passed.
- `pnpm run build`: passed.
- `pnpm exec vitest run`: passed — 28 test files, 163 tests.
- `git diff --check`: passed.
- Manual browser validation: pending.
