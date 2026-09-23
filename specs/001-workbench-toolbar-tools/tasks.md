# Tasks: Workbench Toolbar Tools

**Feature**: 001-workbench-toolbar-tools | **Branch**: `001-workbench-toolbar-tools`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contract**: [contracts/ui-contract.md](./contracts/ui-contract.md)

## Format: `[ID] [P?] [Story] Description`

- `[P]` = parallelizable (different files, no dependency on unfinished tasks)
- Story labels: US1–US4 map to spec user stories P1–P4
- TDD rule (Constitution II): test tasks precede their implementation task; write the failing test first

## Path Conventions

Repo root: `/Users/FuturiaWorks/dev/openviz`. Tests colocate with code (`*.test.ts(x)`).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T00- [X] T001 Verify feature branch environment: run `bash .specify/scripts/bash/check-prerequisites.sh --json` from repo root and confirm BRANCH=`001-workbench-toolbar-tools`, FEATURE_DIR resolves
- [X] T00- [X] T002 [P] Confirm test harness baseline: run `pnpm test` and record pass count (expect 13 files / 48+ tests green) before any changes

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T00- [X] T003 [P] Write failing tests for pure tool semantics in `src/store/workbenchTools.test.ts`: shortcut map `{v:'select',h:'hand',d:'draw',e:'eraser',a:'arrow',t:'text',n:'note',m:'media'}`; sticky set = {draw, eraser}; `isOneShotTool` true for arrow/text/note/media only (FR-006/FR-007)
- [X] T00- [X] T004 Implement `src/store/workbenchTools.ts`: export `TOOL_SHORTCUT_MAP`, `STICKY_TOOLS`, `isStickyTool(tool)`, `isOneShotTool(tool)`; make T003 pass (research R1)
- [X] T00- [X] T005 Write failing tests for one-shot creation action in `src/store/slices/workbenchSlice.test.ts` (new file): `createOneShotNode(node)` must append node, set it selected/active, and set `activeWorkbenchTool:'select'` in a single update (FR-007, C-4.x)
- [X] T00- [X] T006 Implement `createOneShotNode` store action in `src/store/slices/workbenchSlice.ts`; replace the WIP view-layer `makeOneShotNode` callback call sites to use it; make T005 pass (research R2)
- [X] T00- [X] T007 Refactor `src/components/workbench/hooks/useWorkbenchKeyboardShortcuts.ts` to consume `TOOL_SHORTCUT_MAP` from `workbenchTools.ts` (remove duplicated inline map); add hook test `useWorkbenchKeyboardShortcuts.test.ts`: key press activates tool, input/contenteditable focus suppresses shortcuts (C-2.2, C-2.3), AND regression assertions that pre-existing bindings are unchanged: Mod+z/Mod+y undo-redo, Mod+c/v/d copy/paste/duplicate, Delete/Backspace removes selection, `[`/`]` reorder (FR-017)

## Phase 3: User Story 1 - Toolbar UI & Tool Activation (Priority: P1) 🎯 MVP

**Goal**: Eight tools visible in order with tooltips/shortcuts; click or key activates a tool; active state is visually and programmatically clear.
**Independent test**: toolbar renders 8 ordered buttons; clicking or pressing V/H/D/E/A/T/N/M changes `activeWorkbenchTool`; active button has `aria-pressed="true"`.

### Tests for User Story 1 ⚠️ (TDD — requested)
- [ ] T008 [P] [US1] Write failing component tests in `src/components/workbench/WorkbenchToolbar.test.tsx`: 8 buttons in order Select,Hand,Draw,Eraser,Arrow,Text,Note,Media; each tooltip contains label + shortcut key (e.g. "Arrow (A)"); clicking a button calls `setActiveWorkbenchTool` with that tool (C-1.1, C-1.2, C-2.1)
- [ ] T009 [P] [US1] Write failing test in `WorkbenchToolbar.test.tsx`: active tool's button has `aria-pressed="true"` and distinct styling; all others `"false"` (C-1.3)

### Implementation for User Story 1
- [ ] T010 [US1] Implement/adjust `src/components/workbench/WorkbenchToolbar.tsx` to satisfy C-1.1–C-1.3 and C-2.1; make T008/T009 pass

## Phase 4: User Story 2 - One-Shot Creation Tools (Priority: P1) 🎯 MVP

**Goal**: Arrow (drag), Text (click), Note (click) each create exactly one item at the pointer, auto-switch to Select, and select the new item.
**Independent test**: with arrow/text/note tool active, a single canvas interaction creates one item, `activeWorkbenchTool` becomes `'select'`, and the new node id is in the selection.

### Tests for User Story 2 ⚠️ (TDD — requested)
- [ ] T011 [P] [US2] Write failing tests for arrow geometry in `src/services/workbench/arrowGeometry.test.ts`: quadratic Bézier path string from `{start,end,control}`; `normalizeArrowForResize(arrow, oldSize, newSize)` re-scales start/end/control by the size ratio so shape is preserved without distortion (data-model: "on resize, all three points re-scale by (newSize/oldSize)")
- [ ] T012 [P] [US2] Write failing component behavior tests in `src/components/workbench/workbench.test.tsx` (extend existing): arrow drag creates one arrow node then tool auto-switches to select with the new node selected (C-4.1); text click places text item with default content + auto-switch (C-4.2); note click places note + auto-switch (C-4.3)
- [ ] T013 [P] [US2] Write failing tests in `src/components/nodes/ArrowNode.test.tsx`: dragging an endpoint or the midpoint control updates path live; releasing outside canvas bounds does not throw (C-5.1, spec edge case)

### Implementation for User Story 2
- [ ] T014 [US2] Implement `src/services/workbench/arrowGeometry.ts` (pure math: path computation, hit-test helpers, resize normalization); make T011 pass (research R3)
- [ ] T015 [US2] Refactor `src/components/nodes/ArrowNode.tsx` to use `arrowGeometry.ts` for path + endpoint/control drag math; make T013 pass
- [ ] T016 [US2] Verify/complete one-shot creation handlers in `src/components/workbench/workbench.tsx` (arrow drag-end, text click, note click) route through `createOneShotNode`; make T012 pass
- [ ] T016a [P] [US2] Write failing tests for text/note editing in `src/components/nodes/TextNode.test.tsx` and `src/components/nodes/NoteNode.test.tsx`: double-click enters edit mode, single-click only selects, Enter inserts newline while editing, Escape or blur exits edit mode retaining content (C-5.3, FR-009/FR-010)
- [ ] T016b [P] [US2] Write failing test in `src/components/workbench/hooks/useWorkbench.connectionLogic.test.ts` (extend existing): connection creation is excluded when either node type is arrow/text/note/media; existing types remain connectable (C-6.2, FR-015)
- [ ] T016c [US2] Verify/complete text & note edit-mode handling in `src/components/nodes/TextNode.tsx` / `NoteNode.tsx` and connection-policy exclusion for the four new node types; make T016a/T016b pass

## Phase 5: User Story 3 - Sticky Modes & Canvas Interaction (Priority: P2)

**Goal**: Draw and Eraser remain active across actions; Select gives click/multi/box select + drag; Hand pans with selection disabled.
**Independent test**: after a freehand stroke, tool is still `draw`; React Flow props reflect mode (selectionOnDrag/panOnDrag/nodesDraggable per C-3).

### Tests for User Story 3 ⚠️ (TDD — requested)
- [ ] T017 [P] [US3] Write failing tests in `src/store/slices/workbenchSlice.test.ts`: freehand stroke completion and eraser action do NOT change `activeWorkbenchTool` (sticky, FR-006); switching draw↔eraser works directly (C-2.1)
- [ ] T018 [P] [US3] Write failing component test in `src/components/workbench/workbench.test.tsx`: React Flow receives `selectionOnDrag=true, elementsSelectable=true, nodesDraggable=true` in select mode and `panOnDrag=true` with selection disabled in hand mode (C-3.1, C-3.2)

### Implementation for User Story 3
- [ ] T019 [US3] Verify/adjust sticky behavior + mode-derived props in `src/components/workbench/workbench.tsx` and slice; make T017/T018 pass (existing WIP mostly covers this — expect small diffs)

## Phase 6: User Story 4 - Media Upload (Priority: P2)

**Goal**: Media tool submenu offers Upload (image picker) + Upload from phone; uploads create an image node near viewport center; non-images rejected; failed loads show fallback.
**Independent test**: selecting an image file creates one media node with `blob:` src, selected, tool back to select; a non-image file creates nothing; deleting the node revokes its object URL.

### Tests for User Story 4 ⚠️ (TDD — requested)
- [ ] T020 [P] [US4] Write failing tests for media upload logic in `src/services/workbench/mediaUploadLogic.test.ts`: file validation accepts only `image/*` mime types (FR-012 "accepts image files"); node builder produces a `media` node with `{src, alt: fileName || 'Uploaded media', mimeType}` and viewport-center placement offset (data-model Media entity fields)
- [ ] T021 [P] [US4] Write failing tests in `src/store/slices/workbenchSlice.test.ts`: removing a media node whose `data.src` starts with `blob:` calls `URL.revokeObjectURL(src)`; non-blob srcs are untouched (spec edge case: no leak across add/remove cycles)
- [ ] T022 [P] [US4] Write failing component tests in `src/components/nodes/MediaNode.test.tsx`: image error state renders fallback (icon + alt text), not broken-image glyph (C-5.4); and in `WorkbenchToolbar.test.tsx`: Media submenu contains exactly "Upload" and "Upload from phone" (C-1.4)

### Implementation for User Story 4
- [ ] T023 [US4] Implement `src/services/workbench/mediaUploadLogic.ts` (pure: validation + node building); make T020 pass (research R4)
- [ ] T024 [US4] Wire object-URL revocation into the node-removal path in `src/store/slices/workbenchSlice.ts`; make T021 pass
- [ ] T025 [US4] Refactor `handleMediaUploadChange`/phone-upload handlers in `src/components/workbench/workbench.tsx` to use `mediaUploadLogic.ts`; verify phone-upload flow gives explicit feedback (modal/toast, never silent no-op — C-4.5); make T022 pass

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T026 Migrate Media and Create-new submenus in `src/components/workbench/WorkbenchToolbar.tsx` to Radix `DropdownMenu` (`@radix-ui/react-dropdown-menu`): keyboard navigation, Escape-to-close, focus return; keep C-1.4/C-1.5 behavior tests green (Constitution IV, research R5). **Done** — Media button is now a `DropdownMenu.Trigger`, Upload/Upload-from-phone are `DropdownMenu.Item`s, Create-new is a `DropdownMenu.Sub`. Custom backdrop/state removed for these menus. C-1.4/C-1.5 tests green (Radix opens on `pointerdown` in jsdom).
- [x] T027 **RESOLVED AS ACCEPTED EXCEPTION** — do NOT force-split `src/store/slices/workbenchSlice.ts`. Rationale: every action shares `commitWorkbenchHistory()` + the `projectNodes` sync, so a line-count/concern split yields interdependent fragments (a ~20-line connections file beside a ~600-line nodes file) with more indirection and no clarity win. The one genuine improvement (deduping the 4x-repeated sketch/node factory in `createNewSketch`/`createSketchWithFormat`/`addGroupToWorkbench`/`addImageToWorkbench`) is **blocked by missing tests** — that cluster has zero coverage, so refactoring it would violate Constitution II. Follow-up (out of pilot scope): write characterization tests for the sketch-creation actions first, then extract a pure `workbenchNodeFactory`. See plan.md "Accepted exceptions".
- [x] T028 Split `src/components/workbench/workbench.tsx` (636 lines): extract handler clusters into `useWorkbench*` hooks + presentational overlay; view ≤300 lines; tests green (Constitution V, research R6). **Done** — 636 → **284 lines** via `useWorkbenchFreehandEraser`, `useWorkbenchMediaUpload`, `useWorkbenchContextMenuActions`, `useResizeObserverWarningSuppression` hooks + `WorkbenchChrome.tsx` (presentational overlay: header/toolbar/zoom/context-menu/blocks-menu/media-input/phone-modal).
- [x] T029 Run full acceptance matrix from `quickstart.md` (17 manual rows + automated gate): `pnpm lint && pnpm typecheck && pnpm test:ci`; record new coverage numbers and ratchet the floor in `vitest.config.ts` if any metric improved ≥1 point. **Done** — gate green: 0 lint errors, tsc clean, 154/154 tests (25 files). Coverage 47.53/42.88/40.54/49.19 (stmts/branch/funcs/lines) — all four metrics improved ≥1pt over baseline; floors ratcheted to 46/41/39/48 in `vitest.config.ts`.
- [x] T030 Convergence check: diff scoped to feature work (`afbe835..HEAD`, WIP baseline); confirm no changes outside workbench toolbar scope except constitution-mandated refactors; update `../../docs/development/spec-driven-development.md` Sprint 3 status. **Done** — all in-scope (Spec-Kit tooling, test infra, spec docs, toolbar feature code/tests, T028 view split). One unrelated pre-existing working-tree change (secure-context `generateUUID()` fix) was entangled with two feature files → committed separately as its own fix commit. Plan Sprint 3 status updated to COMPLETE.

## Dependencies & Execution Order

### Phase Dependencies
- Phase 1 → Phase 2 (baseline must be green before touching logic)
- Phase 2 → Phases 3–6 (shared tool semantics + one-shot action are prerequisites)
- Phases 3–6 are mutually independent after Phase 2 (any order; suggested: US1, US2, then US3/US4 in parallel)
- Phase 7 last (refactors rely on the test safety net from all stories)

### User Story Dependencies
- US1: none beyond Phase 2
- US2: needs T006 (`createOneShotNode`)
- US3: needs T004 (sticky classification)
- US4: needs T006 (one-shot for media node)

### Parallel Opportunities
- T003/T005/T011/T012/T013/T017/T018/T020/T021/T022 are all `[P]` — test-writing tasks touch distinct files and can run concurrently once Phase 2 semantics (T004) exist where noted
- T014 + T023 (two pure service modules) parallel
- US3 (T017–T019) and US4 (T020–T025) parallel after Phase 2

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
npx vitest run src/services/workbench/arrowGeometry.test.ts \
                src/components/workbench/workbench.test.tsx \
                src/components/nodes/ArrowNode.test.tsx
# Then implement T014 → T015 → T016 in order (T012 depends on T006 from Phase 2)
```

## Implementation Strategy

### MVP First (User Stories 1 + 2)
Complete Phases 1–4: toolbar with all eight tools, working shortcuts, and the three one-shot creation tools. This is independently demonstrable and testable — a user can open the workbench, pick Arrow/Text/Note, and create items with zero additional steps (SC-003).

### Incremental Delivery
1. **MVP** (US1+US2): toolbar + shortcuts + one-shot tools → commit per story phase
2. **+US3**: sticky draw/eraser verification & mode-prop tests
3. **+US4**: media upload with object-URL lifecycle
4. **Polish**: Radix menus, file-limit refactors, coverage ratchet, acceptance matrix

Each increment ends with `pnpm lint && pnpm typecheck && pnpm test` green before proceeding.
