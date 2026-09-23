import { useMemo, useState } from 'react';
import { useConnection } from '@xyflow/react';
import {
    AspectRatio,
    ImageNode as ImageNodeType,
    Project,
    RenderNode as RenderNodeType,
    RenderSettings,
    WorkbenchNode,
} from '../../../types';
import { useStore } from '../../../store/useStore';
import { renderService } from '../../../services/renderService';
import { getRenderStyles } from '../../../services/ai/workflowRegistry';
import { findNonOverlappingPosition } from '../../../services/nodePositioning';
import { generateUUID } from '@/utils/uuid';

type CanvasFlattenWindow = Window & {
    getFlattenedCanvas?: () => string;
};

function toAspectRatio(value: string): AspectRatio {
    if (
        value === '16:9' ||
        value === '4:3' ||
        value === '1:1' ||
        value === '9:16' ||
        value === '3:4' ||
        value === 'square' ||
        value === 'landscape' ||
        value === 'portrait'
    ) {
        return value;
    }
    return 'square';
}

export function useRenderNodeGeneration(id: string, data: RenderNodeType) {
    const connection = useConnection();
    const {
        updateWorkbenchNode,
        addRenderResultGroup,
        connections,
        workbenchNodes,
        addWorkbenchNode,
    } = useStore();
    const [isRendering, setRendering] = useState(false);
    const [showStyles, setShowStyles] = useState(false);
    const [showNumImagesDropdown, setShowNumImagesDropdown] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const settings = data.data;
    const availableStyles = useMemo(() => getRenderStyles(), []);

    const inboundConnections = useMemo(() => connections.filter(c => c.to === id), [connections, id]);
    const sourceNodeId = inboundConnections[0]?.from;
    const isHoverConnectable = connection.inProgress && connection.fromNode?.type === 'imageNode' && isHovered;

    const updateSettings = (updates: Partial<RenderSettings>) => {
        updateWorkbenchNode(id, {
            data: { ...settings, ...updates },
        } as Partial<WorkbenchNode>);
    };

    const handleGenerate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!settings.prompt?.trim()) return;
        setRendering(true);

        const placeholderIds: string[] = [];

        try {
            let initImage = settings.referenceImage || '';

            if (sourceNodeId && !initImage) {
                const sourceNode = workbenchNodes.find(n => n.id === sourceNodeId);
                if (sourceNode?.type === 'image' && sourceNode.project?.thumbnail) {
                    initImage = sourceNode.project.thumbnail;
                }
            }

            if (!initImage) {
                const canvasData = (window as CanvasFlattenWindow).getFlattenedCanvas?.() ?? '';
                if (typeof canvasData === 'string') initImage = canvasData;
            }

            if (!initImage) {
                console.error('No input image for render');
                setRendering(false);
                return;
            }

            const numImages = settings.numImages || 1;
            const startX = data.x + (data.width ?? 320) + 100;

            let nodeWidth = 256;
            let nodeHeight = 256;
            let canvasWidth = 1024;
            let canvasHeight = 1024;
            let aspectRatio = 'square';

            if (sourceNodeId) {
                const sourceNode = workbenchNodes.find(n => n.id === sourceNodeId);
                if (sourceNode) {
                    nodeWidth = sourceNode.width ?? 256;
                    nodeHeight = sourceNode.height ?? 256;

                    if (sourceNode.type === 'image' || sourceNode.type === 'video') {
                        canvasWidth = sourceNode.project.canvas.width;
                        canvasHeight = sourceNode.project.canvas.height;
                        aspectRatio = sourceNode.project.canvas.aspectRatio;
                    } else {
                        const ratio = nodeWidth / nodeHeight;
                        if (Math.abs(ratio - 1) < 0.1) aspectRatio = 'square';
                        else if (ratio > 1) aspectRatio = 'landscape';
                        else aspectRatio = 'portrait';

                        canvasWidth = aspectRatio === 'portrait' ? Math.round(1024 * (nodeWidth / nodeHeight)) : 1024;
                        canvasHeight = aspectRatio === 'landscape' ? Math.round(1024 * (nodeHeight / nodeWidth)) : 1024;
                    }
                }
            }

            const startY = data.y + ((data.height ?? 400) / 2) - (nodeHeight / 2);

            const batchNewNodes: WorkbenchNode[] = [];
            for (let i = 0; i < numImages; i++) {
                const newId = generateUUID();
                placeholderIds.push(newId);

                const { x: currentX, y: currentY } = findNonOverlappingPosition({
                    startX,
                    startY,
                    nodeWidth,
                    nodeHeight,
                    existingNodes: [...workbenchNodes, ...batchNewNodes],
                    columns: 4,
                    gap: 50,
                    margin: 50,
                });

                const placeholderNode: ImageNodeType = {
                    id: newId,
                    type: 'image',
                    name: `Rendering ${i + 1}...`,
                    x: currentX,
                    y: currentY,
                    width: nodeWidth,
                    height: nodeHeight,
                    status: 'rendering',
                    project: {
                        id: newId,
                        name: 'Rendering...',
                        createdAt: Date.now(),
                        lastModifiedAt: Date.now(),
                        canvas: {
                            width: canvasWidth,
                            height: canvasHeight,
                            aspectRatio: toAspectRatio(aspectRatio),
                            zoomLevel: 1,
                            panX: 0,
                            panY: 0,
                            backgroundColor: '#ffffff',
                        },
                        layers: [],
                    },
                };

                batchNewNodes.push(placeholderNode);
                addWorkbenchNode(placeholderNode);
            }

            const selectedStyle = availableStyles.find(s => s.name === settings.stylePreset);
            const workflowId = selectedStyle?.id;

            const response = await renderService.generate({
                ...settings,
                workflowId,
                init_image: initImage,
                width: canvasWidth,
                height: canvasHeight,
            });

            if (response.success && response.images.length > 0) {
                addRenderResultGroup(settings, response.images, canvasWidth, canvasHeight, id);

                response.images.forEach((imageUrl, index) => {
                    if (index < placeholderIds.length) {
                        const nodeId = placeholderIds[index];
                        const project: Project = {
                            id: nodeId,
                            name: settings.prompt.substring(0, 30) + (settings.prompt.length > 30 ? '...' : ''),
                            createdAt: Date.now(),
                            lastModifiedAt: Date.now(),
                            thumbnail: imageUrl,
                            canvas: {
                                width: canvasWidth,
                                height: canvasHeight,
                                aspectRatio: toAspectRatio(aspectRatio),
                                zoomLevel: 1,
                                panX: 0,
                                panY: 0,
                                backgroundColor: '#ffffff',
                            },
                            layers: [
                                {
                                    id: 'layer-1',
                                    name: 'Render',
                                    type: 'image',
                                    visible: true,
                                    locked: false,
                                    opacity: 100,
                                    blendMode: 'normal',
                                    strokes: [],
                                    image: imageUrl,
                                    order: 0,
                                    created: Date.now(),
                                    modified: Date.now(),
                                },
                            ],
                        };

                        updateWorkbenchNode(nodeId, {
                            project,
                            status: 'done',
                            name: project.name,
                        } as Partial<ImageNodeType>);
                    }
                });
            } else {
                placeholderIds.forEach(placeholderId => {
                    updateWorkbenchNode(placeholderId, { status: 'error', name: 'Failed' } as Partial<ImageNodeType>);
                });
            }
        } catch (error) {
            console.error('Generation failed', error);
            placeholderIds.forEach(placeholderId => {
                updateWorkbenchNode(placeholderId, { status: 'error', name: 'Error' } as Partial<ImageNodeType>);
            });
        } finally {
            setRendering(false);
        }
    };

    return {
        settings,
        availableStyles,
        isRendering,
        showStyles,
        setShowStyles,
        showNumImagesDropdown,
        setShowNumImagesDropdown,
        isHoverConnectable,
        setIsHovered,
        updateSettings,
        handleGenerate,
    };
}
