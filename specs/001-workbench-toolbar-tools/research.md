# Research: Workbench Toolbar Tools

**Feature**: 001-workbench-toolbar-tools | **Date**: 2026-09-21

## R1: Where do tool semantics (sticky vs one-shot, key map) live?

- **Decision**: Pure module `src/store/workbenchTools.ts` exporting the shortcut→tool map, `STICKY_TOOLS` set, and `isOneShotTool(tool)` / `nextToolAfterCreation(tool)` helpers. The zustand slice and the keyboard-shortcut hook both consume it.
- **Rationale**: Single source of truth (spec FR-006/FR-007 depend on one classification); pure functions are trivially unit-testable red→green per Constitution II; eliminates the duplicated ad-hoc knowledge currently spread across `workbenchSlice.ts` and `useWorkbenchKeyboardShortcuts.ts`.
- **Alternatives considered**: Keep semantics inline in the slice (rejected: untestable without store, duplicates classification); a separate service under `src/services/` (rejected: this is state-domain logic, folder mapping puts it with store).

## R2: One-shot creation flow — component callback vs store action?

- **Decision**: Add a store action `createOneShotNode(node)` in the workbench slice that appends the node, selects it, and sets `activeWorkbenchTool: 'select'`. View-layer handlers (arrow drag-end, text/note click, media upload) build the node payload and call this one action.
- **Rationale**: The auto-switch + select behavior is spec-critical (FR-007, SC-003 "zero additional steps") and must be atomic — a store action guarantees it in one state update; the WIP's `makeOneShotNode` callback in `workbench.tsx` does this today but lives in the view and is untestable. Extracting to the slice makes it test-first-able (Constitution II).
- **Alternatives considered**: Keep per-tool callbacks in the component (rejected: 4 call sites duplicating select+switch logic); a custom hook (rejected: needs store write access, slice action is the natural home).

## R3: Arrow geometry — where does curve math live?

- **Decision**: Pure module `src/services/workbench/arrowGeometry.ts`: quadratic Bézier path computation from `{start, end, control}`, endpoint/control hit-test helpers, and `normalizeArrowForResize(arrow, oldSize, newSize)` that re-scales start/end/control when the node box is resized (spec edge case: "resizing must preserve shape without distortion").
- **Rationale**: The source plan explicitly flags resize-normalization as a known distortion bug risk; pure math is the only layer where this can be unit-tested exhaustively (Constitution II). `ArrowNode.tsx` keeps rendering + pointer handlers, delegating math.
- **Alternatives considered**: Inline math in ArrowNode (rejected: untestable, already 143 lines and growing); using React Flow edge utilities (rejected: arrow is a node with local geometry, not an edge).

## R4: Media object-URL lifecycle

- **Decision**: Track created object URLs; revoke on media-node deletion via the existing `removeWorkbenchNode` path (extend it to call `URL.revokeObjectURL(node.data.src)` when `src` starts with `blob:`).
- **Rationale**: Spec edge case requires no leak across add/remove cycles; WIP creates object URLs but never revokes them. Session-scoped storage assumption (spec) means revoke-on-delete is the complete lifecycle — no persistence layer needed.
- **Alternatives considered**: Revoke on unmount only (rejected: leaks while canvas lives); uploading to S3 in v1 (rejected: out of scope per spec assumptions; phone-upload flow already produces hosted URLs).

## R5: Submenu accessibility — custom dropdown vs Radix

- **Decision**: Migrate Media and Create-new submenus in `WorkbenchToolbar.tsx` to Radix `DropdownMenu` (`@radix-ui/react-dropdown-menu`, already a dependency).
- **Rationale**: Constitution IV mandates Radix for accessible primitives; the WIP custom menu has no keyboard navigation, focus trap, or escape handling. Radix handles portalling, collision detection, and keyboard nav out of the box (AGENTS.md tech table).
- **Alternatives considered**: Keep custom menu + add keyboard handlers manually (rejected: reimplementing what Radix provides); keep as-is (rejected: constitution violation).

## R6: How to split the 909-line workbench slice without breaking behavior?

- **Decision**: Behavior-preserving extraction in two passes, guarded by the new tests from R1–R4:
  1. Extract tool + one-shot-creation actions into `src/store/workbenchToolSlice.ts` (composed into the store).
  2. Extract media-upload node-building helpers (pure) into `src/services/workbench/mediaUploadLogic.ts`; slice keeps only state writes.
  Then trim `workbench.tsx` by moving handler callbacks (`handleMediaUpload*`, creation handlers, pointer tracking wiring) into `useWorkbenchMediaUpload.ts` and existing `useWorkbenchNodeHandlers.ts`.
- **Rationale**: Constitution V (300-line limit); the source plan already flagged both files as over-limit. Extracting after tests exist means any behavior drift fails immediately. Zustand slice composition keeps a single store (Constitution III — no new state systems).
- **Alternatives considered**: Rewrite the slice from scratch (rejected: high regression risk, no behavior change needed); leave oversized with a waiver (rejected: constitution has no waiver mechanism; violation must be fixed in-feature per plan gate).
