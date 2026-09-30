# Feature Specification: Workbench Selection Correctness & Drag Performance

**Feature Branch**: `009-workbench-selection-perf`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User report: "considerable performance lag when moving or selecting multiple nodes in the workbench" + observed bug where marquee selection only ever selects a single node.

## Problem Statement

Two defects share one root cause in the workbench node graph (`src/components/workbench/`):

1. **Marquee multi-select collapses to a single node.** Dragging a selection rectangle over N nodes results in 1 selected node (reproduced manually and by the scripted benchmark: `selectedCount: 1` with ~4 nodes enclosed).
2. **Severe lag during drag/marquee.** Measured baseline on a 30-node scene (agent-browser, headed): single-node drag → p95 frame 33 ms, worst frame 665 ms, long tasks up to **673 ms**; marquee → p95 117 ms, long tasks up to **573 ms** per mousemove. Idle baseline: ~47 FPS, zero long tasks.

### Root Cause (verified against installed `@xyflow/react` v12 source)

The app runs a dual-source selection model: React Flow owns internal selection state; `useWorkbenchNodeHandlers.handleNodesChange` mirrors each `select` change into zustand (`selectedNodeIds`); `useWorkbenchGraph` feeds that back as a **new nodes array on every render** with `selected: selectedNodeIds.includes(id)`. In v12, `StoreUpdater` calls `setNodes(props.nodes)` whenever the prop identity changes — which happens on every mousemove (position change → zustand write → re-render). Mid-gesture, RF's internal selection is ahead of the zustand mirror; when the freshly built array lands in RF's store, nodes whose `selected` prop lags get de-selected. Net effect: marquee collapses to one node.

The lag comes from dead work in the hot path: `handleNodesChange` (runs on every change batch, i.e. every mousemove during drag *and* marquee) rebuilds **all** flow nodes via `buildFlowNodes(...)` and runs `applyNodeChanges(changes, flowNodes)` on a throwaway array whose result is discarded. Combined with un-memoized node components, every mousemove re-renders all 29 node subtrees.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-select actually selects everything (Priority: P1)

A designer drags a selection rectangle over several nodes and expects all of them to be selected; shift-click adds to the selection; clicking empty canvas clears it. Today the marquee silently keeps only one node, making multi-node operations (move, duplicate, delete, export) unreliable.

**Why this priority**: This is a correctness bug in a core interaction — every downstream multi-select feature (006's selection toolbar/menu rules, 003's soft locks) operates on the wrong set.

**Independent Test**: On a scene with ≥4 visible nodes, marquee over them → all get the selected style; shift-click a fifth → it joins; click empty pane → all clear. Also verified by benchmark scenario S2 asserting `selectedCount ≥ 4`.

**Acceptance Scenarios**:

1. **Given** ≥4 nodes partially or fully inside a dragged selection rectangle, **When** I release the marquee, **Then** every enclosed node is selected (Partial mode per existing `selectionMode={SelectionMode.Partial}`).
2. **Given** one node selected, **When** I shift-click another node, **Then** both are selected (multiSelectionKeyCode Shift — preserved from 001's intent; modifier convention amended, see "Amendments").
3. **Given** a multi-selection, **When** I click empty canvas, **Then** the selection is cleared and no toolbar/panel remains anchored.
4. **Given** a marquee rectangle enclosing both locked (remote) and unlocked nodes, **When** I release it, **Then** only the unlocked subset is selected; locked nodes keep their holder badge and are not dragged or editable.

### User Story 2 - Dragging feels instant (Priority: P1)

A designer moves a node (or a multi-selection) and expects it to track the pointer at display refresh rate without stutter, on scenes of typical size (30+ nodes).

**Why this priority**: The reported lag is the primary complaint; it degrades every canvas interaction.

**Independent Test**: Run `scripts/perf/workbench-bench.sh` against a 30-node scene; scenarios S1 (single drag) and S3 (multi drag) must meet the budgets below. Manual feel check in a headed browser.

**Acceptance Scenarios**:

1. **Given** a 30-node scene, **When** I drag one node with continuous pointer movement (~30 input events over ~1 s), **Then** p95 frame time < 20 ms and no long task exceeds 50 ms.
2. **Given** a selection of ≥4 nodes, **When** I drag one of them, **Then** all selected nodes move together within the same budget.
3. **Given** an idle canvas (no input), **When** nothing changes, **Then** no long tasks occur (regression guard against background churn).

### User Story 3 - Collaborative behavior is preserved (Priority: P2)

Two designers share a scene. Selection-derived soft locks (003 FR-015/FR-016), gesture atomicity for undo (002), and on-release position sync must behave exactly as specified today — while lock acquisition becomes *more* correct because marquee now selects the full set.

**Why this priority**: The selection-model refactor touches the exact state that collab soft locks read; regressions here break multi-user editing.

**Independent Test**: Two browser sessions on the same scene: session A selects a node → session B sees the lock badge and cannot select/drag it; A deselects → lock releases. Session A drags a node → B sees it jump to final position on mouse-up (one undo step), not mid-drag.

**Acceptance Scenarios**:

1. **Given** a collaborator has selected (or is dragging) a node, **When** I attempt to select or drag it, **Then** the node is inert and shows the holder's badge (FR-015).
2. **Given** my selection contains a node another client locks, **When** their lock lands, **Then** only that node is released from my local selection (lost-conflict yield), others remain selected.
3. **Given** I marquee-select 10 nodes while a peer watches, **When** awareness propagates, **Then** all 10 are locked for the peer (previously only 1 due to the collapse bug).
4. **Given** I drag a node and release, **When** the peer's doc projection applies, **Then** the node appears at its final position as one undoable gesture (002 semantics unchanged).

## Functional Requirements

- **FR-001**: The system MUST let React Flow own interactive selection state; marquee, shift-click, and pane-click selection MUST be driven by React Flow's internal store without per-node `select` change interception in the app.
- **FR-002**: The zustand `selectedNodeIds`/`activeNodeId` pair MUST remain a reactive mirror of React Flow's selection, updated via the official `onSelectionChange` handler, for non-canvas consumers (floating toolbar anchoring, keyboard shortcuts, context menu, collab awareness publishing).
- **FR-003**: Programmatic selection originating outside the canvas (paste, duplicate, delete result, one-shot creation, freehand/eraser) MUST go through a single helper that writes zustand and React Flow's node `selected` flags in the same tick so both sources never diverge.
- **FR-004**: The render path MUST NOT derive node `selected` from the store; `selectable`/`draggable` MUST still be derived from remote soft locks (FR-015 of spec 003).
- **FR-005**: Node position handling in `onNodesChange` MUST NOT allocate or transform the full node array per change batch; the dead `buildFlowNodes` + `applyNodeChanges` work MUST be removed.
- **FR-006**: Workbench node components MUST be memoized such that a single-node drag re-renders only the dragged node (plus arrows attached to it) per input event.
- **FR-007**: The system MUST provide a repeatable benchmark (`scripts/perf/workbench-bench.sh`) covering single-node drag, marquee select (asserting selected count), and multi-node drag, reporting avg/p95/worst frame ms, dropped frames, and long-task durations; baseline and after artifacts are stored in this spec folder.
- **FR-008**: Soft-lock acquisition, conflict resolution (earliest `selectedAt`, tie → lower client id), yield-on-contest, and release rules MUST remain exactly as specified by spec 003 FR-015/FR-016.

## Performance Budgets (measured gates)

| Scenario | Metric | Baseline (2026-07-18, unfixed) | Target |
|---|---|---|---|
| S1 single-node drag, 30 nodes | p95 frame | 33.4 ms | **< 20 ms** |
| S1 | max long task | 673 ms | **≤ 50 ms** |
| S2 marquee select (≥4 enclosed) | selectedCount | **1 (bug)** | **≥ 4** |
| S2 | max long task | 573 ms | **≤ 50 ms** |
| S3 multi-node drag | p95 frame | 50 ms | **< 20 ms** |
| S3 | max long task | 140 ms | **≤ 50 ms** |

Measurement method: headed Chromium via agent-browser (headless throttles rAF), single shared `PerformanceObserver` for longtasks; frame deltas from a continuous rAF sampler. Long-task duration is the primary lag gate (independent of rAF cadence).

## Amendments to Prior Specs (agreed with user 2026-07-18)

1. **Spec 001 modifier convention**: 001's FR-004 wording says multi-select = Cmd/Ctrl+Click and box select = Shift+Drag. The shipped (and now retained) behavior is: plain-drag marquee in Select mode + **Shift+click** to add (`selectionKeyCode`/`multiSelectionKeyCode="Shift"`), matching Figma/xyflow conventions. Spec 001's wording will be amended to match; no behavior change.
2. **Marquee over mixed locked/unlocked nodes**: new AC (US1 scenario 4) — marquee selects the unlocked subset only; no error state.

## Out of Scope

- Live (mid-drag) position sync to peers — intentionally on-release per spec 002 gesture atomicity.
- Changing lock granularity (selection = lock stays, per 003 FR-015).
- Edge selection behavior changes.
- Konva/studio canvas performance (separate surface).

## Success Criteria

- Benchmark S1–S3 meet all budgets above on the 30-node reference scene; `after.json` committed to this spec folder.
- Marquee multi-select verified manually and by benchmark (selectedCount ≥ enclosed count for the test rect).
- Two-session collab matrix passes (US3 scenarios).
- Quality gates green: `pnpm run lint`, `tsc --noEmit`, `pnpm run test:ci` (coverage floor not regressed).
