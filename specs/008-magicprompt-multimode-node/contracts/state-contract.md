# State Contract: Shared Multi-Mode Generation Node

**Feature**: `008-magicprompt-multimode-node` | **Date**: 2026-09-28

## Node State Contract

The shared generation node is updated through the existing workbench node-data action:

```ts
updateGenerationNode(
  nodeId: string,
  updates: Partial<GenerationNodeData>,
): void
```

The action must create an undoable node-property change and persist the updated scene
through the existing scene-sync path.

## Mode Actions

```text
enterMode(nodeId, mode)
returnToBase(nodeId)
setVariationSubmode(nodeId, submode)
setVariationConfig(nodeId, patch)
setNewView(view)
setExtractConfig(nodeId, patch)
```

All actions preserve configuration for modes that are not currently visible.

## Connection Contract

The existing connection service remains the authoritative boundary:

```ts
addConnectionWithPolicy(
  connections: Connection[],
  nodes: WorkbenchNode[],
  fromId: string,
  toId: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): Connection[]
```

For this feature it must accept `image -> generation`, canonicalize the source to
`image-source`, enforce one inbound connection, and replace the previous inbound source
when a different image is connected.

## Generation Contract

Mode action buttons call the existing typed generation callback/service boundary with
mode-specific validated inputs:

| Mode | Required inputs |
|---|---|
| Variation | image source, selected variation configuration |
| New View | image source, non-null `ViewName` |
| Extract | image source, extract type, sample-by, attached image when required |

No component directly performs a backend request.
