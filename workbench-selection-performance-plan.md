# Plan: Workbench Selection Correctness + Drag Performance

**Generated**: 2026-07-18
**Estimated Complexity**: Medium
**Spec Kit slug**: `009-workbench-selection-perf` (branch via `/speckit.git.feature`)
**Constitution compliance**: I (type safety), II (TDD layering — logic tests written first, behavior tests from acceptance criteria for components), III (zustand + `use[Feature].ts` hooks), V (file limits; all files touched stay <300 lines)

## Overview

Two user-visible defects share one root cause in the workbench node graph:

1. **Marquee multi-select collapses to a single node** (reproduced manually by the user and via agent-browser automation).
2. **Severe lag while dragging / marquee-selecting**: measured on a 30-node scene — ~29 FPS during single-node drag with **90–416 ms main-thread long tasks per mousemove**; marquee produced **700+ ms** blocks. Idle baseline: 47 FPS, zero long tasks.

### Root cause (verified against installed `@xyflow/react` v12 source)

The app runs a **dual-source selection model**:

- React Flow owns internal selection state (its store). Marquee/shift-clicks mutate it and emit `select` node-changes.
- `useWorkbenchNodeHandlers.handleNodesChange` mirrors each `select` change into zustand (`selectedNodeIds`).
- `useWorkbenchGraph` feeds that back as a **new nodes array every render** with `selected: selectedNodeIds.includes(id)`.

In v12, `StoreUpdater` calls `setNodes(props.nodes)` whenever the `nodes` prop identity changes — which it does on *every* mousemove (position change → zustand write → re-render). During a marquee gesture, RF's internal selection can be ahead of the zustand mirror (the mirror update round-trips through React); when the freshly-built nodes array lands in RF's store, any node whose `selected` prop is `false` while RF internally marked it selected gets **de-selected**. Net effect: selection collapses — typically to the last-clicked/last-processed node.

**Perf cause**: `handleNodesChange` runs on every change batch (every mousemove during drag *and* marquee) and does:

```ts
const flowNodes = buildFlowNodes(workbenchNodes, selectedNodeIds); // O(n) alloc of all nodes
applyNodeChanges(changes, flowNodes);                              // O(n) — result discarded
```

The result is never used (the handler iterates `changes` manually). That's a full O(n) allocation + change-application per mousemove for nothing, plus the full-graph re-render cascade described above. Secondary: node components are not memoized, so every nodes-array rebuild re-renders all 29 node subtrees (each with textareas/sliders/preview images).

### Strategy

**Let React Flow own selection; make zustand a reactive mirror, not a controller.**

- Sync store ← RF via the official `onSelectionChange` handler (fires synchronously when RF mutates its internal selection), instead of mirroring per-node `select` changes.
- Programmatic selection (paste/duplicate/delete/one-shot) goes through a single helper that updates zustand **and** RF's nodes array (`setNodes` with `selected` flags) so the two never diverge.
- Remove the dead `buildFlowNodes`/`applyNodeChanges` work from the hot path.
- Memoize node components to make per-mousemove re-renders O(changed) instead of O(all).

## Prerequisites

- Dev server on port 3001 (`PORT=3001 pnpm run dev`), logged in via dev login.
- Test scene: project `9ad32117-…` ("Test", 30 nodes, 5 edges) — already exists.
- `agent-browser` (v0.34 installed) for repeatable perf measurement.
- Current branch is `008-single-shared-magicprompt` with uncommitted changes → **stash or commit before creating the feature branch**.

## Sprint 1: Baseline, spec, and measurement harness

**Goal**: Spec-kit scaffolding + a repeatable, scripted performance benchmark so every later sprint can prove (not assert) improvement.
**Demo/Validation**: `pnpm exec tsx scripts/perf/workbench-bench.ts` (or shell wrapper) prints a JSON report: avg/p95/worst frame ms, dropped frames, long-task list — for three scenarios on the 30-node scene.

### Task 1.1: Create feature branch + spec scaffolding
- **Location**: repo root; `specs/009-workbench-selection-perf/`
- **Description**: Run `/speckit.git.feature workbench-selection-perf` (creates `009-workbench-selection-perf`), then `/speckit.specify` with the acceptance criteria below. Write `spec.md` including:
  - AC-1: Marquee over ≥3 nodes selects all of them (Partial mode); shift-click adds; click on empty pane clears.
  - AC-2: Dragging a node at 60 Hz-equivalent input keeps p95 frame < 20 ms and produces no long task > 50 ms on the 30-node scene.
  - AC-3: Multi-node drag (select 5, drag one) moves all 5 with the same budget.
  - AC-4: Collab soft-locks still inert: a remotely locked node cannot be selected/dragged; yield rule still releases contested local selection.
  - AC-5: Paste/duplicate/delete/one-shot creation set selection correctly (floating toolbar anchors to active node).
- **Dependencies**: none
- **Acceptance Criteria**: branch exists; spec committed via speckit auto-commit; `/speckit.analyze` passes on the spec.
- **Validation**: `git branch --show-current` = `009-workbench-selection-perf`; `specs/009-workbench-selection-perf/spec.md` present.

### Task 1.2: Performance benchmark harness
- **Location**: `scripts/perf/workbench-bench.sh` (agent-browser driven) + `scripts/perf/inject-harness.js` (the rAF/longtask sampler as a static file, injected via `eval "$(cat …)"`)
- **Description**: Codify what was done ad hoc: login → open workbench URL → install FPS/longtask harness (single shared `PerformanceObserver`, no duplicate observers) → run scenarios:
  - S1 single-node drag: 30 mouse steps @ ~33 ms, node center start.
  - S2 marquee select: 25 steps over a rect enclosing ≥4 nodes; **assert selected count ≥ 4** (this doubles as the regression test for AC-1).
  - S3 multi-node drag: after S2's selection, drag one selected node 30 steps.
  - Report JSON per scenario: `avgFps, p95FrameMs, worstFrameMs, droppedFrames, longTasks[]`, plus `selectedCount` after S2.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**: harness runs unattended; output is stable enough to diff (run twice, values within ~20%).
- **Validation**: run on current code → expect S2 `selectedCount` ≤ 1 (bug reproduced) and long tasks > 100 ms (lag reproduced). **Save this output as the baseline artifact in the spec folder** (`specs/009-workbench-selection-perf/baseline.json`).

### Task 1.3: Fix-test-first logic tests for selection sync
- **Location**: `src/components/workbench/hooks/useWorkbenchSelectionSync.test.ts` (new)
- **Description**: Strict red-green per constitution II. Write failing tests for a new pure/logic unit `useWorkbenchSelectionSync` (see Task 2.1): given RF `onSelectionChange({nodes})` payloads, it produces the correct `selectedNodeIds`/`activeNodeId` writes, dedupes no-ops (same id set → no store write), and filters remotely locked ids only when a remote lock exists.
- **Dependencies**: none (can run parallel with 1.2)
- **Acceptance Criteria**: tests exist and FAIL against current code (no such module yet).
- **Validation**: `pnpm exec vitest src/components/workbench/hooks/useWorkbenchSelectionSync.test.ts` → red.

## Sprint 2: Selection model refactor (fixes the marquee bug)

**Goal**: React Flow owns selection; zustand is a one-way reactive mirror; programmatic changes go through one helper. Marquee multi-select works.
**Demo/Validation**: manual — marquee over 4+ nodes selects all; shift-click adds; bench S2 `selectedCount` ≥ 4.

### Task 2.1: New selection-sync hook (logic layer, TDD)
- **Location**: `src/components/workbench/hooks/useWorkbenchSelectionSync.ts` (+ test from Task 1.3)
- **Description**: Encapsulates the store⇄RF contract:
  - `onSelectionChange` callback (memoized): reads `{ nodes }`, maps to ids, compares with current store set; writes `setSelectedNodeIds` only on change; sets `activeNodeId` to last node when the set grew.
  - `applyProgrammaticSelection(ids)`: writes zustand **and** schedules `setNodes(nds => nds.map(n => ({...n, selected: ids.includes(n.id)})))` via `useReactFlow()` so RF's internal state matches immediately (used by paste/duplicate/delete/one-shot/freehand).
  - Soft-lock yield stays in `useCollabPresencePublisher` but is simplified to a single subscribe that only reacts when `nodeLocks` actually contains a contested id (no full-store-change churn).
- **Dependencies**: Task 1.3
- **Acceptance Criteria**: tests green; no `any`; hook < 150 lines.
- **Validation**: `pnpm exec vitest …/useWorkbenchSelectionSync.test.ts` → green; `tsc --noEmit` clean.

### Task 2.2: Rewire workbench to the new sync
- **Location**: `src/components/workbench/workbench.tsx`, `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts`
- **Description**:
  - Add `onSelectionChange={sync.onSelectionChange}` to `<ReactFlow>`.
  - In `handleNodesChange`: **delete** the `select` branch and the dead `buildFlowNodes` + `applyNodeChanges` calls (keep `position`, `dimensions`, `remove` handling). Selection now only arrives via `onSelectionChange`.
  - Replace direct `setSelectedNodeIds([...])` call sites in node handlers/one-shot/eraser with `sync.applyProgrammaticSelection(...)` where the change originates outside RF (paste, duplicate, delete, one-shot creation, freehand finish, eraser).
  - Keep `selectionKeyCode`/`multiSelectionKeyCode="Shift"`, `selectionMode={SelectionMode.Partial}`, `selectionOnDrag` as-is.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**: marquee selects all nodes in rect (manual + bench S2); shift-click accumulates; pane click clears; floating toolbar still anchors to last-clicked node; right-click "more" menu still acts on whole selection.
- **Validation**: bench S2 `selectedCount` ≥ 4; existing workbench hook/component tests green; manual check of AC-1/AC-5.

### Task 2.3: Stop feeding `selected` back from the store during renders
- **Location**: `src/components/workbench/hooks/useWorkbenchGraph.ts`
- **Description**: Remove `selected: selectedNodeIds.includes(node.id)` from the node builder (RF owns it). Keep `selectable`/`draggable: !nodeLocks[node.id]`. Drop `selectedNodeIds` from the hook's inputs and memo deps. Verify nothing else reads node.selected from this array (search consumers).
- **Dependencies**: Task 2.2
- **Acceptance Criteria**: no selection-related writes remain in the render path; store→RF writes only happen via `applyProgrammaticSelection`.
- **Validation**: `grep -rn "selectedNodeIds" src/components/workbench/hooks/useWorkbenchGraph.ts` → none; full vitest suite green.

### Task 2.4: Update/replace affected tests
- **Location**: existing tests touching `handleNodesChange` select behavior, `useWorkbenchGraph`, presence publisher
- **Description**: Migrate assertions from "select changes mirrored per-node" to "onSelectionChange syncs store"; add component-level behavior test (RTL): render workbench with 3 nodes, simulate marquee pointer events, assert all 3 get `.selected` class (behavior test from AC-1, written before final wiring tweaks if not covered by 1.3).
- **Dependencies**: Task 2.2, 2.3
- **Acceptance Criteria**: `pnpm run test:ci` green; coverage floor not regressed.
- **Validation**: CI gate (lint + tsc + vitest + coverage).

## Sprint 3: Drag performance (hit the 60 fps budget)

**Goal**: Eliminate remaining per-mousemove cost so S1/S3 meet AC-2/AC-3.
**Demo/Validation**: bench S1/S3 report p95 < 20 ms, no long task > 50 ms; drag feels smooth in headed browser.

### Task 3.1: Memoize node components
- **Location**: `src/components/nodes/*.tsx` (ImageNode, VideoNode, RenderNode, ModifyNode, NoteNode, TextNode, MediaNode, VariateNode, NewViewNode, ExtractNode, SectionNode, FreehandNode, ArrowNode)
- **Description**: Wrap each node component in `React.memo`. Audit props: `data` object is rebuilt every render by `useWorkbenchGraph` → stabilize with per-node memo keyed on the node's own data (or move handler functions out of `data` into stable refs/context so `data` identity only changes when that node's data changes). Handlers passed via `data` (`onResize`, `onDataChange`, …) must be referentially stable (`useCallback` with empty deps reading store at call time — matches the existing `isRemotelyLocked` pattern).
- **Dependencies**: Task 2.3 (so selection no longer churns every node's props)
- **Acceptance Criteria**: during a single-node drag, React DevTools profiler shows only the dragged node (+ attached arrows) re-rendering per mousemove.
- **Validation**: manual profile check; bench S1 long tasks < 50 ms.

### Task 3.2: Verify transient position path stays O(1)-ish
- **Location**: `src/store/slices/workbenchSlice.ts` (`updateWorkbenchNodeTransient`), `useWorkbenchNodeHandlers.handleNodesChange`
- **Description**: Confirm each mousemove does exactly one zustand set with a single node update (no array copies of unrelated nodes beyond immer's structural sharing); confirm attached-arrow updates only touch arrows bound to the moved node. Remove any residual per-batch full-array work.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**: profiler: store writes during drag = 1 per input event; no O(n) allocations in the hot path (heap snapshot diff).
- **Validation**: bench S1 p95 < 20 ms on 30-node scene.

### Task 3.3: Re-run benchmark, iterate
- **Location**: `scripts/perf/workbench-bench.sh`
- **Description**: Run full bench; if any scenario misses budget, profile (React DevTools + Performance panel) and fix the specific hotspot (candidates: `FloatingArrowOverlay`/`CursorOverlay` re-renders per viewport change — memoize on `[arrows, selectedNodeIds, viewport]`; `NodeLockBadges`; edge rebuilds in `useWorkbenchGraph.edges` memo).
- **Dependencies**: Task 3.1, 3.2
- **Acceptance Criteria**: S1/S2/S3 all within AC-2/AC-3 budgets; report saved as `specs/009-workbench-selection-perf/after.json`.
- **Validation**: bench JSON diff vs baseline shows ≥5× long-task reduction and p95 < 20 ms.

## Sprint 4: Converge

**Goal**: All gates green, spec complete, manual verification done.
**Demo/Validation**: `/speckit.converge` → "Converged".

### Task 4.1: Full quality gate
- **Location**: repo root
- **Description**: `pnpm run lint`, `tsc --noEmit` (via build), `pnpm run test:ci` (coverage floor). Fix fallout.
- **Dependencies**: Sprints 2–3 complete
- **Acceptance Criteria**: all green; no `any`/`@ts-ignore` introduced.
- **Validation**: CI-equivalent local run passes.

### Task 4.2: Manual verification matrix + collab check
- **Location**: dev server, two browser sessions (collab)
- **Description**: Verify AC-1…AC-5 manually; in a second session select a node and confirm the first session's selection is released for that node only (soft-lock yield) and the locked node shows `NodeLockBadges` and cannot be dragged.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**: all ACs pass; no new console errors/warnings during bench scenarios.
- **Validation**: checklist recorded in spec folder.

### Task 4.3: Spec convergence + before/after report
- **Location**: `specs/009-workbench-selection-perf/`
- **Description**: Update `spec.md` with measured baseline vs after numbers; run `/speckit.converge`; conventional commits already auto-committed by speckit config.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**: Converged verdict; report committed.
- **Validation**: converge output shows no open items.

## Testing Strategy

| Layer | Method |
|---|---|
| Logic (sync hook, store slice) | Strict red-green vitest unit tests (test file first — Tasks 1.3 → 2.1) |
| Components (workbench, nodes) | RTL behavior tests from acceptance criteria (marquee selects all; toolbar anchors to active node); no pixel tests |
| E2E/perf | `scripts/perf/workbench-bench.sh` via agent-browser (headed mode — headless throttles rAF); baseline/after JSON artifacts in spec folder |
| Manual | dev-server matrix incl. two-session collab soft-lock check |

**Perf measurement notes** (learned during this investigation):
- Always measure in **headed** browser: headless Chromium throttles `requestAnimationFrame` to ~12 fps even when idle, which corrupts FPS metrics.
- Use a single shared `PerformanceObserver` for longtasks; re-registering per run double-counts entries.
- Long-task durations are the primary lag signal (they don't depend on rAF cadence); frame deltas give user-perceived smoothness.

## Potential Risks & Gotchas

1. **RF internal state vs store divergence after refactor** — any code path that sets selection without going through `applyProgrammaticSelection` will now silently desync (toolbar/menu act on stale ids). *Mitigation*: Task 2.2 audits every `setSelectedNodeIds` call site (26 in workbenchSlice, ~15 external writers); grep gate in review; behavior tests for paste/duplicate/one-shot.
2. **Soft-lock yield loop** — presence publisher writes selection on store change; combined with RF-driven selection changes this could oscillate. *Mitigation*: yield only fires when a contested id is actually present (Task 2.1); collab two-session manual check in Task 4.2.
3. **Node memoization hiding bugs** — stale `data` identity can freeze node UI (e.g., generation progress). *Mitigation*: per-node data memo keyed on the node's own fields; behavior tests for a node whose data changes while another node is dragged.
4. **Bench flakiness** — 30 ms sleep cadence + CI-less local machine noise. *Mitigation*: run bench twice, report medians; long-task count/duration (not raw FPS) as the gate metric.
5. **Dirty working tree** — current branch has uncommitted changes from 008 work. *Mitigation*: stash/commit before Task 1.1; do not mix concerns across branches.
6. **`buildFlowNodes` removal** — it's exported and may be used by tests/other hooks. *Mitigation*: grep all importers in Task 2.2; delete or re-purpose deliberately, don't orphan.

## Rollback Plan

- All work lives on branch `009-workbench-selection-perf`; rollback = abandon branch (nothing merged).
- Within the branch, sprints are independently revertable: Sprint 3 (memoization) can be reverted without touching the Sprint 2 selection fix; Sprint 2 tasks 2.1–2.3 revert as a unit (they change the same contract).
- If the native-selection model proves unstable in collab edge cases, fallback = keep store-as-source but **batch** selection mirroring to `onSelectionEnd` + fix the dead-code perf issue (Sprint 3 stands alone) — this still delivers the perf win while deferring the architecture change.
