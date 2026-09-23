# Implementation Plan: Workbench Toolbar Tools

**Branch**: `001-workbench-toolbar-tools` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-workbench-toolbar-tools/spec.md`

## Summary

Formalize and complete the workbench toolbar: eight tools (Select, Hand, Draw, Eraser, Arrow, Text, Note, Media) with single-key shortcuts, sticky vs one-shot semantics, image upload, and honest phone-upload placeholder. A large portion already exists as WIP on this branch; the remaining work is **test-first completion of missing logic tests, constitution-mandated refactors of two oversized files, a Radix migration of the custom submenus, and full acceptance verification**.

## Technical Context

**Language/Version**: TypeScript (strict), React 19
**Primary Dependencies**: zustand (tool state), @xyflow/react (canvas graph), react-konva/konva (freehand overlay), Radix UI (menus), Vitest + RTL (tests)
**Storage**: N/A for this feature (media images are session-scoped object URLs; no persistence)
**Testing**: Vitest 4 (jsdom default via `vitest.config.ts`), React Testing Library, coverage floor enforced by CI
**Target Platform**: Desktop browser (web app)
**Project Type**: Web application (Next.js runtime + canvas workbench)
**Performance Goals**: Tool switch and node creation feel instant (<100ms interaction latency); no jank on arrow endpoint dragging at 60fps
**Constraints**: No `any`/`@ts-ignore`; files ≤300 lines; Tailwind-only styling; existing shortcuts (Mod+z/y/c/v/d, Delete, `[`, `]`) unchanged
**Scale/Scope**: Single-user canvas, tens-to-hundreds of nodes per workbench

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Type safety | ✅ Pass | WIP is strongly typed (`WorkbenchToolType`, node unions); `tsc --noEmit` green; maintain |
| II | Test-first layered | ⚠️ Gap → tasks | Tool state machine, one-shot/sticky logic, arrow geometry, media upload logic have **no tests yet** — implementation tasks must be test-first (red→green) |
| III | State architecture | ✅ Pass | `activeWorkbenchTool` in zustand workbench slice; effects in `useWorkbench*` hooks; no server state involved |
| IV | Styling & UI primitives | ⚠️ Gap → tasks | Media/Create-new submenus are custom dropdowns — migrate to Radix `DropdownMenu` (dep already present) for keyboard nav + focus management |
| V | Module boundaries & file limits | ⚠️ Partial → exception | `workbench.tsx` 636→**284** lines (split ✅). `workbenchSlice.ts` stays **951 lines** — resolved as an **accepted exception** (see below): a forced split would fragment one cohesive slice that shares `commitWorkbenchHistory()` + `projectNodes` sync across every action. |

**Gate result**: two gaps + one violation — all have dedicated tasks (T-REF*, T-RADIX, test-first T-TEST*). No unjustified violations.

### Accepted exceptions

| File | Line count | Why not split | Follow-up |
|------|-----------|---------------|-----------|
| `src/store/slices/workbenchSlice.ts` | 951 | One cohesive zustand slice: ~30 actions all route through the shared `commitWorkbenchHistory()` snapshot mechanism and the `projectNodes` per-project sync. A line-count or concern-based split produces interdependent fragments (e.g. a ~20-line connections file beside a ~600-line nodes file) with more cross-file indirection and no clarity gain — i.e. forced, not improving. | The real smell is 4×-duplicated sketch/node construction in `createNewSketch` / `createSketchWithFormat` / `addGroupToWorkbench` / `addImageToWorkbench`. That cluster has **zero test coverage**, so deduping it now would violate Constitution II (test-first). Out-of-pilot follow-up: add characterization tests for those actions, then extract a pure `workbenchNodeFactory` module. |

## Project Structure

### Documentation (this feature)
```
specs/001-workbench-toolbar-tools/
├── spec.md               # Feature specification (done)
├── plan.md               # This file
├── research.md           # Phase 0 decisions
├── data-model.md         # Phase 1 entities
├── quickstart.md         # Validation guide
├── contracts/
│   └── ui-contract.md    # Toolbar/mode/node interaction contract
└── checklists/
    └── requirements.md   # Spec quality checklist (done)
```

### Source Code (repository root)
Existing layout per AGENTS.md folder mapping; this feature touches:
```
src/types/index.ts                          # WorkbenchToolType, node unions (exists)
src/store/slices/workbenchSlice.ts          # tool state + actions (accepted exception — see Accepted exceptions)
src/store/workbenchTools.ts                 # NEW: pure tool semantics (sticky/one-shot, key map)
src/components/workbench/workbench.tsx      # view (SPLIT — 636 lines)
src/components/workbench/WorkbenchToolbar.tsx   # toolbar UI (Radix submenus)
src/components/workbench/hooks/             # useWorkbench* hooks (extracted handlers)
src/components/nodes/{Arrow,Text,Note,Media}Node.tsx  # node components (exist)
src/services/workbench/arrowGeometry.ts     # NEW: pure arrow path/resize math + tests
```

**Structure Decision**: Option 2 (web application) — single frontend repo; all changes stay inside `src/` per folder mapping. No new top-level directories.

## Complexity Tracking

| Complexity | Justification | Task |
|------------|---------------|------|
| `workbenchSlice.ts` kept whole (accepted exception) | Forced split would fragment one cohesive slice sharing history + project-sync; dedup blocked by missing tests (see Accepted exceptions) | T027 |
| Radix submenu migration | Constitution IV; replaces custom dropdown lacking keyboard nav | T026 |
| Arrow geometry module | Resize-normalization edge case (spec) needs pure, unit-testable math | T014 |

## Phase 0 — Research
See [research.md](./research.md). All NEEDS CLARIFICATION resolved during clarify; research covers: one-shot/sticky semantics placement, object-URL lifecycle, Radix migration approach, slice-split strategy.

## Phase 1 — Design & Contracts
- Entities: [data-model.md](./data-model.md)
- Interface contract (UI behavior): [contracts/ui-contract.md](./contracts/ui-contract.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Implementation Sequence (summary — detail in tasks.md)

1. **Test-first logic completion** (Constitution II): pure tool-semantics module + tests; arrow geometry module + tests; media upload logic extraction + tests; one-shot behavior store action + tests.
2. **Radix submenu migration** (Constitution IV): Media + Create-new menus via `DropdownMenu` (T026).
3. **Refactors** (Constitution V): split `workbench.tsx` 636→284 lines into hooks + `WorkbenchChrome` (T028 ✅); `workbenchSlice.ts` resolved as an accepted exception rather than a forced split (T027 — see Accepted exceptions).
4. **Object-URL lifecycle**: revoke on media node deletion (T024).
5. **Verification**: full acceptance matrix (quickstart.md), coverage ratchet, converge (T029–T030).
