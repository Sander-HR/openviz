# Quickstart: Shared Multi-Mode Generation Node

**Feature**: `008-magicprompt-multimode-node` | **Date**: 2026-09-28

## Prerequisites

```bash
pnpm install
pnpm run dev
```

Open `/projects/<id>/workbench` with at least one image node.

## Automated Gates

```bash
pnpm exec vitest run src/components/nodes src/services/workbench
pnpm exec tsc --noEmit
pnpm run lint
```

Run the full suite before merge:

```bash
pnpm test
```

## Scenario 1: Base and mode selection

1. Add the shared generation node through the Modify entry.
2. Confirm the base prompt and five preset actions are visible.
3. Confirm Instant Render and Change expression are disabled.
4. Select Variate form and color, New view, and Extract in separate runs.
5. Confirm each specialized header has a back control, icon, label, and info control.

**Expected**: each selection transitions in place without a blank state.

## Scenario 2: New View prerequisites and connection

1. Add a shared generation node and select New view.
2. Confirm the view selector shows `Select a view` and Generate is disabled.
3. Connect an image node to the generation node.
4. Select a named view.
5. Confirm the reference count is `1` and Generate becomes enabled.
6. Connect a different image source.
7. Confirm the inbound connection is replaced and the selected view remains unchanged.

## Scenario 3: Lossless mode transitions

1. Enter Variation Form mode and change labels, center position, and preset.
2. Return to base using the header back control.
3. Re-enter Variation and verify every value remains.
4. Repeat with New View selected view and Extract settings.
5. Use undo and redo after a mode transition and after a configuration edit.

## Scenario 4: Legacy compatibility

1. Open a saved scene containing legacy Variate, New View, or Extract nodes.
2. Confirm each appears as the shared generation node in the corresponding mode.
3. Confirm prior configuration and valid source connections remain.

**Expected**: no data loss and no second input handle.
