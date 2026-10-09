'use client';

import { useCallback, useState } from 'react';
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    NodeTypes,
    EdgeTypes,
    OnNodesChange,
    OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
    Node,
    Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ImageNode } from '@/components/nodes/ImageNode';
import { RenderNode } from '@/components/nodes/RenderNode';
import { CustomEdge } from '@/components/nodes/CustomEdge';
import { WorkbenchConnectionLine } from '@/components/nodes/WorkbenchConnectionLine';

const nodeTypes: NodeTypes = {
    imageNode: ImageNode,
    renderNode: RenderNode,
};

const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

const initialNodes: Node[] = [
    {
        id: 'image-1',
        type: 'imageNode',
        position: { x: 100, y: 100 },
        data: {
            id: 'image-1',
            name: 'Test Image',
            type: 'image',
            status: 'ready',
            project: {
                id: 'image-1',
                name: 'Test Image',
                thumbnail: 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?w=256&h=256&fit=crop',
                canvas: { width: 512, height: 512, aspectRatio: 'square' as const },
            },
            width: 256,
            height: 256,
            scale: 0.5,
        },
        width: 256,
        height: 256,
        selected: false,
    },
    {
        id: 'render-1',
        type: 'renderNode',
        position: { x: 500, y: 100 },
        data: {
            id: 'render-1',
            name: 'Test Render',
            type: 'render',
            data: {
                prompt: '',
                stylePreset: 'Photorealistic',
                drawingInfluence: 0.65,
                numImages: 1,
            },
            width: 320,
            height: 400,
            inboundConnections: [],
        },
        width: 320,
        height: 400,
        selected: false,
    },
];

const initialEdges: Edge[] = [
    {
        id: 'edge-1',
        source: 'image-1',
        target: 'render-1',
        sourceHandle: 'image-source',
        targetHandle: null,
        type: 'customEdge',
    },
];

export default function TestPage() {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    const onNodesChange: OnNodesChange = useCallback(
        (changes: NodeChange[]) => {
            console.log('[Test] onNodesChange:', changes);
            setNodes((nds) => applyNodeChanges(changes, nds) as Node[]);
        },
        []
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges((eds) => applyEdgeChanges(changes, eds) as Edge[]);
        },
        []
    );

    const handleResize = useCallback((nodeId: string, width: number, height: number) => {
        console.log('[Test] handleResize called:', { nodeId, width, height });
    }, []);

    const updatedNodes = nodes.map((node) => ({
        ...node,
        data: {
            ...node.data,
            onResize: handleResize,
        },
    }));

    return (
        <div className="w-screen h-screen">
            <ReactFlow
                nodes={updatedNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                minZoom={0.1}
                maxZoom={2}
                connectionLineComponent={WorkbenchConnectionLine}
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#c6cfdb" />
            </ReactFlow>
            
            <div className="absolute top-4 left-4 z-50 bg-white p-4 rounded-lg shadow-lg">
                <h1 className="font-bold mb-2">Resize Test Page</h1>
                <p className="text-sm text-gray-600">Select the image node and drag the resize handles</p>
                <p className="text-xs text-gray-500 mt-2">Check console for resize events</p>
            </div>
        </div>
    );
}
