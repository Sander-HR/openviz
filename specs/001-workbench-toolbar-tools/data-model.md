# Data Model: Workbench Toolbar Tools

**Feature**: 001-workbench-toolbar-tools | **Date**: 2026-09-21

## Entities

### Active Tool State
| Field | Type | Notes |
|---|---|---|
| `activeWorkbenchTool` | `WorkbenchToolType` = `'select' \| 'hand' \| 'draw' \| 'eraser' \| 'arrow' \| 'text' \| 'note' \| 'media'` | Single source of truth (FR-002); lives in zustand workbench slice; default `'select'` |

**State transitions**:
- Any tool → any tool: via toolbar click or shortcut key (V/H/D/E/A/T/N/M) — direct set, no validation needed.
- One-shot tools (`arrow`, `text`, `note`, `media`) → `select`: automatic after an item is created (FR-007).
- Sticky tools (`draw`, `eraser`): remain active across actions until explicitly switched (FR-006).
- Mode-derived booleans (not stored, computed): `isSelectModeActive`, `isHandModeActive`, `isDrawToolActive` drive canvas interaction props.

### Arrow Item
| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | node identity |
| `type` | `'arrow'` | discriminant in `WorkbenchNode` union |
| `x`, `y`, `width`, `height` | number | node box; geometry stored **relative to node-local coordinates** |
| `data.start` | `{ x, y }` | start endpoint (local coords) |
| `data.end` | `{ x, y }` | end endpoint (local coords) |
| `data.control` | `{ x, y }` | midpoint control for quadratic Bézier curve |
| `data.strokeColor`, `data.strokeWidth` | string / number | styling |

**Validation rules**: endpoints and control must stay within a sensible range of the node box; on resize, all three points re-scale by `(newSize/oldSize)` (no distortion — spec edge case). Non-connectable in v1 (FR-015).

### Text Item
| Field | Type | Notes |
|---|---|---|
| `type` | `'text'` | discriminant |
| `data.text` | string | multiline allowed (Enter) |
| `data.fontSize` | number | |
| `data.color` | string | |

**Behavior**: transparent background by default (FR-009); double-click → edit mode; single-click → select. Non-connectable in v1.

### Note Item
| Field | Type | Notes |
|---|---|---|
| `type` | `'note'` | discriminant |
| `data.text` | string | |
| `data.colorVariant` | string (fixed palette, default applied on creation) | sticky-note styling with subtle shadow |

**Behavior**: same select/edit interaction as Text (FR-010). Non-connectable in v1. Palette choice out of scope for v1 (clarified).

### Media Item
| Field | Type | Notes |
|---|---|---|
| `type` | `'media'` | discriminant |
| `data.src` | string | `blob:` object URL (upload) or hosted URL (phone flow) |
| `data.alt` | string | file name fallback 'Uploaded media' |
| `data.mimeType` | string | image/* only in v1 (FR-012) |

**Lifecycle**: created at viewport-center placement (clarified); on node deletion, `blob:` sources are revoked (R4). Fallback state rendered when image fails to load (FR-013). Non-connectable in v1.

## Relationships
- All items are `WorkbenchNode` union members positioned on the workbench graph; selection/multi-select/box-select apply uniformly via the canvas layer (Select mode, FR-004).
- Arrow/Text/Note/Media have **no connector relationships** in v1 (FR-015) — connection policy must exclude them.
