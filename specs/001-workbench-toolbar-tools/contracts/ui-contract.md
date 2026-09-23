# UI Contract: Workbench Toolbar Tools

**Feature**: 001-workbench-toolbar-tools | **Date**: 2026-09-21

Behavioral contract for the workbench toolbar and its tools. Each clause is testable; task tests derive from these IDs (C-xx).

## C-1: Toolbar structure
- C-1.1 Toolbar shows exactly eight buttons in order: Select, Hand, Draw, Eraser, Arrow, Text, Note, Media (FR-001).
- C-1.2 Each button exposes a tooltip/`title` containing the tool label and its shortcut key, e.g. "Arrow (A)".
- C-1.3 The active tool's button is visually distinct (pressed state, `aria-pressed="true"`); all others are unpressed.
- C-1.4 Media button opens a submenu containing **Upload** and **Upload from phone** (FR-012). An additional "Create new" section may be present for pre-existing sketch-format creation (FR-017) but MUST NOT introduce out-of-scope node types (see C-1.5).
- C-1.5 "Create new" style submenus (if present) contain only the in-scope tools; no ComfyUI node types.

## C-2: Tool activation
- C-2.1 Clicking a toolbar button activates that tool immediately and updates pressed states (FR-002).
- C-2.2 Pressing V/H/D/E/A/T/N/M without modifiers activates the corresponding tool; `preventDefault` is called (FR-002).
- C-2.3 Shortcuts are ignored while focus is in an input, textarea, or contenteditable element (FR-003).
- C-2.4 Modifier shortcuts (Mod+z/y/c/v/d), Delete/Backspace, and `[`/`]` behavior are unchanged (spec edge case).

## C-3: Mode behavior
- C-3.1 Select mode: click-select, multi-select, box select enabled; nodes draggable (FR-004).
- C-3.2 Hand mode: canvas pans on drag; node selection/dragging disabled (FR-005).
- C-3.3 Draw mode: freehand strokes capture pointer input; sticky across strokes (FR-006, existing behavior).
- C-3.4 Eraser mode: erases strokes; sticky (FR-006, existing behavior).

## C-4: One-shot tools
- C-4.1 Arrow: drag creates an arrow from start to end point; on release the tool auto-switches to Select and the new arrow is selected (FR-007).
- C-4.2 Text: click places a text item with default content at that position; auto-switch + select (FR-007/FR-009).
- C-4.3 Note: click places a note item; auto-switch + select (FR-007/FR-010).
- C-4.4 Media upload: file picker accepts `image/*` only; non-image files are rejected with no node created (FR-012); on success an image node appears near viewport center, tool returns to Select, node is selected.
- C-4.5 "Upload from phone" opens the existing phone-upload modal flow (placeholder acceptable per FR-014) — must give explicit feedback (toast or modal), never a silent no-op.

## C-5: Item interactions
- C-5.1 Arrow: endpoints and midpoint control are draggable in Select mode; path updates live; releasing outside canvas is harmless (spec edge case).
- C-5.2 Resizing an arrow node re-scales start/end/control proportionally — no distortion (spec edge case).
- C-5.3 Text/Note: single-click selects; double-click enters edit mode; Enter inserts newline while editing; blur or Escape exits edit mode without losing content (FR-009/FR-010, spec edge case).
- C-5.4 Media: failed image load renders a fallback state (icon + alt text), not a broken-image glyph (FR-013).

## C-6: Coexistence & policy
- C-6.1 All new tools coexist with Select/Hand/Draw/Eraser; switching never loses existing canvas content (SC-005).
- C-6.2 Arrow, Text, Note, and Media nodes are excluded from connection creation in v1 (FR-015); existing node types remain connectable.
