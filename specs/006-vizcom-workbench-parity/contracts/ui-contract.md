# UI Contract: Vizcom Workbench UI Parity

**Feature**: `006-vizcom-workbench-parity` | **Date**: 2026-09-26

Behavioral contracts for the new/changed surfaces. These are testable acceptance-level
contracts (mirroring spec FRs and ui-translation §3); component behavior tests in tasks.md
map 1:1 to the C-x.y items.

## C-1 Canvas theme (FR-015, US1)

- C-1.1 The top-left application menu contains a Light/Dark canvas control with exactly two
  options; **Light** is the default on first load.
- C-1.2 Selecting Dark changes only the canvas background and dot grid immediately (no
  reload); node cards, toolbars, menus and panels are visually unchanged.
- C-1.3 The preference persists across sessions (localStorage) and re-applies on next open.
- C-1.4 Switching theme while floating toolbars/prompt panels are open restyles them in
  place — no dismissal, no re-anchoring jump.

## C-2 Node selection toolbar (FR-002, US2)

- C-2.1 Selecting an image node renders a floating toolbar above the node (8px gap) with,
  left→right: Edit, aspect-ratio chip, quick actions (Download, Copy raw image, Add to
  library), More (⋯) trigger.
- C-2.2 Aspect-ratio chip menu lists exactly: 1:1, 4:5, 5:4, 2:3, 3:2, 9:16, 16:9; selecting
  one updates the node and closes the menu.
- C-2.3 Only the active (last-clicked) node shows a toolbar; multi-selection shows a single
  toolbar with a selection-count badge.
- C-2.4 The toolbar stays anchored through pan/zoom and flips/clamps at viewport edges so it
  is never clipped.

## C-3 "More" menu (FR-003, US2)

- C-3.1 Menu width 206px; groups in order — Image (Remove Background · Download · Export… ·
  Copy raw image), Library & references (Add to library · Add to reference images · Set as
  thumbnail · Restore default thumbnail), Organization (Wrap in section · Bring to front `]`
  · Send to back `[`), Clipboard (Copy link to selection `⌘L` · Copy `⌘C` · Duplicate `⌘D`),
  Danger (Delete `Del`) — separated by dividers.
- C-3.2 Every item with an assigned shortcut renders a right-aligned `<Kbd>` hint.
- C-3.3 Items invalid for the current selection are disabled (`opacity-40`, not clickable);
  multi-selection enables only actions valid for the whole selection.
- C-3.4 The menu repositions near viewport edges so it is fully visible (Radix collision).
- C-3.5 Escape closes and returns focus to the trigger; keyboard navigation works top→bottom.
- C-3.6 Actions whose backend is not yet available are disabled with a tooltip explaining why
  (R11); they remain visible in their group.

## C-4 Add-node menu (FR-004, US3)

- C-4.1 Trigger is the first top-toolbar button (`+`, tooltip "Add node"); panel width
  222px with upload rows ("Upload an image" `I`, "Upload from phone" `/`), divider, then a
  two-column icon grid: Sketch, Instant Render, Animate, Modify, Variate, Extract, New View,
  Text, Sticky Note, Section, Media/Video.
- C-4.2 The render node is labeled **"Instant Render"** (node type unchanged).
- C-4.3 Choosing a type creates the node at canvas center (cursor for one-shot tools) in its
  default state and closes the menu; legacy types are excluded from the v1 grid (if shown
  later, they carry a LEGACY badge and stay out of the default flow).
- C-4.4 Pressing `I` / `/` with no menu open starts the corresponding upload flow directly.

## C-5 Prompt panel (FR-006, US4)

- C-5.1 Selecting Render/Modify/Variate/New View/Extract attaches a panel below the node
  (width max(node, 280px), capped 360px; flips above when near the bottom edge).
- C-5.2 Panel shows header (type icon + label + close X), reference chips row (numbered,
  removable, + add-reference chip), prompt editor (placeholder "Describe your changes (use @
  to reference images or assets)"), settings rows (Aspect Ratio, Mode Auto/Pro, Resolution
  1K/2K), and a full-width Generate button.
- C-5.3 Typing `@` in the editor opens the reference picker (filtered project
  images/assets); selecting inserts a chip token.
- C-5.4 Generate is disabled with a clear reason when required inputs are missing; failure
  shows an inline error with inputs preserved.
- C-5.5 Render/Modify nodes show **no inline form** when unselected — only a collapsed
  summary of last prompt + settings (FR-006).

## C-6 New node types (FR-005, FR-007, US5)

- C-6.1 Variate: prompt editor, Count (2/4/8), optional Vary (form/color/both); Generate
  disabled until a source image is connected and prompt or vary-mode is set; output grid of
  variations with per-image hover actions.
- C-6.2 New View: view selector with named views + "Select a view" placeholder, reference
  count chip; Generate disabled until a view is chosen and ≥1 reference connected; output is
  a single image captioned with the view name.
- C-6.3 Extract: optional prompt, background handling (transparent/keep), Count; Generate
  disabled until a source image is connected.

## C-7 Top toolbar & shortcuts (FR-008, FR-009, US6)

- C-7.1 Toolbar order: + · Library · Select `V` · Text `T` · Sticky Note `N` · Section ·
  Smart Dropper `Y` · Draw `D` · Eraser `E` · Arrow `A` · Undo `⌘Z` · Redo. Every button has
  a bottom-side tooltip with name + shortcut where assigned.
- C-7.2 Shortcuts fire the same action as the menu/toolbar equivalent and are inert while a
  menu, modal, or editor owns focus.

## C-8 Export modal (FR-010, US6)

- C-8.1 Top-right Export button opens a centered dialog: left column lists selected assets;
  right column shows Export format (JPEG/PNG), Quality (0–100%), Scaling (Original/2K/4K
  upscaling), and a source preview; full-width Export button at the bottom.
- C-8.2 With no assets selected, the list is empty and Export is disabled with a clear reason.
- C-8.3 Pressing Export produces one download per selected asset matching format/quality;
  2K/4K uses the active backend's `upscale` operation when supported, otherwise client-side
  resize (R6).
- C-8.4 There is **no Share button** in v1.

## C-9 Smart Dropper (FR-016, US6)

- C-9.1 Activating the tool (`Y` or toolbar) shows a capture-type dropdown with exactly:
  Style, Color, Environment.
- C-9.2 Click on empty canvas / unselected node / non-image node → pixel color sampled and
  set as the drawing tool's color; no attribute chip is created.
- C-9.3 Click inside a **selected** image node with a type chosen → one captured-attribute
  chip appears (removable). Failed image load → inline error, no chip.
- C-9.4 Dropping the chip onto an image node starts generation of a **new** image node with
  the attribute applied (style / palette / environment); originals unchanged. Drop on
  non-image or empty canvas → invalid-target feedback, nothing applied. Same-type drop on a
  target that already has one replaces the previous.

## C-10 Edges & zoom cluster (FR-011, FR-012)

- C-10.1 Edge remove affordance appears on edge hover or when either endpoint is selected;
  styled to the token set; activation removes the edge.
- C-10.2 Zoom cluster keeps existing controls (fullscreen, fit, in/out, %, shortcuts help),
  restyled to tokens; percentage opens a popover with presets (25/50/75/100/fit).

## C-11 Accessibility (FR-013) — applies to all new surfaces

- C-11.1 Every new menu/popup/panel is keyboard-navigable, focus-managed, Escape-dismissible,
  and built on the shadcn/Radix primitives in `src/components/ui/`.
- C-11.2 Menu items expose accessible names including their shortcut hints; disabled items
  are not focusable.
