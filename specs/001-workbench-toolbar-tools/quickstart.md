# Quickstart: Validating Workbench Toolbar Tools

**Feature**: 001-workbench-toolbar-tools | **Date**: 2026-09-21

Run guide proving the feature works end-to-end. Prerequisites: `pnpm install` done, dev server available.

## Automated validation (run first)

```bash
# Full unit/component suite incl. new tool tests
pnpm test

# Lint + types + coverage floor (mirrors CI gate)
pnpm lint && pnpm typecheck && pnpm test:ci
```

Expected: all suites green; coverage ≥ floors (statements 41 / branches 37 / functions 30 / lines 42).

## Manual acceptance matrix (dev server: `pnpm dev`)

Open the workbench. For each row, mark pass/fail:

| # | Action | Expected | Contract |
|---|--------|----------|----------|
| 1 | View toolbar | 8 buttons in order Select→Media; tooltips show shortcut keys | C-1 |
| 2 | Click each tool | Active button highlighted (`aria-pressed`), canvas mode changes | C-2.1, C-3 |
| 3 | Press V/H/D/E/A/T/N/M | Same activation as clicking | C-2.2 |
| 4 | Focus a text input, press A/T/N/M | Nothing happens (no tool switch) | C-2.3 |
| 5 | Draw a stroke, keep drawing | Draw stays active (sticky) | C-3.3 |
| 6 | Arrow tool: drag on canvas | Arrow appears; tool auto-switches to Select; arrow selected | C-4.1 |
| 7 | Text tool: click canvas | Text item with default content placed & selected; back to Select | C-4.2 |
| 8 | Note tool: click canvas | Sticky note placed & selected; back to Select | C-4.3 |
| 9 | Media → Upload: pick an image | Image node near viewport center, selected, back to Select | C-4.4 |
| 10 | Media → Upload: pick a .txt (if accessible) or non-image | Rejected — no node created | C-4.4 |
| 11 | Media → Upload from phone | Modal/toast feedback shown (placeholder acceptable) | C-4.5 |
| 12 | Select mode: drag arrow endpoint + midpoint control | Path follows; release outside canvas is harmless | C-5.1 |
| 13 | Resize an arrow node | Shape scales without distortion | C-5.2 |
| 14 | Double-click text/note; type multiline (Enter); press Escape | Edit mode works; content retained | C-5.3 |
| 15 | Delete a media node, repeat add/remove ×3 | No console errors; no unbounded memory growth in DevTools (object URLs revoked) | FR-013/edge |
| 16 | Select all + delete mix of old and new items | All removed cleanly | SC-004 |
| 17 | Try to connect an arrow/text/note/media node to another | No connection created (v1 policy) | C-6.2 |

## Done criteria
- Automated: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` all green.
- Manual: 17/17 rows pass.
- Coverage floor held or ratcheted (record new baseline in commit message).
