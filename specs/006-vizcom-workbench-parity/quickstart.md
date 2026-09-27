# Quickstart: Validating Vizcom Workbench UI Parity

**Feature**: `006-vizcom-workbench-parity` | **Date**: 2026-09-26

Runnable validation scenarios proving the feature works end-to-end. Detailed behavior lives
in [contracts/ui-contract.md](./contracts/ui-contract.md) and
[contracts/state-contract.md](./contracts/state-contract.md); state shapes in
[data-model.md](./data-model.md). Implementation details belong in `tasks.md`.

## Prerequisites

```bash
pnpm install          # includes the 5 new @radix-ui packages (dialog, popover, select, separator, scroll-area)
pnpm run dev          # Vite dev server (or Next.js app runtime per current repo state)
```

Open a project with at least one uploaded image node: `/projects/<id>/workbench`.

## Test gates (run before manual validation)

```bash
pnpm test                                  # full Vitest suite (component behavior + logic red-green)
pnpm exec vitest src/components/workbench  # workbench component tests only
pnpm run lint && pnpm run build            # ESLint + tsc clean, coverage floor not regressed
```

## Scenario V1 — Theme parity (C-1, US1)

1. Open the workbench → canvas is **light** (white + dot grid), node cards dark.
2. Top-left application menu → switch to **Dark** → only the canvas background/dot grid
   change (`#161616` + subtle dots); chrome surfaces unchanged, no reload.
3. Reload the page → preference is still Dark. Switch back to Light → restored.
4. With a node selected (toolbar/panel open), toggle theme → panels restyle in place.

**Pass**: zero off-palette colors in either theme (visual audit per SC-001).

## Scenario V2 — Selection toolbar & More menu (C-2, C-3, US2)

1. Click an image node → floating toolbar above it: Edit, aspect chip, quick actions, ⋯.
2. Aspect chip → choose `2:3` → node updates, menu closes.
3. Open ⋯ → five groups in contract order with `<Kbd>` hints; disabled items not clickable.
4. Select image + note together → single toolbar with count badge; per-node-only actions disabled.
5. Pan/zoom with the toolbar open → stays anchored; near an edge it flips/clamps.
6. `⌘D` duplicates, `Del` deletes — same as menu choices.

## Scenario V3 — Add-node menu (C-4, US3)

1. Click `+` → 222px panel: upload rows (`I`, `/`) + two-column grid including
   **Instant Render**, Variate, New View, Extract.
2. From an empty canvas, create one of each non-legacy type in ≤2 clicks (SC-002).
3. Press `I` with no menu open → image upload starts directly.

## Scenario V4 — Prompt panel (C-5, US4)

1. Select a Render node → panel attaches below: header, chips row, editor, Aspect/Mode/
   Resolution rows, Generate.
2. Type `@` in the editor → picker appears; attach an image → numbered chip appears.
3. Clear prompt + disconnect inputs → Generate disabled with reason; restore → enabled.
4. Unselect the node → **no inline form**; collapsed summary of last prompt/settings shows.
5. Repeat for Modify, Variate, New View, Extract (New View: Generate stays disabled until a
   view is chosen and ≥1 reference connected).

## Scenario V5 — Core generation loop (SC-006)

Upload an image → select its Render/Modify node → attach prompt + reference via `@` →
Generate → result appears as a new image node on the canvas. Target: under 2 minutes for a
first-time user.

## Scenario V6 — Export modal (C-8, US6)

1. Select two image nodes → top-right **Export** → centered modal: assets listed left;
   format/quality/scaling + source preview right; Export button bottom.
2. With nothing selected, open Export → empty list, button disabled with reason.
3. Choose JPEG / 80% / 2K → Export → one download per selected asset; 2K/4K uses the active
   backend's upscale operation when supported, otherwise client-side resize.
4. Confirm no Share button exists anywhere in the top-right cluster.

## Scenario V7 — Smart Dropper (C-9, FR-016)

1. Press `Y` → capture dropdown shows exactly Style / Color / Environment.
2. Click empty canvas → drawing tool color updates to the sampled pixel (no chip).
3. Select an image node, choose **Color**, click inside it → palette chip appears (removable).
4. Drag the chip onto a second image node → generation runs → **new** image node appears
   with the palette applied; both originals unchanged (SC-007: ≤3 interactions).
5. Drop on a note node or empty canvas → invalid-target feedback, nothing applied.
6. Capture **Style** and **Environment** from the first image and drop each on the second →
   two more new images; originals still unchanged.

## Scenario V8 — Toolbar, edges, zoom (C-7, C-10)

1. Hover every top-toolbar button → tooltip with name + shortcut where assigned (SC-003).
2. Hover an edge → remove affordance appears; click → edge removed.
3. Zoom cluster restyled to tokens; percentage popover shows 25/50/75/100/fit presets.

## Manual audit checklist (SC-001 / SC-005)

- [ ] Both themes: canvas, toolbar, add-node menu, more-menu, prompt panel, export modal,
      zoom cluster all on `viz-*` tokens; node cards dark in both.
- [ ] All menus keyboard-navigable, Escape-dismissible (FR-013).
- [ ] Gap G8 (bottom-left dock) remains deferred with documented rationale.
