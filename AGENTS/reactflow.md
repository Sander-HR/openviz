# React Flow (@xyflow/react)

React Flow is used for the Workbench node graph system.

## Location

Workbench logic is located in `src/components/workbench/`:
- `workbench.tsx` - Main flow canvas
- `ImageNode.tsx`, `AnimateNode.tsx`, `RenderNode.tsx` - Custom node components
- `CustomEdge.tsx` - Custom edge component
- `hooks/useWorkbench.ts` - Flow state management

## Package

```json
"@xyflow/react": "^12.10.0"
```


## Key Patterns

### Component Structure

Always wrap with `ReactFlowProvider`:

```tsx
import { ReactFlowProvider } from '@xyflow/react';

export const Workbench: React.FC = () => (
  <ReactFlowProvider>
    <WorkbenchContent />
  </ReactFlowProvider>
);
```


### Custom Node Types

Define node type mappings and register them:

```tsx
import { NodeTypes } from '@xyflow/react';

const nodeTypes: NodeTypes = {
  imageNode: ImageNode,
  animateNode: AnimateNode,
  renderNode: RenderNode,
};

<ReactFlow nodeTypes={nodeTypes} />
```


### Node Component Structure

Use `Handle` components for connections and `NodeResizer` for resize support:

```tsx
import { Handle, Position, NodeResizer } from '@xyflow/react';

export const CustomNode: React.FC<NodeProps> = ({ data, selected }) => (
  <>
    {/* NodeResizer automatically detects parent node - no nodeId prop needed */}
    <NodeResizer isVisible={selected} minWidth={100} minHeight={50} />
    
    <Handle type="target" position={Position.Left} />
    {/* Node content */}
    <Handle type="source" position={Position.Right} />
  </>
);
```


### Zoom-Aware Styling

Use `useViewport` for zoom-dependent sizes:

```tsx
import { useViewport } from '@xyflow/react';

const { zoom } = useViewport();
const scale = 1 / zoom; // Keep handle size constant at all zoom levels
```


### State Updates

Use `applyNodeChanges` helper to apply changes, then optionally sync with external store:

```tsx
import { OnNodesChange, applyNodeChanges } from '@xyflow/react';

const onNodesChange: OnNodesChange = useCallback((changes) => {
  // First apply changes to React Flow state
  setNodes((nds) => applyNodeChanges(changes, nds));
  
  // Then optionally sync specific changes to Zustand store
  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      updateNodeInStore(change.id, {
        x: change.position.x,
        y: change.position.y,
      });
    }
  });
}, [updateNodeInStore]);
```


### Connections

Handle connections via `onConnect`:

```tsx
import { OnConnect } from '@xyflow/react';

const handleConnect: OnConnect = useCallback((params) => {
  if (params.source && params.target) {
    addConnection(params.source, params.target);
  }
}, [addConnection]);
```


## Styling

Import base styles once in the main component:

```tsx
import '@xyflow/react/dist/style.css';
```


## Constraints

- Node IDs must be unique strings
- Custom node components must be stable (define outside render or use `useMemo`)
- Handle IDs are optional but recommended for multiple handles per node
- Use `snapToGrid` and `snapGrid={[x, y]}` props for aligned positioning
- `NodeResizer` automatically detects its parent node context - no `nodeId` prop needed
- Always use `applyNodeChanges()` and `applyEdgeChanges()` helpers for state updates


## V12 Migration Notes

- Package changed from `reactflow` to `@xyflow/react` [web:37]
- Import is now named: `import { ReactFlow } from '@xyflow/react'`
- Style import: `@xyflow/react/dist/style.css` or `@xyflow/react/dist/base.css`
- `parentNode` renamed to `parentId` [web:37]
- Node props `xPos`/`yPos` renamed to `positionAbsoluteX`/`positionAbsoluteY` [web:37]
