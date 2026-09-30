# Feature Specification: Vizcom Workbench UI Parity

**Feature Branch**: `006-vizcom-workbench-parity`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Do a gap analysis of the functions in the vizcom workbench and our projects/[id]/workbench. Look at UI design and functionalities (popup menus, panels) in all detail. Translate that to shadcn, tailscale CSS and new node and popup specifications"

## Gap Analysis Summary

A detailed inspection of the reference product's workbench (app.vizcom.com) against our
`projects/[id]/workbench` route produced the following findings. The component-level
translation (design tokens, shadcn primitives, Tailwind classes, new node and popup
specifications) is maintained in the companion document
[ui-translation.md](./ui-translation.md).

**Reference product observations (verified via DOM inspection):**

1. **Theme-aware visual language.** The reference workbench opens with a light canvas and
   dot grid. A theme control in the top-left application menu switches the canvas to a
   dark background. The dark canvas uses `#161616`; node cards and floating panels use
   `#242425`, menu surfaces use `#2F2F31` with a `1px #3C3C3E` border, muted text uses
   `#808085`, and the accent is `#4C4CEF`. Radii: 8px (menus/nodes), 12px (floating
   panels). Shadow: `0 2px 4px rgba(0,0,0,0.25)`. Inter typeface, 12px chrome base size.
2. **Node selection toolbar.** Selecting an image node shows a floating toolbar above it:
   Edit action, aspect-ratio chip (e.g. `1:1`, `2:3`), quick-action icon buttons, and a
   "more" (⋯) trigger.
3. **"More" menu (⋯).** 206px wide, grouped items with right-aligned keyboard-shortcut
   hints: Remove Background · Download · Export… · Copy raw image · Add to library · Add
   to reference images · Set as thumbnail · Restore default thumbnail · Wrap in section ·
   Bring to front `]` · Send to back `[` · Copy link to selection `⌘L` · Copy `⌘C` ·
   Duplicate `⌘D` · Delete `Del`.
4. **Add-node menu (+).** 222px floating panel: upload list (Upload an image `I`, Upload
   from phone `/`) plus a two-column icon grid of node types — Sketch, Instant Render,
   Animate, Modify, Variate, Extract, Try on, Style (LEGACY), Mix (LEGACY), Render
   (LEGACY). Deprecated types carry a visible LEGACY badge.
5. **Attached prompt panel.** Selecting a generation node attaches a panel below it:
   header with node-type label and close action; rich prompt editor supporting `@`
   references to images/assets; numbered reference-image chips; settings rows for Aspect
   Ratio, Mode (e.g. Pro), Resolution (e.g. 1K); primary Generate action.
6. **Node catalog.** Image, Sketch, Render, Modify, Animate, Variate, Extract, New View
   (named views such as "Rear", "Rear Right 3/4" with a view selector, reference count
   chip and Generate), plus legacy types.
7. **Top toolbar.** Add node, Library, Select `V`, Text `T`, Sticky Note `N`, Section,
   Smart Dropper `Y`, Undo `⌘Z`, Redo — every button has a tooltip with its shortcut.
8. **Top-right cluster.** Export and Share actions plus the user avatar.
9. **Zoom cluster (bottom-right).** Current zoom percentage with expand control.
10. **Edges.** Hover/selection reveals a "Remove Connector" affordance on the edge.
11. **Bottom-left utility dock.** A row of ~9 small icon buttons was observed once; it is
    state-dependent and could not be re-triggered or identified during analysis.

**Our current workbench observations:**

- Light canvas (white with dot grid) hosting dark node cards. This is the reference
   default. The top-left application menu provides the control to switch the canvas to a
   dark theme; the gaps are that chrome surfaces do not share one token language yet and
   our workbench does not currently expose the same theme control.
- Top toolbar: Select/Draw/Eraser/Arrow/Text/Note/Media + Undo/Redo; Media opens a small
  dropdown (Upload, Upload from phone, Create new → sketch formats). No add-node grid, no
  Library/Section/Smart Dropper tools, no shortcut hints in menus.
- Nodes: Render, Animate, Modify, Image, Video, Text, Note, Arrow, Freehand, Media — each
  with inline settings forms (prompt, style, count, influence). No per-node floating
  selection toolbar; image nodes only expose hover actions (e.g. fullscreen preview).
- Context menu: basic reorder/copy/paste/duplicate/delete without shortcut hints or
  grouping.
- Top-right: compute status popover + collaboration chip (no Export/Share).
- Zoom cluster present (fullscreen, fit, zoom in/out, percentage, shortcuts help) — richer
  than the reference; keep and restyle.

**Identified gaps (this feature closes them):**

| # | Gap | Priority |
|---|-----|----------|
| G1 | No shared token language for workbench chrome; no top-left canvas theme control matching the light default and dark-mode option | P1 |
| G2 | No floating node-selection toolbar or "more" menu on selected nodes | P1 |
| G3 | No rich add-node menu (grid of node types, shortcut hints, legacy badges) | P1 |
| G4 | Prompt editing is inline per node; no attached prompt panel with `@` references, reference chips, aspect/mode/resolution settings | P2 |
| G5 | Missing node types: Variate, New View (multi-view), Extract | P2 |
| G6 | Top toolbar missing Library, Section, Smart Dropper; no Export/Share top-right; no shortcut hints in tooltips/menus | P3 |
| G7 | Edge remove affordance and zoom cluster not restyled to the shared language | P3 |
| G8 | Bottom-left utility dock (contents unverified) — deferred | Deferred |

## Clarifications

### Session 2026-09-26

- Q: For v1, should the Smart Dropper capture color only from the canvas background, or also eyedropper colors from pixels inside node images? → A: The eyedropper absorbs style, color, and environment from within a selected image node (canvas-only sampling is insufficient; behavior detailed in FR-016).
- Q: For Render/Modify nodes that are not currently selected, should their existing inline settings forms be kept as a fallback, or should the attached prompt panel be the only prompt-entry surface? → A: Remove inline forms; attached prompt panel on selection only, with a collapsed prompt/settings summary shown when unselected.
- Q: In v1, what exactly should the top-right Export and Share buttons do? → A: Discard the Share button. Export opens a centered export modal listing selected assets on the left with options on the right — Export format (JPEG, PNG), Quality (0–100%), Scaling (Original, 2K, 4K upscaling) and a source preview — plus an Export button at the bottom of the modal.
- Q: What dot-grid color and opacity should the dark canvas use? → A: `#2a2a2c` at 100% opacity — subtle low-contrast dots on the near-black canvas; the light default keeps its current two-layer dot pattern.
- Q: In the v1 add-node menu, should the existing render node be labeled "Instant Render" to match the reference product, or keep the label "Render"? → A: Label it "Instant Render" in the add-node menu (node type unchanged).
- Q: How does the user choose which attribute the smart dropper captures, and how are captured attributes applied? → A: The Smart Dropper has a dropdown list to select Style, Color, or Environment. Style copies the visual style of the source image; dropping it onto another image node renders a new image with that style applied. Color captures the image's color palette; dropping it onto another image renders a new image with that palette applied. Environment works the same way: captured from the source image and dropped onto another image to render a new image in that environment.
- Q: When dropping a captured Style attribute, should the target image be re-rendered in place? → A: No — dropping any captured attribute (including Style) renders a new image on the canvas; the original images are never modified.

## User Scenarios & Testing

### User Story 1 - One consistent workbench surface with a configurable canvas theme (Priority: P1)

A designer opens a project's workbench and sees one cohesive surface: dark node cards on
a light canvas with a dot grid (the reference default), with every toolbar, panel and menu
sharing the same visual language as the studio. From the top-left application menu, the
designer can switch only the canvas background and dot grid to dark; node cards stay dark
in both themes. Nothing looks like a different product or theme.

**Why this priority**: Visual consistency is the foundation every other parity item sits
on; without it, added features read as patches rather than one product.

**Independent Test**: Open any project workbench and visually audit every surface
(canvas, nodes, toolbar, menus, zoom cluster) against the shared design tokens; toggle
the canvas theme setting and re-audit; no off-palette or mixed-language surface remains.

**Acceptance Scenarios**:

1. **Given** a project with existing nodes, **When** I open its workbench, **Then** the canvas is light by default (white background with dot grid), node cards are dark, and all chrome surfaces use the shared token set.
2. **Given** the workbench is open, **When** I choose dark mode from the top-left application menu, **Then** the canvas background and dot grid change to the dark palette while node cards, toolbars, menus and panels remain on the shared token language; choosing light mode restores the light canvas.
3. **Given** the workbench is open, **When** I open any menu or panel (add-node, more-menu, prompt panel, zoom cluster), **Then** it uses the same surface color, border, radius and shadow language as every other popup, in both canvas themes.
4. **Given** a node card of any type, **When** I view it, **Then** it shows a consistent header (type icon + label) and body spacing defined by the token set.

---

### User Story 2 - Select a node, get its full action set (Priority: P1)

A designer clicks an image node. A compact toolbar appears above it with quick actions
(Edit, aspect-ratio chip, download-style actions) and a "more" menu. The "more" menu gives
every power action — library, references, thumbnails, sections, z-order, links, copy,
duplicate, delete — grouped logically, each showing its keyboard shortcut.

**Why this priority**: This is the core interaction loop of the reference product; it is
how users manage nodes day-to-day and the largest single UX gap.

**Independent Test**: Select an image node, verify the floating toolbar appears, open the
"more" menu, and confirm every grouped action is present with shortcut hints and works or
is sensibly disabled.

**Acceptance Scenarios**:

1. **Given** an unselected canvas, **When** I click an image node, **Then** a floating toolbar appears above it containing Edit, an aspect-ratio selector, quick-action buttons and a "more" trigger.
2. **Given** the floating toolbar is visible, **When** I open the "more" menu, **Then** actions are grouped (image actions / library & references / organization / clipboard / delete) with right-aligned keyboard-shortcut hints where a shortcut exists.
3. **Given** the "more" menu is open near a viewport edge, **When** it renders, **Then** it repositions so the full menu stays visible.
4. **Given** multiple nodes are selected, **When** I open the selection's action menu, **Then** actions valid for the whole selection are enabled and per-node-only actions are disabled.
5. **Given** a node is selected, **When** I press its shortcut (e.g. duplicate or delete), **Then** the same action fires as choosing it from the menu.

---

### User Story 3 - Create any node type in two clicks (Priority: P1)

A designer clicks the add-node button in the top toolbar and sees every creatable node
type in a scannable two-column icon grid, plus upload options with keyboard shortcuts.
Deprecated types are visibly badged as legacy and kept out of the default flow.

**Why this priority**: Node creation is the entry point to all generation workflows; the
current dropdown only covers uploads and sketch formats.

**Independent Test**: From an empty canvas, open the add-node menu and create one node of
each non-legacy type in two clicks or fewer.

**Acceptance Scenarios**:

1. **Given** the workbench is open, **When** I click the add-node button, **Then** a floating panel lists upload options (with shortcut hints) and a two-column icon grid of all creatable node types.
2. **Given** the add-node menu is open, **When** I choose a node type, **Then** the node is created on the canvas in an appropriate default state and the menu closes.
3. **Given** a node type is deprecated, **When** it appears in the menu, **Then** it carries a visible legacy badge and is excluded from the default creation flow.
4. **Given** I press the upload shortcut (e.g. `I`), **When** no menu is open, **Then** the image upload flow starts directly.

---

### User Story 4 - Prompt panel attached to generation nodes (Priority: P2)

A designer selects a generation-capable node (Render, Modify, Variate, New View, Extract).
A prompt panel attaches below the node with a rich editor that supports `@` references to
images and assets, numbered reference-image chips, settings for aspect ratio, mode and
resolution, and a primary Generate action.

**Why this priority**: It unifies prompt entry across node types and adds the reference
system (`@` mentions, reference chips) that the reference product uses for conditioning.

**Independent Test**: Select each generation node type, verify the attached panel renders
with editor, settings rows and Generate; attach a reference via `@` or the more-menu and
confirm it appears as a numbered chip.

**Acceptance Scenarios**:

1. **Given** I select a Render node, **When** the prompt panel attaches below it, **Then** it shows a header (node-type label + close), a prompt editor, Aspect Ratio / Mode / Resolution settings and a Generate action.
2. **Given** the prompt editor is focused, **When** I type `@`, **Then** a reference picker appears listing images/assets I can attach.
3. **Given** references are attached, **When** I view the panel, **Then** each reference shows as a numbered chip that can be removed.
4. **Given** the prompt is empty and required inputs are missing, **When** I view Generate, **Then** it is disabled with a clear reason.
5. **Given** the node sits near the bottom viewport edge, **When** the panel attaches, **Then** it flips or repositions so it stays fully visible.
6. **Given** a generation-capable node is unselected, **When** I view its card, **Then** no inline settings form is shown; instead a collapsed summary of its last prompt and settings is displayed.

---

### User Story 5 - New node types: Variate, New View, Extract (Priority: P2)

A designer can create a Variate node (prompt-driven variations of an input), a New View
node (pick a named camera view such as "Rear" or "Rear Right 3/4", see how many
references are attached, and generate that view), and an Extract node (pull a subject out
of a source image).

**Why this priority**: These are the reference product's distinctive generation workflows
beyond plain render/modify/animate; they expand what users can do without leaving the
canvas.

**Independent Test**: Create each new node type, connect a source image, run its primary
action, and verify output appears on the canvas.

**Acceptance Scenarios**:

1. **Given** a New View node with no view selected, **When** I open its view selector, **Then** named views are listed plus a "Select a view" placeholder and Generate stays disabled until one is chosen.
2. **Given** a New View node with a view and at least one reference, **When** I generate, **Then** the result appears as an output on the canvas.
3. **Given** a Variate node connected to an image, **When** I provide a prompt and generate, **Then** multiple variation outputs are produced.
4. **Given** an Extract node with a source image, **When** I run extract, **Then** the extracted subject appears as output.

---

### User Story 6 - Toolbar, export and shortcut affordances (Priority: P3)

A designer sees a complete top toolbar (add node, library, select, text, sticky note,
section, smart dropper, draw, eraser, arrow, undo, redo) where every button's tooltip
shows its keyboard shortcut; Export lives in the top-right (Share is out of scope for v1); edges show a remove
affordance on hover; the zoom cluster matches the shared visual language.

**Why this priority**: These are polish and power-user affordances that complete parity
but do not block core workflows.

**Independent Test**: Hover every toolbar button (tooltip + shortcut visible), trigger
Export/Share, hover an edge (remove affordance appears), and verify the zoom cluster uses
the shared tokens.

**Acceptance Scenarios**:

1. **Given** the workbench is open, **When** I hover any top-toolbar button, **Then** a tooltip shows its name and keyboard shortcut where one exists.
2. **Given** the workbench is open, **When** I click Export in the top-right, **Then** a centered export modal opens listing selected assets on the left with options on the right — Export format (JPEG, PNG), Quality (0–100%), Scaling (Original, 2K, 4K upscaling) and a source preview — plus an Export button at the bottom.
3. **Given** the export modal is open, **When** I press its Export button, **Then** the selected assets are exported with the chosen format, quality and scaling.
4. **Given** an edge between two nodes, **When** I hover it or select it, **Then** a remove-connector affordance appears and removes the edge on activation.
5. **Given** I use the smart dropper tool, **When** I click a point on empty canvas, **Then** the pixel color at that point is captured and set as the active drawing tool's color.
6. **Given** an image node is selected and I use the smart dropper with a capture type chosen from its dropdown (Style, Color, or Environment), **When** I click inside the source image, **Then** that attribute is captured and shown as a removable chip.
7. **Given** I have captured any attribute (Style, Color, or Environment), **When** I drop it onto another image node, **Then** a new image is rendered on the canvas with the captured attribute applied to the target image — style characteristics, color palette, or environment respectively — and the original images are unchanged.
8. **Given** a non-image node or an unselected node, **When** I click inside it with the smart dropper, **Then** only the pixel color at that point is sampled; no style, color-palette, or environment attributes are captured.

---

### Edge Cases

- What happens when a node's floating toolbar or prompt panel would extend past a viewport edge? (Reposition/flip to stay fully visible.)
- How does the system handle selecting multiple heterogeneous nodes (e.g. image + note)? (Menu shows only actions valid for the whole selection; others disabled.)
- What happens when a legacy node type from an older project is opened? (It renders and functions, badged as legacy.)
- How does the system behave when generation fails or times out while a prompt panel is attached? (Inline error state in the panel; inputs preserved.)
- What happens when references are removed after being `@`-mentioned in a prompt? (Mentions degrade gracefully; Generate re-validates required inputs.)
- How do floating toolbars behave at extreme zoom levels? (They stay anchored to their node and remain legible without drifting.)
- What happens when the canvas theme is switched while floating toolbars or prompt panels are open? (They restyle in place; no re-anchoring or dismissal required.)
- What happens when the smart dropper absorbs from an image that fails to load? (Inline error feedback is shown; nothing is absorbed and no chip is created.)
- What happens when an absorbed style/color/environment chip is removed from a prompt panel? (**Deferred** — prompt-panel conditioning is out of v1 scope by user decision; capture + drop-to-image only. When implemented, removing a chip MUST stop conditioning that node's generation and re-validate Generate, matching reference-chip behavior.)
- What happens when a captured attribute is dropped onto a non-image node or empty canvas? (Nothing is applied; clear feedback indicates the drop target is invalid.)
- What happens when an attribute of the same type is dropped onto a target that already has one? (The newly dropped attribute replaces the previous one on that target.)
- What happens if generation fails while applying a captured attribute to a target image? (Inline error state on the newly created image node's card/job status — the drop target is an `image` node, which has no prompt panel; inputs and the captured attribute are preserved, matching the existing generation-failure behavior.)
- What happens when the active generation backend does not support an operation (e.g. variate or style transfer on a backend without that capability)? (The affected node's Generate is disabled with a clear reason naming the unsupported operation; the node remains editable and re-validates when the backend changes.)
- What happens when Export requests 2K/4K but the active backend does not support upscaling? (Export proceeds using high-quality client-side resize; the export never fails because of missing upscale capability.)
- What happens when Export is opened while no assets are selected? (The modal lists no assets and its Export button is disabled with a clear reason.)

## Requirements

### Functional Requirements

- **FR-001**: System MUST render all workbench chrome surfaces — toolbars, panels, menus and the zoom cluster — in one unified visual language using the project's shared design tokens; node cards MUST be dark in both canvas themes.
- **FR-002**: When a user selects an image node, system MUST display a floating toolbar above the node containing an Edit action, an aspect-ratio selector, quick-action buttons and a "more" menu trigger.
- **FR-003**: The "more" menu MUST present grouped actions — image actions (Remove Background, Download, Export, Copy raw image), library & references (Add to library, Add to reference images, Set as thumbnail, Restore default thumbnail), organization (Wrap in section, Bring to front, Send to back), clipboard (Copy link to selection, Copy, Duplicate) and Delete — each showing a right-aligned keyboard-shortcut hint where a shortcut is assigned.
- **FR-004**: System MUST provide an add-node menu listing all creatable node types in a two-column icon grid plus upload options with keyboard-shortcut hints; deprecated node types are excluded from the v1 menu (out of scope per Assumptions) and, when reintroduced, MUST carry a visible LEGACY badge and remain excluded from the default creation flow. The existing render node MUST appear in the menu under its reference product name "Instant Render".
- **FR-005**: The workbench node catalog MUST include, at minimum: Image (upload), Sketch, Render, Modify, Animate, Variate, New View, Extract, Text, Sticky Note, Arrow, Freehand drawing and Media/Video.
- **FR-006**: When a user selects a generation-capable node (Render, Modify, Variate, New View, Extract), system MUST attach a prompt panel below the node containing a prompt editor supporting `@` references to images/assets, numbered reference-image chips, settings for aspect ratio, mode and resolution, and a primary Generate action. The existing inline settings forms on Render/Modify nodes MUST be removed; when unselected, a generation-capable node card MUST show only a collapsed summary of its last prompt and settings.
- **FR-007**: The New View node MUST let the user choose from named views (e.g. Rear, Rear Right 3/4) or a "Select a view" placeholder, display the count of attached reference images, and generate the selected view; generation MUST be disabled until a view is chosen.
- **FR-008**: System MUST display keyboard-shortcut hints in all top-toolbar tooltips and in every menu item that has an assigned shortcut.
- **FR-009**: The top toolbar MUST expose: Add node, Library, Select, Text, Sticky Note, Section (group), Smart Dropper, Draw, Eraser, Arrow, Undo and Redo, with tooltips and shortcut hints.
- **FR-010**: System MUST provide an Export action in the top-right of the workbench that opens a centered export modal listing selected assets on the left and options on the right — Export format (JPEG, PNG), Quality (0–100%), Scaling (Original, 2K, 4K upscaling) and a source preview — with an Export button at the bottom. A Share action is explicitly out of scope for v1.
- **FR-011**: Edges MUST show a remove-connector affordance on hover or selection, styled to the shared visual language.
- **FR-012**: The zoom control cluster MUST display the current zoom percentage with zoom-in, zoom-out and fit-to-screen actions, styled to the shared visual language.
- **FR-013**: All new menus, popups and panels MUST be accessible: keyboard-navigable, focus-managed, dismissible via Escape, and built on the project's accessible UI primitive conventions.
- **FR-014**: Every node card MUST display a header with its type icon and label and use consistent padding, radius and border from the shared token set.
- **FR-015**: System MUST provide a Light/Dark canvas theme control in the top-left application menu. Light MUST be the default; selecting Dark MUST change only the workbench canvas background and dot grid, apply immediately without reloading the project, and persist as the user's preference across sessions. The dark-theme dot grid MUST use a subtle, low-contrast dot color from the shared token set (value defined in ui-translation.md §3.8).
- **FR-016**: The Smart Dropper (`Y`) MUST support two sampling behaviors: (a) clicking a point on empty canvas samples the pixel color there and sets it as the active drawing tool's color; (b) capturing from a selected image node via its attribute dropdown, which offers exactly three capture types — Style (visual style characteristics such as lighting, texture, mood), Color (the image's dominant color palette), and Environment (background/environmental context). A captured attribute MUST be shown as a removable chip. Applying a captured attribute to another image node by dropping it on the target MUST always render a new image on the canvas — for Style, a new image with the copied style applied to the target image; for Color, a new image with the captured color palette applied; for Environment, a new image in the captured environment using the target image. The source and target images MUST NOT be modified in place. Captured attributes MAY also appear as removable chips in the attached prompt panels of generation nodes, conditioning their Generate action. Clicking inside an unselected node or a non-image node MUST sample only the pixel color.

### Key Entities

- **Workbench Node**: An artifact placed on the canvas. Attributes: type, position, size, selection state, settings (prompt, style, count, aspect ratio, mode, resolution), outputs. Relationships: connected to other nodes via edges; may belong to a section.
- **Reference Image**: An image attached to a prompt for conditioning. Shown as a numbered chip; can be added from any node's "more" menu or via `@` mention in the prompt editor.
- **Section**: A grouping container that wraps one or more nodes (created via "Wrap in section").
- **View**: A named camera angle of a subject (e.g. Rear, Rear Right 3/4) selectable on a New View node.
- **Absorbed Attribute**: A Style, Color palette, or Environment characteristic captured from an image node via the Smart Dropper's attribute dropdown. Shown as a removable chip; dropping it onto another image node always renders a new image with that attribute applied (style, palette, or environment), leaving the original images unchanged; may also condition generation in prompt panels.
- **Design Token Set**: The shared visual constants (colors, radii, shadows, typography) applied uniformly across all workbench surfaces.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A visual audit of the workbench route finds 100% of chrome surfaces (toolbars, menus, panels, zoom cluster) and node cards on the shared token set in both canvas themes, with zero off-palette colors; the canvas renders light by default and switches to dark via the setting.
- **SC-002**: A user can create any non-legacy node type from an empty canvas in two clicks or fewer.
- **SC-003**: 100% of top-toolbar buttons show a tooltip containing the action name and its keyboard shortcut where one is assigned; 100% of menu items with an assigned shortcut display it.
- **SC-004**: From a selected image node, every action in the "more" menu is reachable in one click or fewer from the selection state.
- **SC-005**: At least 90% of the identified reference-product workbench UI features (see Gap Analysis Summary) are implemented or explicitly deferred with documented rationale.
- **SC-006**: A first-time user can complete the core loop — upload an image, attach a prompt, generate — without leaving the canvas in under two minutes.
- **SC-007**: A user can capture each of the three smart-dropper attribute types (Style, Color, Environment) from one image node and apply it to another image node in three interactions or fewer, with the resulting new image appearing on the canvas and the originals unchanged.

## Assumptions

- The reference workbench keeps its light canvas as the default and exposes the Light/Dark canvas control from the top-left application menu. OpenViz will match that placement and behavior; node cards stay dark in both themes, and all chrome surfaces adopt the studio's shared `viz-*` token set.
- Node types badged LEGACY in the reference product (Style, Mix, legacy Render, Try on) are out of scope for v1 parity and remain deferred.
- The reference product's top-right Share action is discarded for v1 by user decision; only Export is implemented (FR-010).
- The reference product's bottom-left utility dock could not be fully identified during analysis; it is deferred until its contents are confirmed (gap G8).
- Collaboration features (presence cursors, soft-lock badges, status chip) are unchanged by this feature; the scope is UI and interaction parity only.
- The canvas rendering architecture remains DOM-based node rendering; the reference product's single-canvas rendering approach is not adopted.
- The component-level shadcn/Tailwind translation (tokens, primitives, classes, new node and popup specifications) lives in the companion document [ui-translation.md](./ui-translation.md) and will be consumed by the planning phase.
