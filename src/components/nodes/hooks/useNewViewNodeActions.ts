import { useMemo, useState } from 'react';
import { useConnection } from '@xyflow/react';
import {
    ImageNode as ImageNodeType,
    NewViewWorkbenchNode,
    Project,
} from '../../../types';
import { useStore } from '../../../store/useStore';
import { renderService } from '../../../services/renderService';
import { findNonOverlappingPosition } from '../../../services/nodePositioning';
import { generateUUID } from '@/utils/uuid';
import { registerGenerationRetry, unregisterGenerationRetry } from '@/services/workbench/generationRetryRegistry';

/**
 * Generation actions for the New View node (spec 008 FR-005). Collects the
 * connected reference images, calls the backend-agnostic `newView` operation,
 * and drops a result image node next to the source — mirroring
 * `useRenderNodeGeneration`.
 */
export function useNewViewNodeActions(id: string, data: NewViewWorkbenchNode) {
    const connection = useConnection();
    const {
        updateWorkbenchNode,
        connections,
        workbenchNodes,
        addWorkbenchNode,
    } = useStore();

    const [isGenerating, setGenerating] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const view = data.data?.view ?? null;
    const inboundConnections = useMemo(() => connections.filter(c => c.to === id), [connections, id]);
    const isHoverConnectable = connection.inProgress && connection.fromNode?.type === 'imageNode' && isHovered;

    /** Resolve the connected reference images (data URIs) in connection order. */
    const collectReferenceImages = (): string[] => {
        const references: string[] = [];
        for (const conn of inboundConnections) {
            const sourceNode = workbenchNodes.find(n => n.id === conn.from);
            if (sourceNode?.type === 'image' && sourceNode.project?.thumbnail) {
                references.push(sourceNode.project.thumbnail);
            }
        }
        return references;
    };

    async function handleGenerate(existingPlaceholderId?: string) {
        if (!view || isGenerating) return;

        const referenceImages = collectReferenceImages();
        if (referenceImages.length === 0) {
            console.error('No reference image connected for new view');
            return;
        }

        // Size the output from the primary reference's canvas.
        const primarySource = workbenchNodes.find(n => n.id === inboundConnections[0]?.from);
        const width = primarySource?.type === 'image' ? primarySource.project.canvas.width : 1024;
        const height = primarySource?.type === 'image' ? primarySource.project.canvas.height : 1024;
        const ratio = width / height;
        const aspectRatio = Math.abs(ratio - 1) < 0.1 ? 'square' : ratio > 1 ? 'landscape' : 'portrait';

        setGenerating(true);

        const placeholderId = existingPlaceholderId ?? generateUUID();
        const nodeWidth = primarySource?.width ?? 256;
        const nodeHeight = primarySource?.height ?? 256;
        const startX = data.x + (data.width ?? 280) + 100;
        const startY = data.y + ((data.height ?? 160) / 2) - (nodeHeight / 2);

        try {
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

            if (!existingPlaceholderId) {
                const placeholderNode: ImageNodeType = {
                    id: placeholderId,
                    type: 'image',
                    name: `New view: ${view}...`,
                    x: currentX,
                    y: currentY,
                    width: nodeWidth,
                    height: nodeHeight,
                    status: 'rendering',
                    project: {
                        id: placeholderId,
                        name: 'Rendering...',
                        createdAt: Date.now(),
                        lastModifiedAt: Date.now(),
                        canvas: {
                            width,
                            height,
                            aspectRatio,
                            zoomLevel: 1,
                            panX: 0,
                            panY: 0,
                            backgroundColor: '#ffffff',
                        },
                        layers: [],
                    },
                };
                addWorkbenchNode(placeholderNode);
            } else {
                updateWorkbenchNode(placeholderId, {
                    status: 'rendering',
                    errorMessage: undefined,
                } as Partial<ImageNodeType>);
            }

            const response = await renderService.newView({
                referenceImages,
                init_image: referenceImages[0],
                view,
                width,
                height,
            });

            if (response.success && response.images.length > 0) {
                const imageUrl = response.images[0];
                const project: Project = {
                    id: placeholderId,
                    name: `New view: ${view}`,
                    createdAt: Date.now(),
                    lastModifiedAt: Date.now(),
                    thumbnail: imageUrl,
                    canvas: {
                        width,
                        height,
                        aspectRatio,
                        zoomLevel: 1,
                        panX: 0,
                        panY: 0,
                        backgroundColor: '#ffffff',
                    },
                    layers: [
                        {
                            id: 'layer-1',
                            name: 'New View',
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

                updateWorkbenchNode(placeholderId, {
                    project,
                    status: 'done',
                    name: project.name,
                    errorMessage: undefined,
                } as Partial<ImageNodeType>);
                unregisterGenerationRetry(placeholderId);
            } else {
                updateWorkbenchNode(placeholderId, {
                    status: 'error',
                    name: 'Failed',
                    errorMessage: response.error ?? 'The image could not be generated. Try again.',
                } as Partial<ImageNodeType>);
                registerGenerationRetry(placeholderId, () => void handleGenerate(placeholderId));
            }
        } catch (error) {
            updateWorkbenchNode(placeholderId, {
                status: 'error',
                name: 'Error',
                errorMessage: error instanceof Error ? error.message : 'The image could not be generated. Try again.',
            } as Partial<ImageNodeType>);
            registerGenerationRetry(placeholderId, () => void handleGenerate(placeholderId));
        } finally {
            setGenerating(false);
        }
    }

    return {
        view,
        isGenerating,
        isHoverConnectable,
        setIsHovered,
        referenceCount: inboundConnections.length,
        handleGenerate,
    };
}
