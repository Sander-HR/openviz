# State & Service Contract: Vizcom Workbench UI Parity

**Feature**: `006-vizcom-workbench-parity` | **Date**: 2026-09-26

Client-state (zustand) and service interfaces introduced by this feature. Server state
(generation jobs) continues to use the existing react-query patterns in
`src/services/ai/*`; nothing here bypasses `src/services/`.

## S-1 workbenchThemeSlice (new — FR-015)

```ts
interface WorkbenchThemeState {
  canvasTheme: CanvasTheme;            // 'light' | 'dark', default 'light'
  setCanvasTheme: (theme: CanvasTheme) => void;   // persists to localStorage, applies immediately
}
```

- Persistence key: namespaced `openviz.workbench.canvasTheme` in localStorage.
- Hydration: read at slice creation; invalid/absent value → `'light'`.
- Consumers: canvas layer (background + dot-grid classes), top-left application menu control.
- No other surface reads this slice (node cards/chrome stay on the token set regardless).

## S-2 absorbedAttributeSlice (new — FR-016)

```ts
interface AbsorbedAttributeState {
  active: AbsorbedAttribute | null;    // exactly one captured chip at a time in v1
  pendingTargetNodeId: string | null;  // set during drag, cleared on drop/cancel
  capture: (type: AbsorbedAttributeType, sourceNodeId: string, image?: HTMLImageElement) => Promise<AbsorbedAttribute>;
  discard: () => void;
  beginDrop: (targetNodeId: string) => void;
  cancelDrop: () => void;
  completeDrop: (targetNodeId: string) => Promise<void>;  // validates target, triggers generation job
}
```

- `capture` resolves only for a selected `image` node with a loadable image; rejects with a
  typed error for failed loads (UI shows inline error, no chip).
- `completeDrop` validates target type === `'image'`; same-type existing application on the
  target is replaced; success creates a new generation job (`attribute-apply`) and a new
  image node on completion. Source/target images are never mutated.
- Drag state is transient (cleared on Escape, modal open, or tool switch).

## S-3 exportService (new — FR-010)

```ts
interface ExportResult { assetId: string; blob: Blob; filename: string }

interface WorkbenchExportService {
  exportAssets(options: ExportOptions): Promise<ExportResult[]>;   // per-asset blobs
}
```

- Exports per-asset (one file per selected asset). For 2K/4K, calls the `upscale`
  generation operation on the active backend first; if unsupported, falls back to client-side
  resize (2048px / 3840px longest edge). Encodes JPEG (quality 0–100) or PNG.
- Throws typed errors for unloadable assets (modal surfaces per-asset failure, continues
  with the rest).
- Hook wrapper: `useWorkbenchExport` owns modal state + progress; no fetch/effect logic in
  view components (Constitution III).

## S-4 smartDropperService (new — FR-016)

```ts
interface PixelSample { hex: string }
interface PaletteExtraction { palette: string[] }   // ordered dominant hex list

interface SmartDropperService {
  samplePixel(stage: StageLike, x: number, y: number): PixelSample;          // canvas or node point
  extractPalette(image: HTMLImageElement | HTMLCanvasElement): Promise<PaletteExtraction>;
}
```

- `samplePixel` is synchronous (Konva stage canvas context).
- `extractPalette` downsamples + quantizes client-side; deterministic for a given image.
- Style/Environment capture stores only `(sourceNodeId, type)` — application happens in the
  generation workflow (see S-5); no descriptor persistence in v1.

## S-5 Generation operations (backend-agnostic)

New generation operations added to the render service contract and routed by the existing
generic facade (`src/services/renderService.ts`) to the active protocol from persisted
compute settings — `comfyui` or `openai-image` (OpenAI custom image API). Each backend
implements the operations it supports; availability is capability-checked via the existing
target-capabilities mechanism. No component calls a backend directly.

| Operation | Inputs | Output |
|-----------|--------|--------|
| `variate` | source image(s), prompt?, count (2/4/8), varyMode? | N variation images |
| `new-view` | reference images, view name | 1 image (view caption) |
| `extract` | source image, prompt?, backgroundHandling, count | extracted subject image(s) |
| `attribute-apply` | source image, target image, mode (`style`\|`color`\|`environment`) | 1 new image; originals untouched |
| `upscale` | image, target scaling (`2k`\|`4k`) — used by export (S-3) | 1 upscaled image |

**Capability gating**: if the active backend does not support an operation, that node's
Generate is disabled with a clear reason naming the unsupported operation; the node remains
editable. Switching backends re-validates all generation nodes' Generate state.

Failure semantics unchanged: job failure surfaces as inline error in the attached prompt
panel (or node card for non-panel nodes); inputs preserved.

## S-6 Keyboard shortcut registry (extended — C-7)

Added to `useWorkbenchKeyboardShortcuts` (single source of truth):

| Key | Action | Guard |
|-----|--------|-------|
| `Y` | Activate Smart Dropper tool | no menu/modal/editor focus |
| `[` / `]` | Send selection to back / bring to front | selection non-empty |
| `I` | Upload image flow | no menu open |
| `/` | Upload from phone flow | no menu open |
| `⌘L` | Copy link (no-op feedback until sharing exists) | — |

Existing Escape-priority order (menu → modal → editor → canvas) is preserved.

## S-7 Node data compatibility

- `NodeType` union extended with `'variate' | 'new-view' | 'extract'`; per-type data
  interfaces in `src/types/` (see data-model.md). No migration: existing scenes load
  unchanged; new types are additive.
- Render/Modify node data schema unchanged; inline-form removal is a view-surface change only.
