# Tasks: Vizcom Workbench UI Parity

**Input**: Design documents from `/specs/006-vizcom-workbench-parity/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, ui-translation.md, quickstart.md

**Tests**: MANDATORY per constitution principle II (test-first layered development): logic layers (services/hooks/store slices/utils) get failing tests written FIRST (strict red-green); components get behavior tests derived from spec acceptance scenarios before implementation. Coverage floor may never regress.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js project at repo root: `src/components/`, `src/services/`, `src/store/slices/`, `src/types/`. Tests are co-located (`X.test.ts` / `X.test.tsx`) per existing repo convention.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and design tokens every story consumes.

- [X] T001 Install new Radix packages with pnpm: `@radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-scroll-area` (dropdown-menu, context-menu, tooltip, slot already present)
- [X] T002 [P] Verify existing `viz-*` tokens and add missing ones in `tailwind.config.js`: confirm `viz-bg #161616`, `viz-panel #242425`, `viz-surface #2F2F31`, `viz-border #3C3C3E`, `viz-muted #808085`, `viz-accent #4C4CEF`, `viz-selected #343476` and `rounded-xl2 = 12px`; ADD `shadow-viz: '0 2px 4px rgba(0,0,0,0.25)'` and canvas dot color `viz-canvas-dot: '#2a2a2c'` (ui-translation §1, §3.8)

**Checkpoint**: Tokens compile; all Radix imports resolve under strict TS.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared shadcn primitives, menu row component, and type extensions that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `src/components/ui/kbd.tsx` — styled shortcut-hint span (small monospace chip per ui-translation §2), named export, no inline styles
- [X] T004 [P] Create `src/components/ui/dropdown-menu.tsx` — manual shadcn pattern (Radix `@radix-ui/react-dropdown-menu` + CVA + `cn`) matching existing `button`/`tooltip` primitives; surfaces use `bg-viz-surface border border-viz-border rounded-lg shadow-viz`
- [X] T005 [P] Restyle `src/components/ContextMenu.tsx` to the token set (remove hardcoded `#2c2c2c` / `#3b82f6`) and re-export it through new `src/components/ui/context-menu.tsx` so all menus share one surface
- [X] T006 [P] Create `src/components/ui/popover.tsx` — Radix popover + CVA + `cn`; content styled `bg-viz-panel border border-viz-border rounded-xl2 shadow-viz`
- [X] T007 [P] Create `src/components/ui/select.tsx` — Radix select + CVA + `cn` (trigger: `rounded-lg bg-viz-surface border border-viz-border text-xs`)
- [X] T008 [P] Create `src/components/ui/separator.tsx` — Radix separator, default `bg-viz-border`
- [X] T009 [P] Create `src/components/ui/scroll-area.tsx` — Radix scroll area for long menus
- [X] T010 [P] Write FAILING behavior test for shared menu row in `src/components/workbench/menu/MenuItemRow.test.tsx`: renders icon + label + right-aligned `<Kbd>` hint when a shortcut exists; disabled state applies `opacity-40 pointer-events-none` and is inert to click
- [X] T011 Implement `src/components/workbench/menu/MenuItemRow.tsx` (shared menu row: 14px muted icon, truncated label, optional Kbd; props typed, no `any`) — make T010 pass
- [X] T012 [P] Extend types in `src/types/index.ts`: add `'variate' | 'new-view' | 'extract'` to `NodeType`; add per data-model.md — `AbsorbedAttributeType = 'style' | 'color' | 'environment'`; `AbsorbedAttribute { id: string; type: AbsorbedAttributeType; sourceNodeId: string; palette?: string[]; capturedAt: number }` (palette present only when `type === 'color'`); `ExportFormat = 'jpeg' | 'png'`, `ExportScaling = 'original' | '2k' | '4k'` (2k = 2048px, 4k = 3840px longest edge), `ExportOptions { assetIds: string[]; format: ExportFormat; quality: number /* 0–100, applies to jpeg */; scaling: ExportScaling }`; `ViewName = 'Rear' | 'Front' | 'Left' | 'Right' | 'Top' | 'Rear Right 3/4' | 'Rear Left 3/4'`

**Checkpoint**: Foundation ready — all primitives render on tokens, types compile under strict TS; user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - One consistent workbench surface with a configurable canvas theme (Priority: P1) 🎯 MVP

**Goal**: Every chrome surface (toolbar, menus, panels, zoom cluster, edges, node cards) shares the `viz-*` token language; top-left application menu offers Light/Dark canvas theme — light default, dark changes ONLY canvas background + dot grid, persisted per user.

**Independent Test**: Open any project workbench and visually audit every surface (canvas, nodes, toolbar, menus, zoom cluster) against the shared design tokens; toggle the canvas theme setting and re-audit; no off-palette or mixed-language surface remains.

### Tests for User Story 1 (write FIRST, ensure they FAIL) ⚠️

- [X] T013 [P] [US1] Write FAILING slice tests in `src/store/slices/workbenchThemeSlice.test.ts`: default theme is `'light'`; `setCanvasTheme('dark')` updates state; preference persists to a namespaced localStorage key; store rehydrates the stored value at creation; an invalid stored value falls back to `'light'`
- [X] T014 [P] [US1] Write FAILING canvas-theme behavior test in `src/components/workbench/canvasTheme.test.tsx`: canvas renders light by default (white background + existing two-layer dot grid); switching to dark changes ONLY the canvas layer to `bg-viz-bg` (`#161616`) with dots `#2a2a2c` at 100% opacity; node cards stay dark in both themes; switching restyles open panels in place without re-anchoring or dismissal (spec edge case) — implemented as `WorkbenchCanvasBackground.test.tsx` (co-located with the extracted canvas-layer component); "node cards stay dark" is covered by the SC-001 visual audit (T065)

### Implementation for User Story 1

- [X] T015 [US1] Implement `src/store/slices/workbenchThemeSlice.ts` — zustand slice with `canvasTheme: CanvasTheme` (`'light' | 'dark'`, default `'light'`) + localStorage persistence (namespaced key, hydrated at store creation); register the slice in `src/store/useStore.ts` — make T013 pass — DEVIATION: implemented as a dedicated persisted store (`useWorkbenchThemeStore`) rather than a slice on `useStore`, because the main store persists scene data to IndexedDB and the theme must never travel with scene data (research R2); same key/shape per state-contract S-1
- [X] T016 [US1] Drive the canvas background + dot-grid layer from `workbenchThemeSlice` in `src/components/workbench/workbench.tsx`: light = current white + existing dots; dark = `bg-viz-bg` + `viz-canvas-dot` (`#2a2a2c`, 100% opacity); applied immediately on change, no project reload — make T014 pass — dot grid extracted to `WorkbenchCanvasBackground.tsx`
- [X] T017 [US1] Add the top-left application menu with a Light/Dark canvas theme control (shadcn `Select`, options "Light" (default) / "Dark") in `src/components/common/ProjectHeader.tsx` (FR-015, ui-translation §3.8) — implemented as two checkable `MenuItemRow`s in the existing application menu (equivalent two-option control)
- [X] T018 [P] [US1] Restyle the top toolbar to tokens in `src/components/workbench/WorkbenchToolbar.tsx` per ui-translation §3.6: container `flex items-center gap-0.5 rounded-xl2 bg-viz-panel border border-viz-border shadow-viz p-1`; buttons `p-1.5 rounded-lg text-viz-muted hover:text-white hover:bg-viz-surface`; active tool `bg-viz-selected text-white` — DEVIATION: container keeps `bg-viz-panel/90 backdrop-blur-md` (existing floating-pill treatment) over the canvas
- [X] T019 [P] [US1] Restyle the zoom cluster in `src/components/studio/CanvasControls.tsx` per ui-translation §3.5: keep current controls (fullscreen, fit, zoom out, %, zoom in, shortcuts help); container `rounded-xl2 bg-viz-panel border border-viz-border shadow-viz px-1.5 py-1`; percentage becomes a button opening a shadcn `Popover` with presets 25/50/75/100/fit — DEVIATION: the standalone reset-zoom button was replaced by the 100% preset (same action); `onResetZoom` prop removed from the chain
- [X] T020 [P] [US1] Restyle the edge remove affordance in `src/components/nodes/CustomEdge.tsx` per ui-translation §3.9: replace hardcoded `#6366f6`/white with `bg-viz-accent border-2 border-viz-bg rounded-full`; keep existing hover/endpoint-selected visibility logic; add a co-located behavior test `src/components/nodes/CustomEdge.test.tsx` asserting the affordance appears on edge hover or endpoint selection and removes the edge on activation (FR-011, quickstart V8.2) — DEVIATION: test renders `CustomEdge` directly with explicit geometry (jsdom cannot measure React Flow nodes, so a full `<ReactFlow>` never renders edges); `useViewport`/`EdgeLabelRenderer` stubbed, `BaseEdge`/`getSmoothStepPath` real
- [X] T021 [US1] Extend the shared NodeCard shell helpers in `src/components/nodes/nodeUi.ts`: card `w-[280px] rounded-xl2 bg-viz-panel border border-viz-border shadow-viz overflow-hidden`; header `flex items-center gap-2 px-3 h-9 border-b border-viz-border` with 14px accent type icon + `text-xs font-medium` label; selection ring `ring-2 ring-viz-accent` (replaces current selection styling); handles restyled to `bg-viz-panel border-2 border-viz-border` — DEVIATION: file renamed `nodeUi.ts` → `nodeUi.tsx` (contains JSX); header label renders as `<h3>` for heading semantics (ModifyNode test contract + a11y)
- [X] T022 [P] [US1] Apply the NodeCard shell to `src/components/nodes/ImageNode.tsx`, `RenderNode.tsx`, `ModifyNode.tsx`, `AnimateNode.tsx` (FR-014: consistent header icon+label, padding, radius, border)
- [X] T023 [P] [US1] Apply the NodeCard shell to `src/components/nodes/TextNode.tsx`, `NoteNode.tsx`, `ArrowNode.tsx`, `FreehandNode.tsx`, `MediaNode.tsx`, `VideoNode.tsx` — DEVIATION: Arrow/Freehand are drawing primitives and get frame-only token restyle (selection ring + tokenized resize/drag handles), no header — a header would offset their SVG geometry; Note keeps its amber surface as the card body (test asserts `bg-amber-100` on root) with a note-styled header; TextNode empty-state placeholder changed from "Text" to "Double-click to edit" (the "Text" label now lives in the header, so the existing test still passes via the header); Image/Video use a dedicated headerless media frame (`mediaNodeFrameClass`) — no inline header; the image title floats above the card when selected (pre-shell behavior restored)

**Checkpoint**: US1 independently testable — full visual audit passes in both canvas themes; theme persists across reload.

---

## Phase 4: User Story 2 - Select a node, get its full action set (Priority: P1)

**Goal**: Selecting an image node shows a floating toolbar above it (Edit, aspect-ratio chip, quick actions, more trigger); the "More" menu presents all grouped actions with shortcut hints; multi-selection degrades sensibly.

**Independent Test**: Select an image node, verify the floating toolbar appears, open the "more" menu, and confirm every grouped action is present with shortcut hints and works or is sensibly disabled.

### Tests for User Story 2 (write FIRST, ensure they FAIL) ⚠️

- [ ] T024 [P] [US2] Write FAILING anchoring-math tests in `src/components/workbench/hooks/useOverlayAnchoring.test.ts`: screen position = `node.positionAbsolute` × viewport transform; panel flips ABOVE the node when its bottom would exceed viewport height − 16px; horizontal clamp to `[16px, width − 16px]`; only the active (last-clicked) node anchors a toolbar/panel
- [ ] T025 [P] [US2] Write FAILING hook tests in `src/components/workbench/hooks/useNodeMoreMenuActions.test.ts`: actions grouped in order image / library & references / organization / clipboard / danger-delete; shortcut hints present for `⌘L` (Copy link), `⌘C`, `⌘D`, `Del`, `]` (Bring to front), `[` (Send to back); per research R11, actions without an existing backend (Remove Background, Add to library, Set/Restore thumbnail, Copy link, Wrap in section — verify each against current services) are disabled WITH a reason; multi-selection enables only whole-selection-valid actions and disables per-node-only actions
- [ ] T026 [P] [US2] Write FAILING behavior test in `src/components/workbench/NodeSelectionToolbar.test.tsx`: toolbar appears above the selected image node with Edit button, aspect-ratio chip whose menu lists exactly 1:1, 4:5, 5:4, 2:3, 3:2, 9:16, 16:9, quick actions (Download, Copy raw image, Add to library), and a "more" trigger; toolbar stays anchored through pan/zoom
- [ ] T027 [P] [US2] Write FAILING behavior test in `src/components/workbench/NodeMoreMenu.test.tsx`: five groups separated by `Separator`; right-aligned Kbd hints where a shortcut exists; Delete row danger-styled (`text-red-400 data-[highlighted]:bg-red-500/15`); menu repositions near viewport edges so it stays fully visible (spec acceptance 3); disabled items are inert

### Implementation for User Story 2

- [ ] T028 [US2] Implement `src/components/workbench/hooks/useOverlayAnchoring.ts` + `src/components/workbench/WorkbenchOverlayLayer.tsx` per ui-translation §5: single overlay layer inside the flow wrapper (`pointer-events-none` root, `pointer-events-auto` per panel), re-render via `useViewport()` subscription (no per-frame rAF) — make T024 pass
- [ ] T029 [US2] Implement `src/components/workbench/hooks/useNodeMoreMenuActions.ts` — data-driven action registry (label, icon, shortcut, group, enabled/reason, handler) wired to existing store actions (z-order, copy/duplicate/delete, download); no backend → disabled with reason (R11) — make T025 pass
- [ ] T030 [P] [US2] Implement `src/components/workbench/NodeSelectionToolbar.tsx` per ui-translation §3.2 (`flex items-center gap-1 rounded-xl2 bg-viz-panel border border-viz-border shadow-viz px-1.5 py-1`, 8px gap above node, `nodrag nopan`) — make T026 pass
- [ ] T031 [US2] Implement `src/components/workbench/NodeMoreMenu.tsx` (data-driven from T029 via `MenuItemRow` + `Separator`, container `w-[206px] rounded-lg bg-viz-surface border border-viz-border shadow-viz p-1`) and wire it into `WorkbenchOverlayLayer.tsx` (more trigger) plus right-click via `src/components/ui/context-menu.tsx` — make T027 pass

**Checkpoint**: US2 independently testable — selection toolbar + full grouped more menu work on image nodes, including multi-selection rules.

---

## Phase 5: User Story 3 - Create any node type in two clicks (Priority: P1)

**Goal**: The add-node menu lists upload options with shortcut hints and a two-column icon grid of all creatable node types; render appears as "Instant Render"; legacy types excluded; upload shortcuts work globally.

**Independent Test**: From an empty canvas, open the add-node menu and create one node of each non-legacy type in two clicks or fewer.

### Tests for User Story 3 (write FIRST, ensure they FAIL) ⚠️

- [ ] T032 [P] [US3] Write FAILING behavior test in `src/components/workbench/AddNodeMenu.test.tsx`: menu is `w-[222px]` with upload group rows "Upload an image" + Kbd `I` and "Upload from phone" + Kbd `/`; two-column icon grid lists Sketch, Instant Render, Animate, Modify, Variate, Extract, New View, Text, Sticky Note, Section, Media/Video; legacy types (Style, Mix, legacy Render, Try on) are absent; selecting a type creates the node at canvas center in its default state and closes the menu
- [ ] T033 [P] [US3] Write FAILING shortcut tests extending `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.test.ts`: pressing `I` with no menu open starts the image upload flow directly; pressing `/` opens the phone-upload flow (ui-translation §6)

### Implementation for User Story 3

- [ ] T034 [US3] Implement `src/components/workbench/AddNodeMenu.tsx` per ui-translation §3.1: shadcn `DropdownMenu.Content` (`w-[222px] rounded-xl2 bg-viz-panel border border-viz-border shadow-viz p-1.5`, `sideOffset={8}`, `align="start"`), upload group, `Separator`, two-column grid; the existing render node is labeled **"Instant Render"** (node type unchanged, FR-004) — make T032 pass
- [ ] T035 [US3] Wire the add-node trigger as the FIRST button in `src/components/workbench/WorkbenchToolbar.tsx` (icon `Plus`, tooltip "Add node") and route its items to existing flows: reuse `useWorkbenchMediaUpload.ts` (upload rows), `useWorkbenchFormatMenu.ts` (sketch formats), `useWorkbenchBlockCreation.ts` / `useWorkbenchOneShotCreation.ts` (node types) so all pre-existing creation paths remain reachable
- [ ] T036 [US3] Create minimal NodeCard-shell components `src/components/nodes/VariateNode.tsx`, `NewViewNode.tsx`, `ExtractNode.tsx` (header icon+label only, body placeholder — full bodies land in US5), register them in the `nodeTypes` map in `src/components/workbench/workbench.tsx`, and add creation defaults per data-model.md (`variate`: count `2 | 4 | 8`; `new-view`: `view: ViewName | null` = `null` placeholder; `extract`: optional prompt, `backgroundHandling: 'transparent' | 'keep'`) — completes T032's "create one node of each non-legacy type"

**Checkpoint**: US3 independently testable — every non-legacy type creatable from the menu in two clicks; SC-002 holds.

---

## Phase 6: User Story 4 - Prompt panel attached to generation nodes (Priority: P2)

**Goal**: Selecting a generation-capable node (Render, Modify, Variate, New View, Extract) attaches a prompt panel below it with `@` references, numbered reference chips, Aspect Ratio/Mode/Resolution settings and Generate; inline forms are removed and unselected cards show a collapsed summary.

**Independent Test**: Select each generation node type, verify the attached panel renders with editor, settings rows and Generate; attach a reference via `@` or the more-menu and confirm it appears as a numbered chip.

### Tests for User Story 4 (write FIRST, ensure they FAIL) ⚠️

- [ ] T037 [P] [US4] Write FAILING hook tests in `src/components/workbench/hooks/usePromptPanel.test.ts`: panel attaches on selection and detaches on deselect/close; Generate is disabled with a clear reason when the prompt is empty AND required inputs are missing (spec acceptance 4); reference chips add/remove re-validate Generate; typing `@` opens the mention picker and selecting an item inserts a chip token; removal of a referenced asset degrades `@` mentions gracefully (spec edge case)
- [ ] T038 [P] [US4] Write FAILING behavior test in `src/components/workbench/PromptPanel.test.tsx`: header shows node-type label + close action; editor placeholder is "Describe your changes (use @ to reference images or assets)"; `@` opens a shadcn `Popover` picker listing project images/assets; each attached reference renders as a numbered chip (1-based by order) with a remove button; settings rows are Aspect Ratio, Mode (`auto | pro`), Resolution (`1k | 2k`); Generate is full-width accent and disabled-with-reason per T037
- [ ] T039 [P] [US4] Write FAILING behavior tests extending `src/components/nodes/RenderNode.test.tsx` and `ModifyNode.test.tsx`: an UNSELECTED generation node shows NO inline settings form — only a collapsed summary of its last prompt (truncated) + aspect/mode/resolution; selecting the node attaches the panel (FR-006, spec acceptance 6)

### Implementation for User Story 4

- [ ] T040 [US4] Implement `src/components/workbench/hooks/usePromptPanel.ts` — reuse existing generation hooks (`useRenderNodeGeneration` and friends) without rewriting generation logic; manage prompt text + `@` tokens, references (reuse `src/components/nodes/modify/ReferenceChips` / `ReferencePicker`), settings rows, and Generate validation — make T037 pass
- [ ] T041 [US4] Implement `src/components/workbench/PromptPanel.tsx` per ui-translation §3.4 (width = max(node width, 280px) capped at 360px; flips above the node near viewport bottom via `WorkbenchOverlayLayer`) — make T038 pass
- [ ] T042 [US4] Remove the inline settings forms from `src/components/nodes/RenderNode.tsx` and `ModifyNode.tsx`; render the collapsed prompt/settings summary when unselected; attach the panel on selection — make T039 pass

**Checkpoint**: US4 independently testable — every generation node type has the attached panel; core loop (upload → prompt → generate) works without inline forms.

---

## Phase 7: User Story 5 - New node types: Variate, New View, Extract (Priority: P2)

**Goal**: The three new node types generate through the backend-agnostic render service (ComfyUI or OpenAI custom image protocol) with capability gating; each has its full body per ui-translation §4.

**Independent Test**: Create each new node type, connect a source image, run its primary action, and verify output appears on the canvas.

### Tests for User Story 5 (write FIRST, ensure they FAIL) ⚠️

- [ ] T043 [P] [US5] Write FAILING service tests in `src/services/renderService.test.ts` (extend existing): new operations `variate`, `new-view`, `extract`, `attribute-apply(style|color|environment)`, `upscale` route through the generic facade by persisted `computeSettings.protocol` (`comfyui` → `comfyRenderService`, `openai-image` → `openAIImageRenderService`); `mockRenderService` implements all five for dev validation; capability gating — an operation unsupported by the active backend disables that node's Generate with a clear reason naming the operation (spec edge case) and re-validates when the backend changes
- [ ] T044 [P] [US5] Write FAILING behavior test in `src/components/nodes/VariateNode.test.tsx`: Count select offers exactly 2/4/8; optional "Vary: form / color / both" segmented control; Generate disabled until a source image is connected and prompt or vary-mode is set; output renders as a grid (2×2 for count 4) with per-image hover actions
- [ ] T045 [P] [US5] Write FAILING behavior test in `src/components/nodes/NewViewNode.test.tsx`: view selector lists Rear, Front, Left, Right, Top, Rear Right 3/4, Rear Left 3/4 plus a "Select a view" placeholder; reference count chip shows `{n} ref`; Generate disabled until `view !== null` AND ≥1 reference connected (FR-007); output is a single image with the view name as caption badge
- [ ] T046 [P] [US5] Write FAILING behavior test in `src/components/nodes/ExtractNode.test.tsx`: optional "what to extract" prompt; background handling select (`transparent | keep`); Count select; running extract produces extracted subject output(s)

### Implementation for User Story 5

- [ ] T047 [US5] Implement the five new operations in `src/services/renderService.ts` (facade contract) and each protocol implementation — ComfyUI render service, `src/services/ai/targets/openAIImageTarget.ts`-backed OpenAI image render service, and `mockRenderService` — per contracts/state-contract.md S-5; wire capability gating through the existing target-capabilities mechanism — make T043 pass
- [ ] T048 [P] [US5] Implement the VariateNode body in `src/components/nodes/VariateNode.tsx` per ui-translation §4.1 (shared `PromptEditor`, Count select 2/4/8, vary-mode segmented control, shared `GenerateButton`) — make T044 pass
- [ ] T049 [P] [US5] Implement the NewViewNode body in `src/components/nodes/NewViewNode.tsx` per ui-translation §4.2 (shadcn `Select` view picker with placeholder, numbered reference chips, ref-count badge) — make T045 pass
- [ ] T050 [P] [US5] Implement the ExtractNode body in `src/components/nodes/ExtractNode.tsx` per ui-translation §4.3 (optional prompt, background-handling select, Count select) — make T046 pass

**Checkpoint**: US5 independently testable — each new node type connects a source, generates via the active backend (or mock), and outputs to the canvas.

---

## Phase 8: User Story 6 - Toolbar, export and shortcut affordances (Priority: P3)

**Goal**: Complete top toolbar with tooltips + shortcuts; Export modal in the top-right (Share discarded); edge remove affordance verified on shared tokens; Smart Dropper with Style/Color/Environment capture-and-drop that always renders a NEW image.

**Independent Test**: Hover every toolbar button (tooltip + shortcut visible), open Export and export a selection, hover an edge (remove affordance appears), and run the full smart-dropper capture→drop flow verifying a new image appears with originals unchanged.

### Tests for User Story 6 (write FIRST, ensure they FAIL) ⚠️

- [ ] T051 [P] [US6] Write FAILING service tests in `src/services/exportService.test.ts`: export is per-asset (multi-selection → one file per asset); JPEG honors quality 0–100 while PNG ignores it; scaling `original` keeps native size; `2k`/`4k` call the backend `upscale` operation when supported and fall back to client-side resize (2048px / 3840px longest edge) when the active backend lacks it — export never fails on missing upscale capability (spec edge case); empty selection → disabled with a clear reason
- [ ] T052 [P] [US6] Write FAILING slice tests in `src/store/slices/absorbedAttributeSlice.test.ts`: exactly one active captured chip at a time; capture stores `{ id, type, sourceNodeId, palette?, capturedAt }` with `palette` present only for `type === 'color'`; chip removal discards it; same-type drop onto a target REPLACES the previous attribute on that target (spec edge case); capture from a source image that fails to load transitions to error with inline feedback and NO chip created (spec edge case)
- [ ] T053 [P] [US6] Write FAILING service tests in `src/services/smartDropperService.test.ts`: pixel-color sampling reads the Konva stage canvas context at the clicked point; palette extraction downsamples the source image on an offscreen canvas and returns an ordered hex list (quantization); style/environment capture stores only `{ sourceNodeId, type }` (no analysis API)
- [ ] T054 [P] [US6] Write FAILING hook tests in `src/components/workbench/hooks/useSmartDropper.test.ts`: `Y` toggles the tool; click on empty canvas samples pixel color and sets it as the active drawing tool's color; with a capture type chosen from the dropdown (style/color/environment), clicking inside a SELECTED image node captures that attribute as a removable chip; clicking inside an unselected or non-image node samples pixel color ONLY (spec acceptance 8); dropping a captured attribute onto another image node triggers `attribute-apply` and adds a NEW image node with source and target unchanged (FR-016); dropping onto a non-image node or empty canvas applies nothing and shows invalid-target feedback
- [ ] T055 [P] [US6] Write FAILING behavior test in `src/components/workbench/ExportModal.test.tsx`: centered shadcn `Dialog`; left column lists selected assets; right column offers Export format (JPEG/PNG), Quality 0–100%, Scaling (Original/2K/4K upscaling) and a source preview (first selected asset); full-width Export button at the bottom; with no selection the modal lists no assets and Export is disabled with a clear reason (FR-010, spec edge case)
- [ ] T056 [P] [US6] Write FAILING behavior tests extending `src/components/workbench/WorkbenchToolbar.test.tsx`: toolbar exposes Add node, Library, Select `V`, Text `T`, Sticky Note `N`, Section, Smart Dropper `Y`, Draw `D`, Eraser `E`, Arrow `A`, Undo `⌘Z`, Redo in that order (FR-009); EVERY button tooltip shows its name and Kbd shortcut where assigned (FR-008, SC-003); Library opens a popover of project image assets

### Implementation for User Story 6

- [ ] T057 [US6] Implement `src/services/exportService.ts` per contracts/state-contract.md S-3: per-asset pipeline — for `2k`/`4k` call the `upscale` render operation on the active backend first, else client-side resize; encode JPEG (quality 0–100) or PNG via offscreen canvas → downloadable blobs — make T051 pass
- [ ] T058 [US6] Implement `src/components/workbench/hooks/useWorkbenchExport.ts` + `src/components/workbench/ExportModal.tsx` (ui-translation §3.7) and add the Export button to the top-right cluster LEFT of the existing compute/collab chips in `src/components/workbench/WorkbenchChrome.tsx` — make T055 pass
- [ ] T059 [US6] Extend `src/components/workbench/WorkbenchToolbar.tsx`: Library (project-assets popover), Section tool, Smart Dropper button; wrap every button in shadcn `Tooltip` with label + `<Kbd>` shortcut per ui-translation §3.6/§6 — make T056 pass
- [ ] T060 [US6] Implement `src/store/slices/absorbedAttributeSlice.ts` per data-model.md lifecycle (idle → capturing → captured/sampled/error → applied/discarded) and register it in `src/store/useStore.ts` — make T052 pass
- [ ] T061 [US6] Implement `src/services/smartDropperService.ts`: Konva stage pixel sampling + offscreen-canvas palette quantization; style/environment capture as source-reference only (research R5) — make T053 pass
- [ ] T062 [US6] Implement `src/components/workbench/hooks/useSmartDropper.ts` + `src/components/workbench/SmartDropperControls.tsx` (capture-type dropdown offering exactly Style / Color / Environment + removable captured chip) and register the `Y` shortcut in `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts` — make T054's tool/capture cases pass
- [ ] T063 [US6] Wire attribute drop: dragging a captured chip onto an image node calls the `attribute-apply(style|color|environment)` render operation (T047) and appends a NEW image node; invalid-target feedback for non-image/empty-canvas drops; same-type replace via `absorbedAttributeSlice` — make T054's drop cases pass

**Checkpoint**: All user stories independently functional — full toolbar, export modal, and smart dropper work end to end.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature validation against success criteria.

- [ ] T064 Run every scenario in `specs/006-vizcom-workbench-parity/quickstart.md` (V1–V6) end to end and fix any gaps found
- [ ] T065 [P] Perform the SC-001 visual audit: 100% of chrome surfaces (toolbars, menus, panels, zoom cluster) and node cards on the shared token set in BOTH canvas themes; zero off-palette colors; document any deviation with rationale
- [ ] T066 Verify every new/modified file is ≤300 lines (`find src -name '*.ts*' | xargs wc -l`); split any offender by Logic/View/Types per AGENTS.md refactoring rules
- [ ] T067 Run `pnpm run build` (tsc + vite) and `pnpm run lint`; fix all errors — no `any`, no `@ts-ignore`
- [ ] T068 Run `pnpm run test:ci` (headless + coverage gate); confirm the coverage floor did not regress
- [ ] T069 [P] Accessibility pass per FR-013 across all new surfaces (`AddNodeMenu`, `NodeSelectionToolbar`, `NodeMoreMenu`, `PromptPanel`, `ExportModal`, `SmartDropperControls` dropdown, zoom popover): keyboard-navigable, focus-managed, dismissible via Escape with focus returned to the trigger

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phases 3–8)**: All depend on Foundational completion
  - US1, US2, US3 (P1) can proceed in parallel after Phase 2 (staffing permitting), with the same-file caveats below
  - US4 depends on US2's `WorkbenchOverlayLayer` (T028) — the prompt panel anchors through it
  - US5 depends on US3's node shells + registration (T036) and Foundational types (T012)
  - US6 is last (P3); its toolbar work (T059) must follow US3's toolbar wiring (T035)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories
- **US2 (P1)**: After Foundational — independent of US1/US3 (overlay layer is self-contained)
- **US3 (P1)**: After Foundational — independent; T036 creates the shells US5 later fleshes out
- **US4 (P2)**: Needs T028 (US2 overlay layer); otherwise independent
- **US5 (P2)**: Needs T012 (types) + T036 (shells/registration)
- **US6 (P3)**: Needs T047 (attribute-apply operation) for the dropper drop flow; toolbar tasks need T035 done first

### Within Each User Story

- Tests MUST be written and FAIL before implementation (constitution principle II)
- Slices/services/hooks before the components that consume them
- Core implementation before integration into shared surfaces (toolbar, chrome, workbench view)
- Story complete before moving to next priority

### Same-File Caveats (do NOT parallelize these pairs)

- `src/components/workbench/WorkbenchToolbar.tsx`: T018 (US1 restyle) → T035 (US3 add-node trigger) → T059 (US6 extension) — sequential
- `src/components/workbench/workbench.tsx`: T016 (US1 theme layer) before T036 (US3 nodeTypes registration)
- `src/components/nodes/RenderNode.tsx` / `ModifyNode.tsx`: T022 (US1 shell) before T042 (US4 inline-form removal)

### Parallel Opportunities

- Phase 1: T002 parallel with T001's verification
- Phase 2: all seven primitive tasks (T003–T009) + T010/T012 in parallel; T011 after T010+T003
- Within stories: all red-test tasks marked [P] start together; implementation tasks marked [P] run in parallel once their tests exist
- Across stories: US1/US2/US3 in parallel (respecting the same-file caveats); US4 + US5 in parallel once T028/T036 land

---

## Parallel Example: User Story 2

```bash
# Launch all red tests together:
Task: "Anchoring-math tests in src/components/workbench/hooks/useOverlayAnchoring.test.ts"
Task: "More-menu action hook tests in src/components/workbench/hooks/useNodeMoreMenuActions.test.ts"
Task: "Selection toolbar behavior test in src/components/workbench/NodeSelectionToolbar.test.tsx"
Task: "More menu behavior test in src/components/workbench/NodeMoreMenu.test.tsx"

# Then implementations (T030 parallel with T028/T029; T031 last):
Task: "useOverlayAnchoring + WorkbenchOverlayLayer"
Task: "useNodeMoreMenuActions"
Task: "NodeSelectionToolbar"  # parallel — different file
Task: "NodeMoreMenu + wiring"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: visual audit in both canvas themes; theme persists across reload
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 (consistent surface + theme) → validate → demo (MVP!)
3. US2 (selection toolbar + more menu) → validate → demo
4. US3 (add-node menu) → validate → demo — all P1 parity delivered
5. US4 (prompt panel) → validate → demo — core loop unified
6. US5 (new node types) → validate → demo
7. US6 (toolbar/export/dropper) → validate → demo — full parity
8. Phase 9 polish → quickstart V1–V6 green → ship

### Parallel Team Strategy

With multiple developers after Foundational:

1. Developer A: US1 (tokens, theme, restyles)
2. Developer B: US2 (overlay layer, toolbar, more menu)
3. Developer C: US3 (add-node menu, creation flows)
4. Once T028 + T036 land: Developer B → US4, Developer C → US5
5. US6 last (touches shared toolbar/chrome; needs T047 for dropper drop)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Every logic-layer task has a red test written in the same story phase BEFORE it (constitution II)
- All generation routes through `src/services/renderService.ts` — never call ComfyUI or OpenAI directly from components (research R4)
- Per research R11: More-menu actions without a backend render disabled with a tooltip reason — do NOT stub fake backends
- Per research R12: Smart Dropper prompt-panel conditioning is OUT of scope — v1 is capture + drop-to-image only
- Commit after each task or logical group; stop at any checkpoint to validate the story independently
