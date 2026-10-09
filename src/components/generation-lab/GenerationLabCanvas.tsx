'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ReactFlow,
    applyNodeChanges,
    type Edge,
    type EdgeTypes,
    type Node,
    type NodeChange,
    type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ImageNode } from '@/components/nodes/ImageNode';
import { CustomEdge } from '@/components/nodes/CustomEdge';
import { WorkbenchCanvasBackground } from '@/components/workbench/WorkbenchCanvasBackground';
import { buildImageNode } from '@/services/workbench/mediaUploadLogic';
import { registerGenerationRetry, unregisterGenerationRetry } from '@/services/workbench/generationRetryRegistry';
import { useStore } from '@/store/useStore';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { RenderTaskOutputState } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import { DEMO_REFERENCE_DATA_URL } from './demoReference';
import { GenerationLabNode, type GenerationLabNodeData } from './GenerationLabNode';
import { GenerationAdvancedToolbar } from './GenerationAdvancedToolbar';

const LAMP_NODE_ID = 'lamp-reference';
const GENERATION_NODE_ID = 'generation-lab';
const OUTPUT_PREFIX = 'lab-output-';
/** Fixed card width of the generation node (nodeCardClass). */
const GENERATION_NODE_WIDTH = 280;

const nodeTypes: NodeTypes = { imageNode: ImageNode, generationLabNode: GenerationLabNode };
const edgeTypes: EdgeTypes = { customEdge: CustomEdge };

/** The lamp reference as a real workbench image node (demo data URL until a photo is attached). */
function buildLampFlowNode(reference: RenderTaskReference | undefined): Node {
    const image = buildImageNode({
        src: reference?.dataUrl ?? DEMO_REFERENCE_DATA_URL,
        fileName: reference?.name ?? 'Arc Lamp',
        mimeType: 'image/png',
        centerPoint: { x: 0, y: 0 },
    });
    // RF hides unmeasured nodes; jsdom never measures them, so force visibility for tests.
    return { id: LAMP_NODE_ID, type: 'imageNode', position: { x: 40, y: 170 }, style: { visibility: 'visible' }, data: { ...image, id: LAMP_NODE_ID } };
}

/** A generated output as a new image node stacked to the right of the generation node. */
function buildOutputFlowNode(output: RenderTaskOutputState, index: number): Node {
    const image = buildImageNode({
        src: output.url ?? '',
        fileName: `Output ${index + 1}`,
        mimeType: 'image/png',
        centerPoint: { x: 0, y: 0 },
    });
    return {
        id: `${OUTPUT_PREFIX}${output.id}`,
        type: 'imageNode',
        position: { x: 900, y: 70 + index * 310 },
        style: { visibility: 'visible' },
        data: { ...image, id: `${OUTPUT_PREFIX}${output.id}`, status: output.url ? ('done' as const) : undefined },
    };
}

/** Expected image outputs for a request (extract yields structured results only; seed lock implies one). */
function expectedOutputCount(request: RenderTaskRequest | null): number {
    if (!request || request.kind === 'extract') return 0;
    if (request.seed !== undefined) return 1;
    return request.variationCount ?? 1;
}

/**
 * Placeholder output node — the workbench pattern: when a generate task is
 * created, its output nodes land on the canvas immediately with status
 * 'rendering' and are settled in place when the task reaches a terminal state.
 */
function buildPlaceholderFlowNode(index: number): Node {
    const image = buildImageNode({
        src: '',
        fileName: `Rendering ${index + 1}...`,
        mimeType: 'image/png',
        centerPoint: { x: 0, y: 0 },
    });
    return {
        id: `${OUTPUT_PREFIX}${index}`,
        type: 'imageNode',
        position: { x: 900, y: 70 + index * 310 },
        style: { visibility: 'visible' },
        data: { ...image, id: `${OUTPUT_PREFIX}${index}`, name: `Rendering ${index + 1}...`, status: 'rendering' as const },
    };
}

/**
 * The initial image connects to the generate node with the shared workbench
 * CustomEdge — and it is the only edge on the canvas: the generate node has no
 * outgoing edges, and generated outputs land as detached nodes (workbench logic).
 */
const initialEdges = (): Edge[] => [
    {
        id: 'lab-lamp-edge',
        source: LAMP_NODE_ID,
        target: GENERATION_NODE_ID,
        sourceHandle: 'image-source',
        targetHandle: 'generation-lab-target',
        type: 'customEdge',
    },
];

interface GenerationLabCanvasProps {
    state: GenerationPlaygroundState;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (request: RenderTaskRequest) => void;
}

/**
 * The lab canvas: the real workbench React Flow surface with the lamp as an
 * image node connected to the shared generation node by the workbench CustomEdge.
 * The generate node has no outgoing edges — generated outputs land as new image
 * nodes created detached, and a floating toolbar above the node hosts the
 * advanced settings.
 */
export function GenerationLabCanvas({ state, references, task, onUpdate, onGenerate }: GenerationLabCanvasProps) {
    const reference = references[0];
    // Identity-preserving node building (workbench pattern): buildImageNode mints a
    // fresh UUID/timestamp per call, so rebuilding the lamp every render would churn
    // node identity and loop RF's ResizeObserver → onNodesChange round-trip.
    const lampNode = useMemo(() => buildLampFlowNode(reference), [reference]);
    const [flowNodes, setFlowNodes] = useState<Node[]>(() => [
        lampNode,
        { id: GENERATION_NODE_ID, type: 'generationLabNode', position: { x: 430, y: 90 }, style: { visibility: 'visible' }, data: {} as GenerationLabNodeData },
    ]);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    // Workbench edge logic: the CustomEdge delete control removes the connection.
    const handleDeleteEdge = useCallback((edgeId: string) => {
        setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    }, []);
    const flowEdges = useMemo<Edge[]>(
        () => edges.map((edge) => ({ ...edge, data: { onDeleteConnection: handleDeleteEdge } })),
        [edges, handleDeleteEdge],
    );

    // Live panel props ride on the node's data (workbench pattern), memoized so the
    // card re-renders only when the underlying state actually changes.
    const panelData = useMemo<GenerationLabNodeData>(() => ({
        state,
        referenceCount: references.length,
        references,
        task,
        onUpdate,
        onGenerate,
    }), [state, references, task, onUpdate, onGenerate]);

    const nodes = useMemo<Node[]>(() => flowNodes.map((node) => {
        if (node.type === 'generationLabNode') return { ...node, data: panelData };
        if (node.id === LAMP_NODE_ID) return lampNode;
        return node;
    }), [flowNodes, lampNode, panelData]);

    // IDs of the output nodes currently on the canvas (registry cleanup + settling).
    const outputNodeIdsRef = useRef<string[]>([]);

    // Workbench pattern: as soon as a generate task is created, its output nodes
    // land on the canvas immediately as 'rendering' placeholders (one per expected
    // output). Existing placeholders are reused and reset when a new task replaces
    // them (e.g. retry), mirroring useRenderNodeGeneration's placeholder handling.
    useEffect(() => {
        if (!task.taskId) return;
        const count = expectedOutputCount(useStore.getState().lastRenderRequest);
        outputNodeIdsRef.current = count === 0 ? [] : Array.from({ length: count }, (_, index) => `${OUTPUT_PREFIX}${index}`);
        setFlowNodes((current) => {
            const others = current.filter((node) => !node.id.startsWith(OUTPUT_PREFIX));
            const existing = current.filter((node) => node.id.startsWith(OUTPUT_PREFIX));
            if (count === 0) return others;
            const placeholders = Array.from({ length: count }, (_, index) => {
                const reused = existing[index];
                return reused
                    ? { ...reused, data: { ...reused.data, name: `Rendering ${index + 1}...`, status: 'rendering' as const, errorMessage: undefined } }
                    : buildPlaceholderFlowNode(index);
            });
            return [...others, ...placeholders];
        });
    }, [task.taskId]);

    // Terminal task states settle the placeholder nodes in place (workbench pattern):
    // outputs fill them by index, failures mark them with the error, cancellations
    // drop the busy state. Generated media stays detached — no outgoing edges.
    const { taskId, status, outputs, error, retry } = task;
    useEffect(() => {
        if (!taskId) return;
        const isTerminal = status === 'completed' || status === 'partial' || status === 'failed' || status === 'cancelled' || status === 'interrupted';
        if (!isTerminal) return;
        const placeholderIds = outputNodeIdsRef.current;
        setFlowNodes((current) => {
            const others = current.filter((node) => !node.id.startsWith(OUTPUT_PREFIX));
            const existing = current.filter((node) => node.id.startsWith(OUTPUT_PREFIX));

            if (status === 'completed' || status === 'partial') {
                const settled = outputs.map((output, index) => {
                    const placeholder = existing[index];
                    if (!placeholder) return buildOutputFlowNode(output, index);
                    const image = output.url ? buildImageNode({ src: output.url, fileName: `Output ${index + 1}`, mimeType: 'image/png', centerPoint: { x: 0, y: 0 } }) : null;
                    return {
                        ...placeholder,
                        data: {
                            ...placeholder.data,
                            name: `Output ${index + 1}`,
                            ...(image ? { project: image.project } : {}),
                            status: output.url ? ('done' as const) : undefined,
                            errorMessage: undefined,
                        },
                    };
                });
                const missing = existing.slice(outputs.length).map((node) => ({
                    ...node,
                    data: { ...node.data, name: 'Failed', status: 'error' as const, errorMessage: 'No output returned for this slot.' },
                }));
                return [...others, ...settled, ...missing];
            }

            if (status === 'failed') {
                const settled = existing.map((node) => ({
                    ...node,
                    data: { ...node.data, name: 'Failed', status: 'error' as const, errorMessage: error ?? 'The render task failed.' },
                }));
                return [...others, ...settled];
            }

            // cancelled / interrupted: keep the nodes, drop the busy state.
            const settled = existing.map((node) => ({
                ...node,
                data: { ...node.data, name: status === 'cancelled' ? 'Cancelled' : 'Interrupted', status: undefined, errorMessage: undefined },
            }));
            return [...others, ...settled];
        });

        // Workbench parity: failed nodes offer a node-level retry — ImageNode reads
        // the shared registry and renders its Retry button from it.
        if (status === 'failed') {
            placeholderIds.forEach((id) => registerGenerationRetry(id, () => retry()));
            return;
        }
        const settledIds = status === 'completed' || status === 'partial'
            ? [...outputs.map((output, index) => placeholderIds[index] ?? `${OUTPUT_PREFIX}${output.id}`), ...placeholderIds.slice(outputs.length)]
            : placeholderIds;
        outputNodeIdsRef.current = settledIds;
        settledIds.forEach((id) => unregisterGenerationRetry(id));
    }, [taskId, status, outputs, error, retry]);

    // Drop any registered node-level retries when the canvas unmounts.
    useEffect(() => () => {
        outputNodeIdsRef.current.forEach((id) => unregisterGenerationRetry(id));
    }, []);

    const handleNodesChange = useCallback((changes: NodeChange[]) => {
        setFlowNodes((current) => applyNodeChanges(changes, current));
    }, []);

    const generationNode = flowNodes.find((node) => node.id === GENERATION_NODE_ID);

    return (
        <div className="absolute inset-0" aria-label="Generation canvas">
            <ReactFlow
                nodes={nodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChange}
                fitView
                fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
                minZoom={0.2}
                maxZoom={4}
                snapToGrid
                snapGrid={[5, 5]}
                nodesConnectable={false}
                deleteKeyCode={null}
            >
                <WorkbenchCanvasBackground />
            </ReactFlow>
            {/* Floating advanced-settings toolbar anchored above the generate node. */}
            <GenerationAdvancedToolbar
                anchor={{ flowX: generationNode?.position.x ?? 430, flowY: generationNode?.position.y ?? 90, width: GENERATION_NODE_WIDTH }}
                value={state.advanced}
                onChange={(patch) => onUpdate({ advanced: { ...state.advanced, ...patch } })}
            />
        </div>
    );
}
