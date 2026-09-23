import { useMemo, useState } from 'react';
import { useConnection } from '@xyflow/react';
import { AnimateNode as AnimateNodeType, Project, VideoNode as VideoNodeType, WorkbenchNode } from '../../../types';
import { useStore } from '../../../store/useStore';
import { renderService } from '../../../services/renderService';
import { getVideoStyles } from '../../../services/ai/workflowRegistry';
import { findNonOverlappingPosition } from '../../../services/nodePositioning';
import { generateUUID } from '@/utils/uuid';

export function useAnimateNodeActions(id: string, data: AnimateNodeType) {
    const connection = useConnection();
    const {
        setActiveNodeId,
        updateWorkbenchNode,
        workbenchNodes,
        connections,
        removeConnection,
        addConnection,
        addWorkbenchNode,
    } = useStore();

    const [isAnimating, setAnimating] = useState(false);
    const [showStyles, setShowStyles] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const videoStyles = useMemo(() => getVideoStyles(), []);
    const settings = data.data.settings || { model: 'standard', duration: '5s' };
    const prompt = data.data.prompt || '';

    const inboundConnections = useMemo(() => connections.filter(c => c.to === id), [connections, id]);
    const sourceNodeId1 = inboundConnections[0]?.from;
    const sourceNodeId2 = inboundConnections[1]?.from;

    const sourceNode1 = workbenchNodes.find(n => n.id === sourceNodeId1);
    const sourceNode2 = workbenchNodes.find(n => n.id === sourceNodeId2);
    const isHoverConnectable = connection.inProgress && connection.fromNode?.type === 'imageNode' && isHovered;

    const handleNodeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveNodeId(id);
    };

    const updateData = (updates: Partial<AnimateNodeType['data']>) => {
        updateWorkbenchNode(id, {
            data: { ...data.data, ...updates },
        } as Partial<WorkbenchNode>);
    };

    const updateSettings = (updates: Partial<AnimateNodeType['data']['settings']>) => {
        updateData({
            settings: { ...settings, ...updates },
        });
    };

    const handleDisconnect = (index: number) => {
        const inboundConnection = inboundConnections[index];
        if (inboundConnection) removeConnection(inboundConnection.id);
    };

    const handleSwapFrames = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (inboundConnections.length === 2) {
            const conn1 = inboundConnections[0];
            const conn2 = inboundConnections[1];
            removeConnection(conn1.id);
            removeConnection(conn2.id);
            addConnection(conn2.from, id, conn2.sourceHandle ?? 'image-source', conn2.targetHandle ?? null);
            addConnection(conn1.from, id, conn1.sourceHandle ?? 'image-source', conn1.targetHandle ?? null);
        }
    };

    const handleAnimate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setAnimating(true);

        const placeholderId = generateUUID();

        try {
            let initImage = '';
            let endImage = '';
            let width = 512;
            let height = 512;

            if (sourceNode1 && (sourceNode1.type === 'image' || sourceNode1.type === 'video') && sourceNode1.project?.thumbnail) {
                initImage = sourceNode1.project.thumbnail;
                width = sourceNode1.project.canvas.width;
                height = sourceNode1.project.canvas.height;
            }

            if (sourceNode2 && (sourceNode2.type === 'image' || sourceNode2.type === 'video') && sourceNode2.project?.thumbnail) {
                endImage = sourceNode2.project.thumbnail;
            }

            if (!initImage) {
                console.error('No input image for animation');
                setAnimating(false);
                return;
            }

            const startX = data.x + (data.width || 320) + 100;
            const aspectRatio = width / height;

            let nodeWidth = 512;
            let nodeHeight = 512 / aspectRatio;

            if (sourceNode1) {
                nodeWidth = sourceNode1.width || 512;
                nodeHeight = sourceNode1.height || (512 / aspectRatio);
            }

            const startY = data.y + ((data.height || 0) / 2) - (nodeHeight / 2);

            const { x: currentX, y: currentY } = findNonOverlappingPosition({
                startX,
                startY,
                nodeWidth,
                nodeHeight,
                existingNodes: workbenchNodes,
                columns: 4,
                gap: 50,
                margin: 50,
            });

            const placeholderNode: VideoNodeType = {
                id: placeholderId,
                type: 'video',
                name: 'Animating...',
                x: currentX,
                y: currentY,
                width: nodeWidth,
                height: nodeHeight,
                status: 'rendering',
                project: {
                    id: placeholderId,
                    name: 'Animation',
                    createdAt: Date.now(),
                    lastModifiedAt: Date.now(),
                    canvas: {
                        width,
                        height,
                        aspectRatio: aspectRatio === 1 ? 'square' : aspectRatio > 1 ? 'landscape' : 'portrait',
                        zoomLevel: 1,
                        panX: 0,
                        panY: 0,
                        backgroundColor: '#ffffff',
                    },
                    layers: [],
                },
            };

            addWorkbenchNode(placeholderNode);

            const response = await renderService.animate({
                workflowId: endImage ? 'animate_from_to' : (settings.workflowId || 'video_standard'),
                init_image: initImage,
                end_image: endImage,
                prompt,
                width,
                height,
            });

            if (response.success && response.images.length > 0) {
                const videoUrl = response.images[0];
                const project: Project = {
                    id: placeholderId,
                    name: 'Animation Result',
                    createdAt: Date.now(),
                    lastModifiedAt: Date.now(),
                    thumbnail: videoUrl,
                    canvas: {
                        width,
                        height,
                        aspectRatio: width === height ? 'square' : width > height ? 'landscape' : 'portrait',
                        zoomLevel: 1,
                        panX: 0,
                        panY: 0,
                        backgroundColor: '#000000',
                    },
                    layers: [
                        {
                            id: 'layer-1',
                            name: 'Video',
                            type: 'image',
                            visible: true,
                            locked: false,
                            opacity: 100,
                            blendMode: 'normal',
                            strokes: [],
                            image: videoUrl,
                            order: 0,
                            created: Date.now(),
                            modified: Date.now(),
                        },
                    ],
                };

                updateWorkbenchNode(placeholderId, {
                    project,
                    status: 'done',
                    name: 'Animation Ready',
                    renderResults: [],
                } as Partial<VideoNodeType>);

                updateData({
                    frames: {
                        ...data.data.frames,
                        end: videoUrl,
                    },
                });
            } else {
                updateWorkbenchNode(placeholderId, { status: 'error', name: 'Failed' } as Partial<VideoNodeType>);
            }
        } catch (error) {
            console.error('Animation failed', error);
            updateWorkbenchNode(placeholderId, { status: 'error', name: 'Error' } as Partial<VideoNodeType>);
        } finally {
            setAnimating(false);
        }
    };

    return {
        videoStyles,
        settings,
        prompt,
        sourceNode1,
        sourceNode2,
        inboundConnections,
        isAnimating,
        showStyles,
        setShowStyles,
        isHoverConnectable,
        setIsHovered,
        handleNodeClick,
        updateData,
        updateSettings,
        handleDisconnect,
        handleSwapFrames,
        handleAnimate,
    };
}
