# Data Model: Vizcom Workbench UI Parity

**Feature**: `006-vizcom-workbench-parity` | **Date**: 2026-09-26

Entities and state shapes for the feature. Node graph data persists through the existing
scene-persistence path (unchanged); new client-only state is listed with its store home.

## Entity: WorkbenchNode (extended)

Existing node data shape is unchanged; the `NodeType` union gains three members:

```text
NodeType = 'image' | 'modify' | 'animate' | 'render' | 'video' | 'freehand'
         | 'arrow' | 'text' | 'note' | 'media'
         | 'variate' | 'new-view' | 'extract'   // NEW (US5)
```

| Field | Applies to | Type | Validation / rules |
|-------|-----------|------|--------------------|
| `prompt` | render, modify, variate, new-view, extract | string | Free text; may contain `@reference` tokens (resolved against attached references at generate time) |
| `aspectRatio` | generation nodes | `'1:1' \| '4:5' \| '5:4' \| '2:3' \| '3:2' \| '9:16' \| '16:9'` | Default per node type; selectable in floating toolbar chip and prompt panel |
| `mode` | generation nodes | `'auto' \| 'pro'` | Prompt-panel setting row |
| `resolution` | generation nodes | `'1k' \| '2k'` | Prompt-panel setting row |
| `references` | generation nodes | `ReferenceImage[]` | Numbered chips; removable; removal degrades `@` mentions gracefully (edge case) |
| `count` | variate | `2 \| 4 \| 8` | Variate output grid size |
| `varyMode` | variate | `'form' \| 'color' \| 'both'` | Optional segmented control |
| `view` | new-view | `ViewName \| null` | `null` = placeholder; Generate disabled until set (FR-007) |
| `extractPrompt` | extract | string? | "what to extract" |
| `backgroundHandling` | extract | `'transparent' \| 'keep'` | Background select |
| `outputs` | all generation nodes | image refs | New-image-per-job; dropper drops always append a new node (R4) |

**Collapsed summary** (FR-006): unselected generation-capable cards derive display text from
`prompt` (truncated) + `aspectRatio`/`mode`/`resolution`; no new fields stored.

## Entity: ReferenceImage

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Unique within a node's reference list |
| `assetId` | string | Project image/asset identifier |
| `thumbnailUrl` | string | For numbered chip (8×8 rounded, number badge) |
| `order` | number | Chip numbering is 1-based by order |

Added via `@` mention picker or any node's "More" menu ("Add to reference images").
Removal re-validates Generate required inputs.

## Entity: AbsorbedAttribute (FR-016) — client-only state

```text
AbsorbedAttributeType = 'style' | 'color' | 'environment'

AbsorbedAttribute {
  id: string
  type: AbsorbedAttributeType        // exactly one per capture (dropdown selection)
  sourceNodeId: string               // selected image node it was captured from
  palette?: string[]                 // ordered hex list — present only when type === 'color'
  capturedAt: number                 // epoch ms
}
```

**Lifecycle / state transitions:**

```text
idle → capturing(type)        user activates Smart Dropper, picks dropdown type
capturing → captured(attr)    click inside a SELECTED image node succeeds
capturing → error             source image failed to load → inline error, no chip (edge case)
capturing → sampled(colorHex) click on empty canvas / unselected / non-image node
                              → pixel color only, sets drawing tool color, no attribute
captured → applied(attrId,targetNodeId)   drop onto an image node → new generation job;
                              same-type attr on target REPLACES previous (edge case)
captured → discarded          chip removed (removable chip UI)
```

Drop validation: target must be an `image` node; non-image/empty-canvas drops show invalid-
target feedback and apply nothing. Source and target images are never mutated in place.

Store home: `absorbedAttributeSlice` (zustand). Prompt-panel conditioning (the FR-016 MAY
clause) is **deferred to a follow-up** by user decision (R12); v1 = capture + drop-to-image
only. The slice shape anticipates the secondary surface, so it can be added later without
rework.

## Entity: CanvasThemePreference (FR-015) — client-only state

```text
CanvasTheme = 'light' | 'dark'        // default 'light'
```

| Field | Type | Rules |
|-------|------|-------|
| `canvasTheme` | `CanvasTheme` | Persisted to localStorage (namespaced key); hydrated at store creation; applied immediately on change, no reload |

Store home: `workbenchThemeSlice`. Affects **only** the canvas layer (background + dot grid:
light = current white + two-layer dots; dark = `#161616` bg + `viz-canvas-dot` `#2a2a2c`).
Not part of scene data; per-user.

## Entity: ExportOptions (FR-010) — transient modal state

```text
ExportFormat  = 'jpeg' | 'png'
ExportScaling = 'original' | '2k' | '4k'    // 2k = 2048px, 4k = 3840px longest edge (R6)

ExportOptions {
  assetIds: string[]          // selected assets; empty → Export disabled with reason
  format: ExportFormat        // default 'png'
  quality: number             // 0–100, applies to jpeg
  scaling: ExportScaling      // default 'original'
}
```

Produced by `exportService` into downloadable blobs — per-asset for multi-selection. 2K/4K
routing: backend `upscale` operation when supported, else client-side resize (R6). No
persistence.

## Entity: View (New View node)

```text
ViewName = 'Rear' | 'Front' | 'Left' | 'Right' | 'Top'
        | 'Rear Right 3/4' | 'Rear Left 3/4'   // named views per ui-translation §4.2
```

Selectable via the node's view selector; reference count chip shows attached `references`
length; Generate disabled until `view !== null` and ≥1 reference connected (FR-007).

## Entity: Section

Grouping container wrapping one or more nodes ("Wrap in section" from More menu). Reuses the
existing section mechanism; no new fields beyond membership. z-order actions (Bring to front
`]` / Send to back `[`) operate on node order within the graph.

## Relationships

```text
WorkbenchNode 1—n ReferenceImage          (generation nodes)
WorkbenchNode n—1 Section                 (optional grouping)
AbsorbedAttribute 1—1 source WorkbenchNode(image)
AbsorbedAttribute --drop--> target WorkbenchNode(image) ⇒ new generation job ⇒ new image node
CanvasThemePreference: standalone per-user preference (no scene relationship)
ExportOptions: transient; references selected WorkbenchNode ids at modal open
```

## Generation jobs (unchanged lifecycle, new backend-agnostic operations)

All generation — including Variate/New View/Extract and dropper attribute application — flows
through the generic `renderService` facade with the existing job lifecycle (queued → running
→ succeeded/failed). The active protocol (ComfyUI or OpenAI custom image API) is selected
from persisted compute settings; new operations are `variate`, `new-view`, `extract`,
`attribute-apply(style|color|environment)`. Operations unsupported by the active backend
disable that node's Generate with a clear reason. Failure while a prompt panel is attached →
inline error in panel, inputs preserved (existing edge-case behavior).
