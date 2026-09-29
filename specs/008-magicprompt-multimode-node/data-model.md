# Data Model: Shared Multi-Mode Generation Node

**Feature**: `008-magicprompt-multimode-node` | **Date**: 2026-09-28

## Generation Node

The persisted workbench node is the single generation node for new scenes.

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique in the workbench graph |
| `type` | `'generation'` | New scenes use one shared node type |
| `x`, `y` | `number` | Existing graph position |
| `data.prompt` | `string` | Base-state prompt; placeholder is `Describe your changes` |
| `data.mode` | `'base' \| 'variation' \| 'new-view' \| 'extract'` | Current rendered mode |
| `data.variation` | `VariationConfig` | Preserved across mode transitions |
| `data.newView` | `NewViewConfig` | Preserved across mode transitions |
| `data.extract` | `ExtractConfig` | Preserved across mode transitions |
| `data.outputs` | image references | Existing output behavior; new jobs append outputs |

## Mode Configuration

```text
VariationConfig {
  submode: 'form' | 'color'
  axisLabels: { top: string; bottom: string; left: string; right: string }
  center: { x: number; y: number }   // normalized grid coordinates
  preset: string | null
  swatches: string[]                 // ordered hex colors
  paletteName: string
  count: 2 | 4 | 8
}

NewViewConfig {
  view: ViewName | null
}

ExtractConfig {
  type: 'color' | 'material' | 'parts'
  sampleBy: 'hierarchy' | 'flat'
  attachedImageId: string | null
}
```

`ViewName` is the existing named-view union: `Rear`, `Front`, `Left`, `Right`, `Top`,
`Rear Right 3/4`, and `Rear Left 3/4`.

## Connections

- A generation node has exactly one target input handle.
- The only permitted source type is `image` using `image-source`.
- At most one connection may target a generation node.
- Connecting another image replaces the existing inbound connection; all mode configuration remains unchanged.
- A mode action is disabled when its source-image connection is absent or its mode-specific configuration is incomplete.

## Legacy Compatibility

Legacy node types map as follows when loaded:

| Legacy type | Shared type | Initial mode | Configuration mapping |
|---|---|---|---|
| `variate` | `generation` | `variation` | count, vary mode, labels/position where available |
| `new-view` | `generation` | `new-view` | selected view |
| `extract` | `generation` | `extract` | extract type, sample-by, attached image, background settings where applicable |

Legacy graph connections are normalized to the shared node's single target handle and
subject to the one-inbound replacement policy.

## State Transitions

```text
base --select variation--> variation
base --select new view--> new-view
base --select extract--> extract
specialized --header back--> base
specialized --edit controls--> same specialized mode with updated configuration
connected image --connect another image--> same node/configuration with replaced source
```
