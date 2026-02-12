# Implementation Plan: Smoothstep Edges in CustomEdge.tsx

## Objective
Update CustomEdge.tsx to use smoothstep edge routing with:
- Border radius: 10px (fixed)
- Offset: 15px (positions edge -15px from handle, "under" the node)
- Preserve existing delete button functionality

## File to Modify
`/home/sander/dev/openviz/src/components/workbench/CustomEdge.tsx`

## Changes Required

### 1. Update Import (Line 4)
**From:**
```typescript
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    useViewport,
    type EdgeProps,
} from '@xyflow/react';
```

**To:**
```typescript
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    useViewport,
    type EdgeProps,
} from '@xyflow/react';
```

### 2. Update Path Calculation (Lines 23-30)
**From:**
```typescript
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });
```

**To:**
```typescript
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 10,
        offset: 15,
    });
```

## Verification Checklist
- [ ] Import changed from `getBezierPath` to `getSmoothStepPath`
- [ ] Path calculation includes `borderRadius: 10`
- [ ] Path calculation includes `offset: 15`
- [ ] Delete button functionality preserved
- [ ] TypeScript compilation passes

## React Flow Documentation Reference
Per React Flow docs:
- `getSmoothStepPath` returns `[path, labelX, labelY, offsetX, offsetY]` tuple
- `borderRadius`: Controls corner rounding (default: 5)
- `offset`: Distance from source/target before turning (default: 20)
- Setting offset to 15 positions the edge -15px from the handles, creating the "under node" effect

## No Changes Required in workbench.tsx
The edge configuration remains unchanged since we're keeping the custom edge type:
```typescript
type: 'customEdge',
```

---
**Ready for implementation?** Reply "implement" to proceed.
