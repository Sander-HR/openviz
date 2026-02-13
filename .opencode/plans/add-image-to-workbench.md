# Implementation Plan: Add Single Image to Workbench

## Objective
When clicking "Add to workbench" on a single image in the ResultsPanel, it should create a new ImageNode in the workbench using the same positioning algorithm as the RenderNode component.

## Files to Modify

### 1. Create `/Users/sander/dev/openviz/src/services/nodePositioning.ts` (NEW FILE)
**Extract the positioning algorithm to a reusable service:**

```typescript
import { WorkbenchNode } from '../types';

interface PositioningParams {
    startX: number;
    startY: number;
    nodeWidth: number;
    nodeHeight: number;
    existingNodes: WorkbenchNode[];
    columns?: number;
    gap?: number;
    margin?: number;
}

interface Position {
    x: number;
    y: number;
}

/**
 * Finds a non-overlapping position for a new node using a grid-based algorithm.
 * Iterates through grid positions starting from (startX, startY) until a free spot is found.
 */
export function findNonOverlappingPosition({
    startX,
    startY,
    nodeWidth,
    nodeHeight,
    existingNodes,
    columns = 4,
    gap = 50,
    margin = 20
}: PositioningParams): Position {
    let slotIndex = 0;
    
    while (true) {
        const col = slotIndex % columns;
        const row = Math.floor(slotIndex / columns);
        
        const currentX = startX + (col * (nodeWidth + gap));
        const currentY = startY + (row * (nodeHeight + gap));

        // Check for overlap with existing nodes
        const isOverlapping = existingNodes.some(n => 
            currentX < n.x + n.width + margin &&
            currentX + nodeWidth + margin > n.x &&
            currentY < n.y + n.height + margin &&
            currentY + nodeHeight + margin > n.y
        );

        if (!isOverlapping) {
            return { x: currentX, y: currentY };
        }
        
        slotIndex++;
    }
}
```

### 2. `/Users/sander/dev/openviz/src/components/nodes/RenderNode.tsx`
**Refactor to use the extracted service (lines 99-135):**

Replace lines 99-135 with:
```typescript
import { findNonOverlappingPosition } from '../../services/nodePositioning';

// ... existing code ...

// Find a non-overlapping position
const { x: currentX, y: currentY } = findNonOverlappingPosition({
    startX,
    startY,
    nodeWidth,
    nodeHeight,
    existingNodes: workbenchNodes,
    columns: 4,
    gap: 50,
    margin: 20
});
```

This will reduce file size and remove duplication.

### 3. `/Users/sander/dev/openviz/src/store/slices/workbenchSlice.ts`
**Add new interface method and implementation:**

Add to WorkbenchSlice interface (around line 31):
```typescript
addImageToWorkbench: (image: string) => void;
```

Add implementation after `addGroupToWorkbench` (around line 492), using the new service:
```typescript
addImageToWorkbench: (image) => set((state: AppState) => {
    const activeNode = state.workbenchNodes.find(n => n.id === state.activeNodeId) as ImageNode | undefined;

    // Default dimensions (256x256 matches Studio's 1024/4)
    let nodeWidth = 256;
    let nodeHeight = 256;
    
    // Inherit dimensions from active node if it exists
    if (activeNode) {
        nodeWidth = activeNode.width;
        nodeHeight = activeNode.height;
    }

    // Position to the right of the active node, or default position
    const startX = activeNode ? activeNode.x + activeNode.width + 100 : 100;
    const startY = activeNode ? activeNode.y : 100;

    // Use the extracted positioning service
    const { x: currentX, y: currentY } = findNonOverlappingPosition({
        startX,
        startY,
        nodeWidth,
        nodeHeight,
        existingNodes: state.workbenchNodes,
        columns: 4,
        gap: 50,
        margin: 20
    });

    const id = Math.random().toString(36).substr(2, 9);
    
    // Calculate aspect ratio from dimensions
    const ratio = nodeWidth / nodeHeight;
    let aspectRatio: AspectRatio = 'square';
    if (Math.abs(ratio - 1) > 0.1) {
        aspectRatio = ratio > 1 ? 'landscape' : 'portrait';
    }

    const newProject: Project = {
        ...INITIAL_PROJECT,
        id,
        name: 'Image',
        thumbnail: image,
        canvas: {
            ...INITIAL_PROJECT.canvas,
            width: 1024,
            height: 1024,
            aspectRatio
        },
        layers: [
            {
                ...INITIAL_PROJECT.layers[0],
                id: 'bg-layer',
                order: 0,
            },
            {
                id: 'render-layer',
                name: 'Render',
                type: 'render',
                visible: true,
                locked: false,
                opacity: 100,
                blendMode: 'normal',
                strokes: [],
                image,
                order: 1,
                created: Date.now(),
                modified: Date.now(),
            }
        ],
        createdAt: Date.now(),
        lastModifiedAt: Date.now()
    };

    const newNode: ImageNode = {
        id,
        type: 'image',
        name: 'Image',
        x: currentX,
        y: currentY,
        width: nodeWidth,
        height: nodeHeight,
        project: newProject
    };

    return {
        workbenchNodes: [...state.workbenchNodes, newNode]
    };
}),
```

Also add import at top of file:
```typescript
import { findNonOverlappingPosition } from '../../services/nodePositioning';
```

### 4. `/Users/sander/dev/openviz/src/store/storeTypes.ts`
**Add type definition (around line 68):**

Add after `addGroupToWorkbench`:
```typescript
addImageToWorkbench: (image: string) => void;
```

### 5. `/Users/sander/dev/openviz/src/components/studio/ResultsPanel.tsx`
**Update the "Add to workbench" action (around line 261):**

Add `addImageToWorkbench` to the destructured store at line 31:
```typescript
const {
    renderResults,
    activeNodeId,
    resultsPanelOpen,
    setResultsPanelOpen,
    previewingRender,
    setPreviewingRender,
    isPreviewVisible,
    setIsPreviewVisible,
    addResultAsLayer,
    loadRenderSettings,
    addGroupToWorkbench,
    addImageToWorkbench,  // Add this
    isRendering
} = useStore();
```

Replace the TODO comment at lines 261-265:
```typescript
{
    label: 'Add to workbench',
    onClick: () => {
        // TODO: Implement single image workbench addition
        console.log('Add to workbench:', img);
    }
},
```

With actual implementation:
```typescript
{
    label: 'Add to workbench',
    onClick: () => addImageToWorkbench(img)
},
```

## Benefits of This Approach

1. **DRY (Don't Repeat Yourself)**: The positioning algorithm is defined once in the service
2. **Easier maintenance**: Changes to positioning logic only need to be made in one place
3. **Testability**: The positioning logic can be unit tested independently
4. **Refactoring compliance**: Following AGENTS.md guidelines to keep files under 250 lines
5. **Business logic separation**: Positioning is pure business logic that belongs in `src/services/`

## Algorithm Details

### Positioning Strategy (from RenderNode.tsx)
- **Grid layout**: 4 columns with 50px gap
- **Start position**: 100px to the right of the reference node
- **Overlap detection**: 20px margin around each node
- **Iteration**: Checks grid positions row by row, column by column until a free spot is found

### Dimension Inheritance
- If there's an active node (currently open in Studio), use its dimensions
- Otherwise, use default 256x256 (matches Studio's 1024px canvas at 25% scale)
- Aspect ratio is calculated from dimensions

### Node Creation
- Creates an ImageNode with type 'image'
- Sets the image as the project thumbnail
- Creates a render layer with the image
- Sets created/modified timestamps to current time
