# UI Contract: Shared Multi-Mode Generation Node

**Feature**: `008-magicprompt-multimode-node` | **Date**: 2026-09-28

## Base State

- Header identifies the shared generation node and has no back action.
- Editable prompt field has placeholder `Describe your changes`.
- Preset list contains Instant Render, Variate form and color, New view, Change expression, and Extract.
- Instant Render and Change expression are visible but disabled in v1.

## Specialized State

- Header contains a back control, mode icon, mode label, and accessible info control.
- Back returns to base without resetting mode configuration.
- New View body includes a clickable view selector, a reference count, and Generate.
- New View Generate is disabled unless a view is selected and one image reference is connected.
- The node exposes one visible target handle for the source image.

## Accessibility and Interaction

- Controls use semantic buttons, labels, and keyboard-operable selection patterns.
- Disabled actions expose their disabled state and a visible reason where applicable.
- Mode configuration updates are immediately reflected in the node and are undoable.
- Existing mode configuration is restored after base → mode round trips.
