# Implementation Plan: Conditional Delete Button Visibility

## Objective
Show the delete button on edges only when:
1. The edge itself is selected, OR
2. The source node is selected, OR  
3. The target node is selected

## File to Modify
`/home/sander/dev/openviz/src/components/workbench/CustomEdge.tsx`

## Implementation Approach

### React Flow EdgeProps Analysis
According to React Flow documentation, custom edges receive:
- `selected`: boolean - whether the edge itself is selected
- `source`: string - ID of the source node
- `target`: string - ID of the target node

### Store Analysis
The store tracks `activeNodeId: string | null` which represents the currently selected node ID.

### Changes Required

**1. Destructure additional props (lines 11-21):**
Add `selected`, `source`, and `target` to the destructured props.

**From:**
```typescript
export const CustomEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
}: EdgeProps) => {
```

**To:**
```typescript
export const CustomEdge = ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    style = {},
    markerEnd,
}: EdgeProps) => {
```

**2. Access activeNodeId from store (after line 34):**
Add a selector to get the activeNodeId from the store.

```typescript
const removeConnection = useStore((state) => state.removeConnection);
const activeNodeId = useStore((state) => state.activeNodeId);
```

**3. Calculate visibility (after activeNodeId retrieval):**
```typescript
const isDeleteButtonVisible = selected || source === activeNodeId || target === activeNodeId;
```

**4. Conditionally render delete button (lines 41-71):**
Wrap the EdgeLabelRenderer content in a conditional.

**From:**
```typescript
    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div
                    className="nodrag nopan"
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${1 / zoom})`,
                        pointerEvents: 'all',
                    }}
                >
                    <button onClick={onEdgeClick}>...</button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
```

**To:**
```typescript
    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {isDeleteButtonVisible && (
                <EdgeLabelRenderer>
                    <div
                        className="nodrag nopan"
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${1 / zoom})`,
                            pointerEvents: 'all',
                        }}
                    >
                        <button onClick={onEdgeClick}>...</button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
```

## Complete Updated File Structure

```typescript
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    useViewport,
    type EdgeProps,
} from '@xyflow/react';
import { Minus } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const CustomEdge = ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    style = {},
    markerEnd,
}: EdgeProps) => {
    const { zoom } = useViewport();
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

    const removeConnection = useStore((state) => state.removeConnection);
    const activeNodeId = useStore((state) => state.activeNodeId);

    const onEdgeClick = () => {
        removeConnection(id);
    };

    const isDeleteButtonVisible = selected || source === activeNodeId || target === activeNodeId;

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {isDeleteButtonVisible && (
                <EdgeLabelRenderer>
                    <div
                        className="nodrag nopan"
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${1 / zoom})`,
                            pointerEvents: 'all',
                        }}
                    >
                        <button
                            onClick={onEdgeClick}
                            style={{
                                width: '26px',
                                height: '26px',
                                backgroundColor: '#6366f1',
                                border: '3px solid white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                            }}
                        >
                            <Minus size={12} color="white" strokeWidth={2} />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
```

## Behavior Summary

| Scenario | Delete Button Visible? |
|----------|----------------------|
| Edge clicked/selected | ✅ Yes |
| Source node selected | ✅ Yes |
| Target node selected | ✅ Yes |
| Nothing selected | ❌ No |
| Other node selected | ❌ No |

## Testing Checklist
- [ ] Click edge → delete button appears
- [ ] Click source node → delete button appears on connected edges
- [ ] Click target node → delete button appears on connected edges
- [ ] Click empty canvas → all delete buttons hide
- [ ] Click different node → only edges connected to that node show button
- [ ] Delete button still works when visible

---
**Ready for implementation?** Reply "implement" to proceed.
