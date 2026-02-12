# Implementation Plan: Separate Invisible Connection Handles (Option B)

## Objective
Separate edge connection logic from visible handle appearance to prevent edge position shifting when nodes are selected/deselected.

## Concept
Use **two handles** per connection point:
1. **Invisible Handle**: Stable position, always present, used for edge path calculations
2. **Visible Handle**: Visual only, animates/fades based on selection state

## Files to Modify

### 1. `/home/sander/dev/openviz/src/components/workbench/ImageNode.tsx`
### 2. `/home/sander/dev/openviz/src/components/nodes/AnimateNode.tsx`
### 3. `/home/sander/dev/openviz/src/components/workbench/CustomEdge.tsx`

---

## Implementation Details

### 1. ImageNode.tsx Changes

**Current Issue**: Single handle uses `scale(0)` which changes geometric position

**Solution**: Split into two handles

**Lines 27-53 - Replace with:**
```typescript
        {/* Invisible handle for edge connections - ALWAYS STABLE */}
        <Handle
            type="source"
            position={Position.Right}
            id="source"
            style={{
                right: '-13px',
                top: '50%',
                width: '26px',
                height: '26px',
                opacity: 0,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
            }}
            isConnectable={isConnectable}
        />
        
        {/* Visible handle for user interaction - ANIMATES */}
        <div
            onClick={handleSourceClick}
            style={{
                position: 'absolute',
                right: '-13px',
                top: '50%',
                width: '26px',
                height: '26px',
                background: '#6366f1',
                border: '3px solid white',
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 1000,
                opacity: selected ? 1 : 0,
                transform: selected 
                    ? `translateY(-50%) scale(${1 / zoom})` 
                    : 'translateY(-50%) scale(0)',
                transition: 'opacity 500ms ease, transform 300ms ease',
                pointerEvents: selected ? 'auto' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Plus size={16} color="white" strokeWidth={3} />
        </div>
```

**Key Points:**
- Invisible Handle: `opacity: 0`, no scale transform, `pointerEvents: 'none'`
- Visible div: Handles click events, visual feedback, animates independently
- Both positioned identically: `right: '-13px'`, `top: '50%'`

---

### 2. AnimateNode.tsx Changes

**Current State**: No handles defined at all! This is why AnimateNode connections behave unpredictably.

**Solution**: Add both invisible connection handles and visible interaction handles.

**After line 67 (before closing div), add:**
```typescript
            {/* Invisible handles for edge connections - ALWAYS STABLE */}
            <Handle
                type="target"
                position={Position.Left}
                id="target"
                style={{
                    left: '-6px',
                    top: '50%',
                    width: '12px',
                    height: '12px',
                    opacity: 0,
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                }}
                isConnectable={true}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source"
                style={{
                    right: '-6px',
                    top: '50%',
                    width: '12px',
                    height: '12px',
                    opacity: 0,
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                }}
                isConnectable={true}
            />
            
            {/* Visible handles for user interaction - ANIMATES */}
            <div
                style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '50%',
                    width: '12px',
                    height: '12px',
                    background: '#6366f1',
                    borderRadius: '50%',
                    opacity: selected ? 1 : 0,
                    transform: selected 
                        ? 'translateY(-50%) scale(1)' 
                        : 'translateY(-50%) scale(0)',
                    transition: 'opacity 300ms ease, transform 200ms ease',
                    pointerEvents: 'none',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    right: '-6px',
                    top: '50%',
                    width: '12px',
                    height: '12px',
                    background: '#6366f1',
                    borderRadius: '50%',
                    opacity: selected ? 1 : 0,
                    transform: selected 
                        ? 'translateY(-50%) scale(1)' 
                        : 'translateY(-50%) scale(0)',
                    transition: 'opacity 300ms ease, transform 200ms ease',
                    pointerEvents: 'none',
                }}
            />
```

**Note**: AnimateNode needs handles to participate in the workbench graph properly.

---

### 3. CustomEdge.tsx Changes

**Current Issue**: Manual coordinate adjustments based on incorrect assumptions

**Solution**: Remove manual offsets, trust React Flow's handle positions

**Lines 26-35 - Replace with:**
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

**Remove:**
- `sourceX: sourceX - 25`
- `targetX: targetX + 25`

**Keep:**
- `borderRadius: 10`
- `offset: 15` - This creates the "under node" effect naturally

---

## Why This Works

### Before (Current Implementation)
```
┌─────────┐
│  Node   │───[Visible Handle]───► Edge path
└─────────┘     ↕ scale(0/1)
                Position jumps!
```

### After (Proposed Implementation)
```
┌─────────┐
│  Node   │═══[Invisible Handle]═══► Stable edge path
└─────────┘     (Always present)
                ↕ same position
         [Visible Handle] (Visual only)
         (scale 0/1, no position change)
```

### Benefits
1. ✅ Edge paths stay stable regardless of selection state
2. ✅ Visual handles can still animate/fade as designed
3. ✅ Click interactions work on visible elements
4. ✅ No manual coordinate adjustments needed in edge
5. ✅ React Flow calculates correct paths from stable invisible handles

---

## Testing Checklist

- [ ] Connect ImageNode to another node
- [ ] Deselect ImageNode → edge stays in same position
- [ ] Reselect ImageNode → edge hasn't moved
- [ ] Connect AnimateNode to ImageNode
- [ ] Toggle selection on both → edges remain stable
- [ ] Verify delete button still works on edges
- [ ] Verify smoothstep curves render correctly
- [ ] Check zoom behavior doesn't break edge positioning

---

## Edge Cases to Consider

1. **Zoom level**: Ensure visible handle scales correctly with zoom (use `1/zoom`)
2. **Node resizing**: Invisible handles stay at percentage-based positions
3. **Multiple connections**: Each invisible handle can support multiple edges
4. **Click detection**: Visible element handles click, not invisible Handle

---

## Migration Strategy

This change is **additive and non-breaking**:
- Existing edges will reconnect to new invisible handles automatically
- No state or data migration needed
- Just re-render with new handle structure

**Ready for implementation?** Reply "implement" to proceed.
