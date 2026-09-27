# UI Translation: Vizcom Workbench → OpenViz (shadcn + Tailwind)

**Feature**: [spec.md](../006-vizcom-workbench-parity/spec.md) — Vizcom Workbench UI Parity
**Created**: 2026-09-26

This document is the component-level translation of the reference workbench into our
stack: shadcn/ui primitives (Radix-based), Tailwind CSS with the existing `viz-*` token
set, and new node/popup specifications. It is consumed by `/speckit-plan`.

## 1. Design Tokens (verified from reference DOM)

All values below were read from computed styles of the live reference product. They map
1:1 onto the existing `viz-*` tokens in `tailwind.config.js` — **no new color tokens are
required**; only radius/shadow/typography additions.

| Token | Reference value | Our token | Tailwind usage |
|-------|----------------|-----------|----------------|
| Canvas background (default light) | white + dot grid — current `bg-white`, dots `#c6cfdb`/`#a0afc3` | — | keep current classes |
| Canvas background (dark setting) | `rgb(22,22,22)` = `#161616` | `viz-bg` | `bg-viz-bg` when theme = dark |
| Node card / floating panel bg | `rgb(36,36,37)` = `#242425` | `viz-panel` | `bg-viz-panel` |
| Menu surface bg | `rgb(47,47,49)` = `#2F2F31` | `viz-surface` | `bg-viz-surface` |
| Border (menus) | `1px solid rgb(60,60,62)` = `#3C3C3E` | `viz-border` | `border-viz-border` |
| Muted text | `#808085` | `viz-muted` | `text-viz-muted` |
| Accent / selected | `#4C4CEF` / `#343476` | `viz-accent` / `viz-selected` | `bg-viz-accent`, `bg-viz-selected` |
| Menu radius | `8px` | — | `rounded-lg` (8px) |
| Floating panel radius | `12px` | `rounded-xl2` | `rounded-xl2` |
| Panel shadow | `0 2px 4px rgba(0,0,0,0.25)` | `shadow-viz` | `shadow-viz` |
| Chrome font size | Inter, 12px base | — | `text-xs` (12px) for chrome; `text-sm` for node bodies |

**New tokens to add to `tailwind.config.js`** (only if not present):

- `borderRadius: { xl2: '12px' }` (already present per repo memory — verify).
- `boxShadow: { viz: '0 2px 4px rgba(0,0,0,0.25)' }` (already present — verify).
- Optional: `colors.viz-canvas-dot: '#2a2a2c'` for the dark-theme dot-grid color
  (reference uses a subtle light-on-dark dot; pick via design review — see Open
  Questions). The light default keeps its existing two-layer dot pattern unchanged.

## 2. shadcn/ui Primitives to Add

shadcn is set up manually (no CLI) in this repo: `components.json`, `src/lib/utils.ts`
(`cn`), and existing primitives `button`, `tooltip`. Add the following under
`src/components/ui/` following the same manual pattern (Radix primitive + CVA + `cn`):

| Primitive | Radix base | Used by |
|-----------|-----------|---------|
| `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | Add-node menu, aspect-ratio chip, mode/resolution selectors, "more" menu trigger |
| `context-menu.tsx` | `@radix-ui/react-context-menu` | Right-click on nodes/pane (replaces current ad-hoc `PositionedMenu`) |
| `popover.tsx` | `@radix-ui/react-popover` | Prompt panel anchor, zoom expand control, `@`-mention picker |
| `select.tsx` | `@radix-ui/react-select` | Aspect ratio, mode, resolution, view selector (New View node) |
| `separator.tsx` | `@radix-ui/react-separator` | Menu group dividers |
| `scroll-area.tsx` | `@radix-ui/react-scroll-area` | Long "more" menus, style lists |
| `kbd.tsx` | — (styled span) | Shortcut hints in menu items and tooltips |

> Note: `src/components/ContextMenu.tsx` already wraps Radix context-menu with hardcoded
> colors (`#2c2c2c`, `#3b82f6` focus). Restyle it to the token set and re-export through
> the new `ui/context-menu.tsx` so all menus share one surface.

## 3. Popup Specifications

### 3.1 Add-Node Menu (top toolbar "+")

- **Trigger**: first button in top toolbar, icon `Plus`, tooltip "Add node".
- **Container**: shadcn `DropdownMenu.Content`, `w-[222px]`, `rounded-xl2 bg-viz-panel
  border border-viz-border shadow-viz p-1.5`, `sideOffset={8}`, `align="start"`.
- **Structure** (top → bottom):
  1. Upload group (full-width rows, `h-[30px]` each):
     - "Upload an image" + `<Kbd>I</Kbd>`
     - "Upload from phone" + `<Kbd>/</Kbd>`
  2. `<Separator className="bg-viz-border my-1.5" />`
  3. Two-column icon grid (`grid grid-cols-2 gap-0.5`), each cell a
     `DropdownMenu.Item` with `flex items-center gap-2 px-2 py-1.5 rounded-lg
     text-xs data-[highlighted]:bg-viz-surface`:
     - Sketch, Instant Render, Animate, Modify, Variate, Extract, New View, Text, Sticky
       Note, Section, Media/Video.
  4. Legacy items (Style, Mix, legacy Render) — **excluded from v1** per spec assumption;
     if included later, render with a `LEGACY` badge:
     `<span className="ml-auto text-[9px] font-semibold tracking-wide text-viz-muted bg-viz-surface rounded px-1 py-0.5">LEGACY</span>`.
- **Behavior**: selecting a type creates the node at canvas center (or at cursor for
  one-shot tools) and closes the menu. Upload rows open the existing file/phone flows.

### 3.2 Node Selection Toolbar (floating, above selected image node)

- **Anchor**: rendered via React Flow `EdgeLabelRenderer`-style overlay or an absolutely
  positioned layer computed from node bounds × viewport transform (see §5).
- **Container**: `flex items-center gap-1 rounded-xl2 bg-viz-panel border border-viz-border
  shadow-viz px-1.5 py-1`, centered above the node with a 8px gap; pointer-events auto,
  `nodrag nopan`.
- **Contents** (left → right):
  1. Edit button — icon `Pencil`, tooltip "Edit".
  2. Aspect-ratio chip — shadcn `DropdownMenu` trigger:
     `<button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-viz-surface">
       <AspectRatioIcon /> {ratio} <ChevronDown size={12} /></button>`; menu lists
     1:1, 4:5, 5:4, 2:3, 3:2, 9:16, 16:9.
  3. Quick actions (icon buttons `p-1.5 rounded-lg hover:bg-viz-surface text-viz-muted
     hover:text-white`): Download, Copy raw image, Add to library.
  4. "More" trigger — icon `MoreHorizontal`, opens §3.3.

### 3.3 "More" Menu (⋯)

- **Container**: shadcn `DropdownMenu.Content` (or `ContextMenu.Content` for right-click),
  `w-[206px] rounded-lg bg-viz-surface border border-viz-border shadow-viz p-1`.
- **Item anatomy** (shared component `MenuItemRow`):
  ```
  <div className="flex items-center gap-2 px-2.5 h-[35px] rounded-lg text-xs
                  data-[highlighted]:bg-white/5">
    <Icon size={14} className="text-viz-muted" />
    <span className="flex-1 truncate">{label}</span>
    {shortcut && <Kbd>{shortcut}</Kbd>}
  </div>
  ```
- **Groups** (separated by `<Separator className="bg-viz-border/60 my-1" />`):
  1. Image: Remove Background · Download · Export… · Copy raw image
  2. Library & references: Add to library · Add to reference images · Set as thumbnail ·
     Restore default thumbnail
  3. Organization: Wrap in section · Bring to front `]` · Send to back `[`
  4. Clipboard: Copy link to selection `⌘L` · Copy `⌘C` · Duplicate `⌘D`
  5. Danger: Delete `Del` (`text-red-400 data-[highlighted]:bg-red-500/15`)
- **Disabled state**: `opacity-40 pointer-events-none` (e.g. "Restore default thumbnail"
  when custom, "Copy link" when sharing is off).

### 3.4 Prompt Panel (attached to generation nodes)

- **Anchor**: below the selected node, same overlay layer as §3.2; width = max(node width,
  280px), capped at 360px; flips above the node if it would overflow the viewport bottom.
- **Container**: `rounded-xl2 bg-viz-panel border border-viz-border shadow-viz overflow-hidden`.
- **Header** (`h-9 px-3 flex items-center justify-between border-b border-viz-border`):
  - Left: type icon + label (e.g. "Modify"), `text-xs font-medium`.
  - Right: close `X` icon button.
- **Body** (`p-3 space-y-3`):
  1. Reference chips row (if any): numbered square thumbnails
     `<div className="relative h-8 w-8 rounded-md overflow-hidden border border-viz-border">
        <img … /><span className="absolute bottom-0 left-0 bg-black/60 text-[9px] px-1">1</span>
        <button remove ×/></div>` + an "add reference" ghost chip.
  2. Prompt editor: `min-h-[72px] rounded-lg bg-viz-surface border border-viz-border
     p-2.5 text-xs resize-none focus:border-viz-accent outline-none`, placeholder
     "Describe your changes (use @ to reference images or assets)". Typing `@` opens the
     mention picker (shadcn `Popover` with a filtered list of project images/assets;
     selecting inserts a chip token into the editor state).
  3. Settings rows (`grid grid-cols-2 gap-2`), each row:
     `<div className="flex items-center justify-between rounded-lg bg-viz-surface px-2.5 py-1.5">
        <span className="text-[10px] text-viz-muted">{label}</span>
        <SelectTrigger …>{value} <ChevronDown size={12}/></SelectTrigger></div>`
     Rows: Aspect Ratio, Mode (Auto/Pro), Resolution (1K/2K).
  4. Generate button: full-width shadcn `Button` variant accent —
     `h-9 rounded-lg bg-viz-accent text-white text-xs font-medium hover:bg-viz-accent/90
     disabled:opacity-40`, with a reference-count chip on the left when references exist.

### 3.5 Zoom Cluster (bottom-right, restyle existing)

- Keep current controls (fullscreen, fit, zoom out, %, zoom in, shortcuts help).
- Restyle container to `flex items-center gap-1 rounded-xl2 bg-viz-panel border
  border-viz-border shadow-viz px-1.5 py-1`; percentage as a `button` that opens a
  shadcn `Popover` with quick presets (25/50/75/100/fit).

### 3.6 Top Toolbar (restyle + extend)

- Container: `flex items-center gap-0.5 rounded-xl2 bg-viz-panel border border-viz-border
  shadow-viz p-1` (replace current `bg-panel/90 backdrop-blur-md`).
- Buttons: `p-1.5 rounded-lg text-viz-muted hover:text-white hover:bg-viz-surface`,
  active tool `bg-viz-selected text-white`.
- Order: **+** (add-node menu) · Library · Select `V` · Text `T` · Sticky Note `N` ·
  Section · Smart Dropper `Y` · Draw `D` · Eraser `E` · Arrow `A` · Undo `⌘Z` · Redo.
- Every button wrapped in shadcn `Tooltip` (side="bottom") with label + `<Kbd>` shortcut.

### 3.7 Top-Right Cluster

- Add an Export button (shadcn `Button` ghost, `h-8 rounded-lg bg-viz-panel border
  border-viz-border text-xs`) left of the existing compute/collab chips; keep compute +
  collab chip as-is but restyle to tokens. Share is out of scope for v1 (spec FR-010).
- Export opens a centered shadcn `Dialog`: left column lists selected assets; right
  column shows Export format (JPEG/PNG), Quality (0–100%), Scaling (Original/2K/4K
  upscaling) and a source preview; full-width Export button at the bottom.

### 3.8 Canvas Theme Setting (light/dark)

- **Control**: shadcn `Select` (or segmented toggle) with two options — Light (default),
  Dark.
- **Effect**: switches only the canvas layer — background color + dot-grid colors
  (light: current `bg-white` + `#c6cfdb`/`#a0afc3` dots; dark: `bg-viz-bg` +
  `viz-canvas-dot` = `#2a2a2c` at 100% opacity). Node cards, toolbars, menus and panels
  are unaffected (already on the shared token set).
- **State**: persisted user preference in the workbench zustand store slice; applied
  immediately on change (FR-015).
- **Placement**: top-left application menu, matching the verified reference behavior.
  The control should be available from that menu rather than being added to the
  top-right compute/collaboration cluster.

### 3.9 Edge Remove Affordance (restyle existing)

- Current `CustomEdge` delete button: replace hardcoded `#6366f6`/white with
  `bg-viz-accent border-2 border-viz-bg rounded-full`; show on edge hover or when either
  endpoint is selected (existing logic).

## 4. New Node Specifications

All nodes share the card shell (`NodeCard`):

```
<div className="w-[280px] rounded-xl2 bg-viz-panel border border-viz-border shadow-viz overflow-hidden">
  <div className="flex items-center gap-2 px-3 h-9 border-b border-viz-border">
    <TypeIcon size={14} className="text-viz-accent" />
    <span className="text-xs font-medium text-white">{Label}</span>
    {badges}  {/* e.g. LEGACY, view name */}
  </div>
  <div className="p-3 space-y-3">{body}</div>
</div>
```

Selection ring: `ring-2 ring-viz-accent` (replaces current selection styling). Handles
keep existing React Flow handle logic; restyle to `bg-viz-panel border-2 border-viz-border`.

### 4.1 VariateNode (new)

- **Purpose**: prompt-driven variations of an input image.
- **Inputs**: one or more source images (left handles).
- **Body**: prompt editor (shared `PromptEditor` component, no `@` needed in v1),
  Count select (2/4/8), optional "Vary: form / color / both" segmented control.
- **Outputs**: grid of generated variations (2×2 for count 4) with per-image hover actions
  (download, use as reference).
- **Generate button**: shared `GenerateButton` (accent, full-width, disabled until a
  source image is connected and prompt or vary-mode is set).

### 4.2 NewViewNode (new)

- **Purpose**: generate a named camera view of a subject from references.
- **Inputs**: reference images (left handles), shown as numbered chips in the body.
- **Body**:
  - View selector: shadcn `Select` with options Rear, Front, Left, Right, Top,
    Rear Right 3/4, Rear Left 3/4, … plus "Select a view" placeholder (disabled state).
  - Reference count chip: `<span className="text-[10px] text-viz-muted">{n} ref</span>`.
- **Generate**: disabled until a view is selected and ≥1 reference connected.
- **Output**: single generated image with the view name as caption badge.

### 4.3 ExtractNode (new)

- **Purpose**: extract a subject/object from a source image.
- **Inputs**: one source image.
- **Body**: optional prompt ("what to extract"), background handling select
  (transparent / keep), Count select.
- **Output**: extracted subject image(s).

### 4.4 Restyled existing nodes

| Node | Change |
|------|--------|
| ImageNode | Card shell; hover actions → floating toolbar (§3.2) on selection; keep fullscreen-preview action in "more" menu |
| RenderNode | Card shell; inline form replaced by attached Prompt Panel (§3.4) when selected; collapsed state shows last prompt + settings summary |
| ModifyNode | Same as RenderNode (panel header label "Modify") |
| AnimateNode | Card shell; keep frames/settings body; restyle controls to tokens |
| Text/Note/Arrow/Freehand/Media/Video | Card shell + token restyle only |

## 5. Overlay Anchoring Strategy

Floating toolbars (§3.2) and prompt panels (§3.4) must track their node through pan/zoom:

- Compute screen position from `node.positionAbsolute` × `viewport` (React Flow
  `useViewport`) in a single overlay layer rendered inside the flow wrapper
  (`pointer-events-none` root, `pointer-events-auto` on each panel).
- Re-render on viewport change via `useViewport()` subscription; no per-frame rAF needed.
- Viewport-edge collision: if panel bottom > viewport height − 16px, flip above the node;
  clamp horizontally to [16px, width − 16px].
- Only the **active** (last-clicked) node shows its toolbar/panel; multi-selection shows
  a single toolbar with selection-count badge and the "more" menu (§3.3 group rules).

## 6. Keyboard Shortcuts (new/confirmed)

| Shortcut | Action |
|----------|--------|
| `I` | Upload an image |
| `/` | Upload from phone |
| `V` / `D` / `E` / `A` / `T` / `N` | Select / Draw / Eraser / Arrow / Text / Note (existing) |
| `Y` | Smart Dropper |
| `⌘Z` / `⇧⌘Z` | Undo / Redo (existing) |
| `⌘C` / `⌘D` / `Del` | Copy / Duplicate / Delete selection (existing, now surfaced in menus) |
| `⌘L` | Copy link to selection |
| `[` / `]` | Send to back / Bring to front |

## 7. File Map (for planning)

| Concern | Location |
|---------|----------|
| New shadcn primitives | `src/components/ui/{dropdown-menu,context-menu,popover,select,separator,scroll-area,kbd}.tsx` |
| Shared menu row + Kbd | `src/components/workbench/menu/MenuItemRow.tsx`, `ui/kbd.tsx` |
| Add-node menu | `src/components/workbench/AddNodeMenu.tsx` |
| Node selection toolbar | `src/components/workbench/NodeSelectionToolbar.tsx` |
| More menu (data-driven) | `src/components/workbench/NodeMoreMenu.tsx` + `hooks/useNodeMoreMenuActions.ts` |
| Prompt panel | `src/components/workbench/PromptPanel.tsx` + `hooks/usePromptPanel.ts` |
| Overlay layer | `src/components/workbench/WorkbenchOverlayLayer.tsx` (anchoring per §5) |
| New nodes | `src/components/nodes/{VariateNode,NewViewNode,ExtractNode}.tsx` (+ tests) |
| Node card shell | `src/components/nodes/nodeUi.ts` (extend existing helpers) |
| Toolbar/zoom/edge restyle | `WorkbenchToolbar.tsx`, `CanvasControls.tsx`, `CustomEdge.tsx` |
| Tokens | `tailwind.config.js` (verify `rounded-xl2`, `shadow-viz`; add dot color if needed) |

## 8. Open Questions (for /speckit-clarify)

1. **Dot grid on the dark canvas option**: RESOLVED 2026-09-26 — dark theme dots are
   `#2a2a2c` at 100% opacity; the light default keeps its current two-layer dot pattern.
2. **Prompt panel vs inline form**: RESOLVED 2026-09-26 — inline forms are removed; the
   attached panel is the only prompt-entry surface on selection, with a collapsed
   prompt/settings summary when unselected (spec FR-006).
3. **Smart Dropper scope**: RESOLVED 2026-09-26 — canvas pixel-color sampling plus
   absorption of style/color/environment from within a selected image node (spec FR-016).
   Refined same day: the capture type is chosen via the dropper's dropdown (Style/Color/
   Environment); dropping any captured attribute onto another image node renders a NEW
   image with that attribute applied (style, palette, or environment) — originals are
   never re-rendered in place.
4. **Canvas theme setting placement & scope**: resolved by reference inspection — place
  the Light/Dark control in the top-left application menu. The preference is per-user
  and persists across sessions; it is not part of project scene data.
