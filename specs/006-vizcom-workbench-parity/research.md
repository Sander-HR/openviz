# Research: Vizcom Workbench UI Parity

**Feature**: `006-vizcom-workbench-parity` | **Date**: 2026-09-26
Resolves all technical unknowns from `plan.md` Technical Context. No NEEDS CLARIFICATION
items remain — the spec was clarified on 2026-09-26 (see spec Clarifications section).

## R1: Missing shadcn/Radix primitives

- **Decision**: Add Radix packages `@radix-ui/react-dialog`, `@radix-ui/react-popover`,
  `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-scroll-area` and
  create matching shadcn wrappers in `src/components/ui/` (dropdown-menu, context-menu,
  popover, select, dialog, separator, scroll-area, kbd). Reuse existing Radix
  dropdown-menu/context-menu/tooltip/slot where present. The existing ad-hoc
  `PositionedMenu`/`ContextMenu.tsx` usages in the workbench migrate to the new
  `ui/context-menu.tsx` so all menus share one surface (per ui-translation §2 note).
- **Rationale**: Constitution IV mandates Radix for accessible primitives; FR-013 requires
  keyboard navigation, focus management, and Escape dismissal. Radix provides portalling,
  collision detection (US2 scenario 3), and focus return out of the box. Feature 001 already
  migrated toolbar submenus to Radix DropdownMenu — this extends the same pattern.
- **Alternatives considered**: Keep custom menus and hand-roll keyboard/focus handling
  (rejected: re-implements Radix, constitution violation); use a different menu library
  (rejected: mixed primitive ecosystems break FR-013 consistency).

## R2: Canvas theme preference persistence

- **Decision**: New `workbenchThemeSlice` in `src/store/slices/` holding
  `canvasTheme: 'light' | 'dark'` (default `'light'`). Persisted to localStorage under a
  namespaced key; hydrated on store creation. Applied by toggling canvas-layer classes only
  (background + dot-grid colors); node cards and chrome are unaffected because they already
  sit on the `viz-*` token set. No DB schema change — this is a per-user UI preference, not
  scene data (spec Assumptions).
- **Rationale**: FR-015 requires immediate application without reload and persistence across
  sessions; localStorage + zustand is the existing client-preference pattern in this codebase
  (viewport persistence hook already does similar). Keeping it out of Postgres avoids a
  Drizzle migration for a cosmetic preference.
- **Alternatives considered**: Store on the project/scene document (rejected: spec says the
  preference is per-user, not part of project scene data); server-side user settings table
  (rejected: requires auth-gated API + migration; disproportionate for v1).

## R3: Floating toolbar / prompt panel anchoring

- **Decision**: Single `WorkbenchOverlayLayer` rendered inside the React Flow wrapper
  (`pointer-events-none` root, `pointer-events-auto` per panel). Positions computed from
  `node.positionAbsolute × viewport` via a `useViewport()` subscription (no per-frame rAF).
  Collision handling: flip above the node when bottom would overflow viewport −16px; clamp
  horizontally to [16px, width−16px]. Only the active (last-clicked) node shows its
  toolbar/panel; multi-selection shows one toolbar with a selection-count badge.
- **Rationale**: ui-translation §5 strategy; satisfies edge cases (viewport overflow,
  extreme zoom legibility, theme switch without re-anchoring) and keeps one render path for
  both the selection toolbar (§3.2) and prompt panel (§3.4).
- **Alternatives considered**: React Flow `EdgeLabelRenderer`-style per-node rendering
  (rejected: scatters positioning logic across node components); absolute positioning inside
  each node (rejected: breaks at zoom, cannot flip outside node bounds).

## R4: New node types (Variate, New View, Extract) and attribute application

- **Decision**: Add `'variate' | 'new-view' | 'extract'` to the `NodeType` union with typed
  data interfaces in `src/types/`. Each reuses the shared `NodeCard` shell + `GenerateButton`
  pattern from existing Render/Modify nodes. Generation is **backend-agnostic**: new
  operations (`variate`, `new-view`, `extract`, `attribute-apply`) are added to the render
  service contract and routed by the EXISTING generic facade (`src/services/renderService.ts`)
  to whichever protocol is active in persisted compute settings — ComfyUI
  (`comfyRenderService`) or the OpenAI custom image API (`openAIImageRenderService`). No
  component ever calls a backend directly; no new call paths are introduced. Smart Dropper
  attribute application (FR-016) creates a **new** generation job per drop — style transfer /
  palette-conditioned / environment-conditioned operation taking source image + target image —
  and adds the result as a new image node; originals are never mutated.
- **Rationale**: The repo already has the multi-backend architecture (feature 005 execution
  targets: `localComfyTarget`, `hostedComfyTarget`, `hybridTarget`, `openAIImageTarget`,
  `ExecutionTargetProtocol = 'comfyui' | 'openai-image'`). Defining operations at the render
  service level means each backend implements what it supports; capability checking via the
  existing target-capabilities mechanism gates per-operation availability. New-image-per-drop
  matches the clarified FR-016 semantics exactly and keeps undo history atomic (one job = one
  new node).
- **Alternatives considered**: ComfyUI-only workflows with OpenAI added later (rejected by
  user decision — the OpenAI custom backend must be a first-class path from the start);
  in-place re-render of the target (rejected by user decision — dropped attributes always
  render a new image); client-side filters for palette application (rejected: not
  generative; reference product behavior is AI-applied).
- **Capability gating**: when the active backend does not support an operation, that node's
  Generate is disabled with a clear reason naming the unsupported operation (spec edge case);
  the node remains fully editable.

## R5: Smart Dropper capture mechanics

- **Decision**: `smartDropperService` in `src/services/`:
  - **Pixel color** (canvas or any node): sample via the Konva stage's canvas context at the
    clicked point — synchronous, client-side.
  - **Color palette**: downsample the source image on an offscreen canvas and extract the
    dominant palette (quantization) client-side; stored as an ordered hex list.
  - **Style / Environment**: captured as a reference to the source image plus the capture
    type flag; the *application* is a generation operation on the active backend (see R4).
    No separate "analysis" API in v1 — the operation receives (source, target, mode) and
    produces the result.
  - Capture state lives in `absorbedAttributeSlice` (one active captured chip + per-target
    pending application); drop targets validated by node type (`image` only).
- **Rationale**: FR-016 requires exactly three capture types with distinct apply semantics;
  keeping extraction client-side where possible minimizes API surface, and routing the
  generative part through the backend-agnostic render service keeps all generation inside
  `src/services/`. The spec's edge
  cases (failed image load → error, no chip; same-type re-drop → replace) map directly onto
  slice state transitions.
- **Alternatives considered**: Dedicated server-side "attribute extraction" endpoint returning
  style descriptors (deferred: adds API + persistence scope without v1 UX benefit — the
  workflow consumes the source image directly); capturing all three attributes in one click
  (rejected by user decision — dropdown selects exactly one type per capture).

## R6: Export modal mechanics (FR-010)

- **Decision**: `exportService` in `src/services/` exports selected assets **per-asset**
  (multi-selection produces one file per asset). Each asset is encoded to JPEG/PNG via an
  offscreen canvas with the chosen quality (0–100%). Scaling: Original = native size; 2K/4K
  use a real `upscale` generation operation on the active backend (ComfyUI or OpenAI custom
  image API) routed through the render service facade — consistent with R4. If the active
  backend does not support upscaling, export falls back to client-side resize (2048px / 3840px
  longest edge) so export is never blocked. Source preview = first selected asset thumbnail.
  Modal is a shadcn `Dialog` (centered): left column lists selected assets, right column holds
  the option rows + preview, full-width Export button at bottom; disabled with a clear reason
  when no assets are selected. Download via object URLs.
- **Rationale**: User decision — per-asset output with real AI upscaling for 2K/4K rather
  than client-side resize. Routing upscale through the same backend-agnostic facade keeps one
  generation path and reuses capability gating; the client-resize fallback keeps export
  functional on any backend.
- **Alternatives considered**: Client-side-only scaling (rejected by user decision — AI
  upscaling is the v1 behavior); single composite image for multi-selection (rejected: per-
  asset files are the requested output); blocking export when upscale is unsupported
  (rejected: fallback resize is friendlier and always works).

## R7: Keyboard shortcuts — conflicts and registration

- **Decision**: Extend `useWorkbenchKeyboardShortcuts` with: `Y` (Smart Dropper tool),
  `[` / `]` (send to back / bring to front), `I` (upload image), `/` (upload from phone),
  `⌘L` (copy link — no-op feedback until sharing exists). Guard rules: shortcuts are inert
  while any menu, modal, or text editor has focus (existing guard pattern); `[`/`]` apply to
  the current selection only. All toolbar tooltips and menu items render `<Kbd>` hints via
  the shared `MenuItemRow`/tooltip wrappers (FR-008).
- **Rationale**: ui-translation §6 table is authoritative for shortcut assignments; centralizing
  in the existing hook keeps one source of truth and preserves the Escape-priority behavior
  established by feature 003.
- **Alternatives considered**: Per-component key handlers (rejected: conflicts with menu focus
  ownership); adding `⌘L` as a real share link now (rejected: Share is out of scope for v1).

## R8: File limits and refactor surface

- **Decision**: Follow the ui-translation §7 file map verbatim. Every new component targets
  <250 lines; data-driven `NodeMoreMenu` + `useNodeMoreMenuActions` keeps action logic out of
  view components. Existing files touched (WorkbenchToolbar, CanvasControls/zoom cluster,
  CustomEdge, RenderNode, ModifyNode, ImageNode) are restyled in place where under the limit;
  any file that would exceed 300 lines after changes is split Logic/View first (test-first).
- **Rationale**: Constitution V hard limit; `workbench.tsx` was already reduced to 284 lines
  in feature 001, so new chrome must not flow back into it — it goes to `WorkbenchChrome.tsx`
  and the dedicated components above.
- **Alternatives considered**: One large "parity" component per surface (rejected: violates
  file limit and testability).

## R9: Visual token gaps

- **Decision**: `viz-bg/panel/surface/border/muted/accent/selected` already exist in
  `tailwind.config.js`, as does `rounded-xl2` (12px). Add: `shadow-viz`
  (`0 2px 4px rgba(0,0,0,0.25)`), `viz-canvas-dot` (`#2a2a2c` — dark-theme dot per the
  2026-09-26 clarification), and light-theme dot tokens if not already named. Inter typeface
  at 12px chrome base is applied via existing font config; verify, don't add a second font
  stack.
- **Rationale**: SC-001 requires zero off-palette colors in both themes; naming the dot color
  as a token (rather than hardcoding) makes the audit mechanical.
- **Alternatives considered**: CSS variables per theme (rejected: Tailwind-only styling rule;
  tokens belong in the config).

## R10: Inline form removal compatibility (Render/Modify)

- **Decision**: Render/Modify inline forms are removed per FR-006; node data schema is
  unchanged (prompt, style, count, aspect ratio, mode, resolution all already exist on node
  data), so existing scenes load without migration. Unselected cards render a collapsed
  summary (last prompt + settings) from the same data. `useRenderNodeGeneration` and friends
  are reused by `PromptPanel` — generation logic is not rewritten, only its host surface
  moves from inline form to attached panel.
- **Rationale**: Zero data migration keeps feature 002/005 scenes compatible; reusing the
  existing generation hooks minimizes regression risk on the core loop (SC-006).
- **Alternatives considered**: Keep inline forms behind a flag (rejected by user decision);
  new data schema with `promptPanel` sub-object (rejected: no new fields are required).

## R11: "More" menu action coverage (FR-003)

- **Decision**: v1 enables every More-menu action that already has a backend (image
  download/export/copy raw image, z-order, copy/duplicate/delete, and any library/reference/
  thumbnail actions whose services exist today). Actions without a backend render visibly
  disabled with a tooltip explaining why. No new library/thumbnail/background-removal/link
  services are built in this feature.
- **Rationale**: User decision — honest placeholders over scope creep; matches the
  feature-001 "honest phone-upload placeholder" precedent and keeps P1 parity work on track.
  Disabled-with-reason is testable (C-3) and upgrades incrementally as backends land.
- **Alternatives considered**: Build all 15 actions with new services (rejected by user
  decision — largest scope, delays core parity); trim the menu to omit the library &
  references group entirely (rejected: reference parity includes showing the full grouped
  menu).

## R12: Smart Dropper prompt-panel conditioning (FR-016 "MAY" clause)

- **Decision**: Deferred to a follow-up. v1 implements capture + drop-onto-image only;
  captured attributes do NOT appear as conditioning chips in prompt panels.
- **Rationale**: User decision — keeps dropper scope tight for v1. The `absorbedAttributeSlice`
  shape (data-model.md) already anticipates the secondary surface, so adding panel chips later
  is additive with no rework of the capture/drop flow.
- **Alternatives considered**: Include in v1 (rejected by user decision — expands prompt-panel
  and generation-conditioning scope).
