# Feature Specification: Workbench Toolbar Tools

**Feature Branch**: `001-workbench-toolbar-tools`

**Created**: 2026-09-21

**Status**: Implemented

**Input**: User description: "Implement the workbench toolbar tools per specs/001-workbench-toolbar-tools/spec.md — tool order Select/Hand/Draw/Eraser/Arrow/Text/Note/Media, shortcuts V/H/D/E/A/T/N/M, sticky Draw/Eraser, one-shot Arrow/Text/Note/Media with auto-switch to Select, image-only media picker, non-connectable Arrow/Text/Note nodes in v1. Preserve existing selection and drawing behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch workbench modes by mouse or keyboard (Priority: P1)

A designer working on the workbench needs to change what their pointer does — select and arrange items, pan around the canvas, or draw. They expect a visible toolbar with all tools in a stable order, plus single-key shortcuts so they never have to reach for the mouse. The active tool is always obvious at a glance.

**Why this priority**: Tool switching is the entry point for every other capability in this feature. Without reliable mode switching, no creation flow works. It is independently valuable: even before new node types exist, correct Select/Hand/Draw/Eraser modes restore and unify behavior that currently needs ad-hoc toggles.

**Independent Test**: Open the workbench, click each of the 8 toolbar buttons and press V/H/D/E/A/T/N/M; verify the active tool indicator follows both inputs, that Select supports multi-select (Cmd/Ctrl+Click) and box select (Shift+Drag), that Hand pans without selecting or dragging nodes, and that Draw/Eraser stay active after use.

**Acceptance Scenarios**:

1. **Given** the workbench is open in any mode, **When** the user clicks a toolbar tool or presses its shortcut key, **Then** that tool becomes active and is visually indicated in the toolbar.
2. **Given** Select mode is active, **When** the user Cmd/Ctrl+Clicks multiple items or Shift+Drags across them, **Then** all touched items are selected together and can be moved as a group.
3. **Given** Hand mode is active, **When** the user drags on the canvas, **Then** the view pans and no item is selected or moved.
4. **Given** Draw or Eraser mode is active, **When** the user completes a stroke or erase action, **Then** the tool remains active for the next stroke until another tool is chosen.
5. **Given** any text field on screen (input, textarea, or editable region) has focus, **When** the user presses a tool shortcut key, **Then** the key is typed into the field and no tool switch occurs.

---

### User Story 2 - Create arrows, text, and notes with one-shot tools (Priority: P2)

A designer wants to annotate their work: draw a curved arrow between ideas, drop a free-floating label, or pin a sticky note. Each creation tool should place exactly one item, then hand control back to Select with the new item already selected — so they can immediately move, resize, or edit it without re-selecting.

**Why this priority**: The annotation tools are the visible payoff of the toolbar and the reason users pick it up daily. They depend on mode switching (P1) but deliver the primary "create something new" value.

**Independent Test**: With P1 working: press A, click-drag on the canvas → a curved arrow appears, tool returns to Select, arrow is selected; drag its start/end endpoints and midpoint control to reshape it. Press T, click → text node appears and is selected; double-click to type (Enter creates multiline); single-click elsewhere selects without editing. Press N, click → sticky-style note appears; double-click to edit.

**Acceptance Scenarios**:

1. **Given** Arrow tool is active, **When** the user clicks and drags on the canvas, **Then** a curved arrow is placed along the drag direction and the tool automatically returns to Select with the new arrow selected.
2. **Given** an arrow is selected, **When** the user drags its start endpoint, end endpoint, or midpoint control, **Then** the curve updates live to follow the dragged point.
3. **Given** Text tool is active, **When** the user clicks on the canvas, **Then** a text node with a transparent background is placed and selected; double-clicking it enters edit mode where Enter creates multiline content; single-clicking selects without editing.
4. **Given** Note tool is active, **When** the user clicks on the canvas, **Then** a sticky-note-styled note is placed and selected; double-click enters edit mode, single-click selects.
5. **Given** any of Arrow/Text/Note, **When** the user attempts to connect it to another item with a connector, **Then** no connection can be created (v1 limitation).

---

### User Story 3 - Add images to the workbench (Priority: P2)

A designer wants to bring reference images or exported assets onto the canvas. From the Media tool's submenu they pick "Upload", choose an image file, and see it appear as a node at a sensible position in their current view — ready to move and resize like everything else.

**Why this priority**: Images are the most common external asset in design work; without them the workbench cannot hold mixed media. Independent of Story 2's annotation tools (separate submenu path).

**Independent Test**: Open Media → Upload, select a JPG/PNG/WebP file → an image node appears near the viewport center within ~2s, is selected, and can be moved/resized; selecting a non-image file is impossible from the picker.

**Acceptance Scenarios**:

1. **Given** the Media submenu is open, **When** the user chooses Upload and selects an image file, **Then** an image node displaying that file is created at a sensible position in the current view and selected.
2. **Given** an image node, **When** the image cannot be loaded or fails to load later, **Then** the node shows a clear fallback state (not a broken/empty box with no explanation).
3. **Given** the file picker opened by Upload, **When** the user browses files, **Then** only image files are selectable.

---

### User Story 4 - Secondary media actions (Priority: P3)

The Media submenu also offers "Upload from phone" (not yet built — must say so honestly) and "Create new" with the existing size options for sketch formats (preserving the current flow exactly).

**Why this priority**: These are convenience/continuity items; the phone action is a placeholder whose only job is honest communication, and Create-new must not regress an existing capability.

**Independent Test**: Media → Upload from phone shows explicit "coming soon"-style feedback with no errors; Media → Create new lists the existing sizes and creates a sketch exactly as before.

**Acceptance Scenarios**:

1. **Given** the Media submenu is open, **When** the user chooses Upload from phone, **Then** they receive clear feedback that this capability is not yet available, and nothing breaks on the canvas.
2. **Given** the Media submenu is open, **When** the user chooses Create new and picks a size, **Then** a sketch of that size is created using the existing behavior.

---

### Edge Cases

- Pressing tool shortcuts while typing in any text input, textarea, or editable region must not switch tools.
- Existing keyboard shortcuts (copy/paste/duplicate/delete/reorder) must continue to work unchanged alongside the new V/H/D/E/A/T/N/M keys.
- Resizing an arrow node must re-normalize its endpoints and control point so the shape is preserved without distortion.
- Deleting a media node must release its image resource so repeated add/remove cycles do not leak memory.
- Switching to Hand mode while an item is selected must disable dragging/selection of items until another mode is chosen; switching back to Select restores normal behavior.
- Placing a one-shot tool's item at the canvas edge or far from the viewport must still land inside the visible area (sensible default position).
- A non-image file dropped into or selected by the Upload flow is rejected with clear feedback, never a broken node.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The workbench toolbar MUST display exactly these tools in this order: Select, Hand, Draw, Eraser, Arrow, Text, Note, Media.
- **FR-002**: Every tool MUST be activatable by clicking its toolbar button AND by a single-key shortcut (V=Select, H=Hand, D=Draw, E=Eraser, A=Arrow, T=Text, N=Note, M=Media); the active tool MUST be visually indicated.
- **FR-003**: Tool shortcuts MUST be suppressed while focus is in any text input, textarea, or editable region.
- **FR-004**: In Select mode the user MUST be able to: single-click select, Cmd/Ctrl+Click multi-select, Shift+Drag box-select, and drag items to move them (including groups).
- **FR-005**: In Hand mode dragging MUST pan the view; item selection and item dragging MUST be disabled while Hand is active.
- **FR-006**: Draw and Eraser MUST be sticky tools — they remain active after each use until another tool is selected.
- **FR-007**: Arrow, Text, Note, and Media MUST be one-shot tools — after an item is created, the tool automatically returns to Select and the newly created item MUST be selected.
- **FR-008**: The Arrow tool MUST place a curved arrow via click-drag; its start endpoint, end endpoint, and midpoint control MUST each be individually draggable to reshape the curve.
- **FR-009**: The Text tool MUST place an editable text node on click: transparent background by default, double-click enters edit mode, single-click selects, Enter creates multiline content.
- **FR-010**: The Note tool MUST place a sticky-note-styled note on click with the same select/edit interaction as Text.
- **FR-011**: The Media tool MUST open a submenu containing: Upload, Upload from phone, and Create new (with the existing size options).
- **FR-012**: Upload MUST open an image-only file picker; the selected image MUST become a media node at a sensible position in the current view.
- **FR-013**: A media node whose image fails to load MUST show a clear fallback state.
- **FR-014**: Upload from phone MUST display explicit "not yet available" feedback without errors or broken canvas state.
- **FR-015**: Arrow, Text, and Note items MUST NOT be connectable to other items in v1.
- **FR-016**: All new item types (Arrow, Text, Note, Media) MUST support selection, moving, and resizing; resizing an arrow MUST preserve its shape without distortion.
- **FR-017**: All pre-existing workbench capabilities (selection, pan/zoom, draw/erase, clipboard, layer-order shortcuts, existing node types) MUST continue to behave exactly as before.

### Key Entities *(include if feature involves data)*

- **Active tool state**: the single source of truth for which tool is currently active; every mode-dependent behavior derives from it.
- **Arrow item**: start point, end point, curve control point, stroke color and width.
- **Text item**: content, font size, color; transparent background by default.
- **Note item**: content, visual color variant; sticky-note styling.
- **Media item**: image source, alt text, media type (image only in v1).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch between any two tools in under 2 seconds using either the mouse or a keyboard shortcut.
- **SC-002**: 100% of the eight tools are reachable by a single key press (no menus) and by one toolbar click; the active tool is identifiable without moving the pointer to the toolbar.
- **SC-003**: After creating an item with any one-shot tool, the user is back in Select mode with the new item selected in zero additional steps.
- **SC-004**: An uploaded image appears as a visible, selectable node within 2 seconds of file selection.
- **SC-005**: Zero regressions in pre-existing workbench behavior — verified by the existing automated test suite passing plus a manual interaction matrix (select/multi-select/pan/draw/erase/clipboard/layers) with no behavior changes.

## Assumptions

- v1 scope is image-only media: video upload is out of scope; "Upload from phone" is an honest placeholder, not a working flow.
- Arrow/Text/Note items are non-connectable in v1; connectors between them arrive in a later version if needed.
- The existing canvas drawing (freehand draw/erase) behavior is preserved and reused as-is under the Draw/Eraser tools.
- "Create new" reuses the existing sketch-format size list without changes to its options or behavior.
- Target environment is a desktop browser for a single signed-in user; mobile/touch-first interaction is out of scope for v1.
- Media images have no permanent asset library in v1 — they live only as long as the session/canvas; releasing them when a node is deleted is required.
- Clarified 2026-09-21: new items from one-shot tools are placed near the center of the current viewport (clamped to stay visible); uploaded images use the same placement rule.
- Clarified 2026-09-21: Note color variant is a small fixed palette (3–4 colors) with a default; choosing among variants is out of scope for v1 (default applies on creation).
- Verified against codebase during clarification: tool shortcut keys V/H/D/E/A/T/N/M do not collide with existing single-key bindings (existing shortcuts are modifier-combos or `[`/`]`/Delete), and input/contenteditable focus suppression already exists in the WIP shortcut handler.
