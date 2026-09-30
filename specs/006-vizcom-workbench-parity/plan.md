# Implementation Plan: Vizcom Workbench UI Parity

**Branch**: `006-vizcom-workbench-parity` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-vizcom-workbench-parity/spec.md`, with the
component-level translation in [ui-translation.md](./ui-translation.md).

## Summary

Bring `projects/[id]/workbench` to visual and interaction parity with the reference
product: a unified `viz-*` token language across all chrome surfaces, a Light/Dark canvas
theme control (top-left menu, persisted per-user), a floating selection toolbar + grouped
"More" menu on image nodes, a rich add-node menu, an attached prompt panel replacing inline
forms on generation nodes, three new node types (Variate, New View, Extract), an Export
modal (Share discarded), and the Smart Dropper with Style/Color/Environment attribute
capture-and-drop. All menus/popups built on shadcn + Radix primitives; all state via
zustand slices and react-query; generation strictly through `src/services/`.

## Technical Context

**Language/Version**: TypeScript (strict) on React 19, Next.js 16 app runtime (repo is mid-migration from Vite — no second bundler entry point)

**Primary Dependencies**: @xyflow/react 12 (node graph), konva/react-konva (freehand overlay + pixel sampling), zustand 4 (client state slices), @tanstack/react-query 5 (server state / generation jobs), framer-motion 11 (transitions), Tailwind CSS 3.4 (`viz-*` tokens). New Radix packages to add: `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-scroll-area` (dropdown-menu, context-menu, tooltip, slot already present).

**Storage**: Client-side persistence for the canvas theme preference (localStorage via a zustand slice; not scene data, no DB migration). Generation outputs and node graph persist through the existing scene-persistence path.

**Testing**: Vitest + React Testing Library (component behavior tests derived from spec acceptance criteria), strict red-green for logic layers (services, hooks, store slices, utils). Coverage floor may never regress.

**Target Platform**: Web (desktop-first; modern evergreen browsers)

**Project Type**: Web application (single Next.js app; workbench route `projects/[id]/workbench`)

**Performance Goals**: Overlay toolbars/panels track pan/zoom without per-frame rAF (viewport subscription only); menus open <100ms perceived; export of a typical selection (<20 assets) completes in under 30s client-side.

**Constraints**: No `any`/`@ts-ignore`; files ≤300 lines (split Logic/View/Types); named exports; absolute imports `@/...`; ALL generation routes through the backend-agnostic `renderService` facade in `src/services/` — active protocol is ComfyUI or the OpenAI custom image API per persisted compute settings, never hardcoded; Radix for all accessible primitives; Tailwind-only styling.

**Scale/Scope**: ~12 node types, 6 new shadcn primitives, 3 new node components, 1 overlay layer, 1 export service, 1 theme slice; touches existing toolbar, edge, zoom cluster, and Render/Modify nodes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety (no `any`, no `@ts-ignore`) | PASS | New unions (`NodeType + 'variate' \| 'new-view' \| 'extract'`, `AbsorbedAttributeType = 'style' \| 'color' \| 'environment'`, export options) fully typed; pixel-sampling results typed. |
| II. Test-First, Layered | PASS (by design) | Logic layers (theme slice, dropper logic, export service, overlay anchoring math, node action hooks) get failing tests first; components get behavior tests from spec acceptance scenarios before implementation. Coverage floor never regresses. |
| III. State Architecture | PASS | Canvas theme + captured attributes live in new zustand slices (`src/store/slices/`); generation jobs stay on existing react-query patterns; all effects/fetches in `use[Feature].ts` hooks per ui-translation §7 file map. |
| IV. Styling & UI Primitives | PASS (with dep additions) | Tailwind-only via `viz-*` tokens; Radix added: dialog, popover, select, separator, scroll-area. Framer Motion for panel transitions only where existing patterns use it. |
| V. Module Boundaries & File Limits | PASS (by design) | ui-translation §7 file map keeps every new file well under 300 lines; `workbench.tsx` already refactored to 284 lines — new chrome goes into `WorkbenchChrome.tsx` + dedicated components, not the view. Named exports + absolute imports throughout. |
| Stack constraints (Next.js app runtime, services-only generation, Drizzle) | PASS | No bundler entry changes; all generation (including Smart Dropper attribute application and new node types) routes through the backend-agnostic `renderService` facade in `src/services/` (ComfyUI or OpenAI custom image protocol); export scaling is client-side; no schema changes (theme preference is client-side). |

**Gate result: PASS — no violations to justify.**

**Post-design re-check (after Phase 1): PASS** — data model, contracts and file map introduce
no new violations; all new state is slice/hook-bound, all generation stays in
`src/services/`, and every new component has a dedicated <300-line home.

## Project Structure

### Documentation (this feature)

```text
specs/006-vizcom-workbench-parity/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (ui-contract.md, state-contract.md)
├── ui-translation.md    # Pre-existing companion (consumed by plan/tasks)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── ui/                          # shadcn primitives (extend existing button, tooltip)
│   │   ├── dropdown-menu.tsx        # new
│   │   ├── context-menu.tsx         # new (replaces ad-hoc PositionedMenu usage)
│   │   ├── popover.tsx              # new (@ mention picker, zoom presets)
│   │   ├── select.tsx               # new (aspect/mode/resolution, export options)
│   │   ├── dialog.tsx               # new (export modal)
│   │   ├── separator.tsx            # new (menu group dividers)
│   │   ├── scroll-area.tsx          # new (long menus)
│   │   └── kbd.tsx                  # new (shortcut hints)
│   ├── workbench/
│   │   ├── AddNodeMenu.tsx          # US3 — rich add-node menu (§3.1)
│   │   ├── NodeSelectionToolbar.tsx # US2 — floating toolbar above selected node (§3.2)
│   │   ├── NodeMoreMenu.tsx         # US2 — data-driven grouped "more" menu (§3.3)
│   │   ├── PromptPanel.tsx          # US4 — attached prompt panel (§3.4)
│   │   ├── ExportModal.tsx          # US6 — centered export dialog (FR-010)
│   │   ├── WorkbenchOverlayLayer.tsx# shared anchoring layer for toolbar+panel (§5)
│   │   ├── SmartDropperControls.tsx # FR-016 — capture-type dropdown + captured chip
│   │   ├── menu/MenuItemRow.tsx     # shared menu row with icon + Kbd
│   │   └── hooks/
│   │       ├── useNodeMoreMenuActions.ts
│   │       ├── usePromptPanel.ts
│   │       ├── useWorkbenchExport.ts
│   │       ├── useSmartDropper.ts
│   │       └── useOverlayAnchoring.ts
│   └── nodes/
│       ├── VariateNode.tsx          # US5 (§4.1)
│       ├── NewViewNode.tsx          # US5 (§4.2)
│       ├── ExtractNode.tsx          # US5 (§4.3)
│       ├── nodeUi.ts                # shared NodeCard shell helpers (extend)
│       └── modify/                  # existing ReferenceChips/ReferencePicker reused by PromptPanel
├── services/
│   ├── exportService.ts             # asset compositing → JPEG/PNG, quality, scaling
│   ├── smartDropperService.ts       # pixel sampling + palette extraction; style/env via workflows
│   └── ai/                          # existing targets/capabilities — new backend-agnostic operations (variate, new-view, extract, attribute-apply, upscale)
├── store/slices/
│   ├── workbenchThemeSlice.ts       # FR-015 — light/dark preference + persistence
│   └── absorbedAttributeSlice.ts    # FR-016 — captured attribute chips + drop state
└── types/                           # NodeType extension, AbsorbedAttribute, ExportOptions, View names
```

**Structure Decision**: Single-project web app (existing Next.js app). All new code follows
the AGENTS.md folder mapping: UI in `src/components/`, logic in `src/services/` + hooks,
state in `src/store/slices/`, types in `src/types/`. No new packages or entry points.

## Complexity Tracking

> No Constitution Check violations — nothing to justify.
