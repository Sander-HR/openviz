import React, { useState } from 'react';
import { useConnection, Handle, Position } from '@xyflow/react';
import { Wand2, ChevronDown, Layers } from 'lucide-react';
import { RenderNode as RenderNodeType, RenderSettings, ImageNode as ImageNodeType, Project } from '../../types';
import { useStore } from '../../store/useStore';
import { renderService } from '../../services/renderService';
import { getRenderStyles } from '../../services/ai/workflowRegistry';
import { findNonOverlappingPosition } from '../../services/nodePositioning';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface RenderNodeProps {
    id: string;
    data: RenderNodeType;
    selected: boolean;
}

export const RenderNode: React.FC<RenderNodeProps> = ({ id, data, selected }) => {
    const connection = useConnection();
    const { updateWorkbenchNode, addRenderResultGroup, connections, workbenchNodes, addWorkbenchNode, addConnection } = useStore();
    const [isRendering, setRendering] = useState(false);
    const [showStyles, setShowStyles] = useState(false);
    const [showNumImagesDropdown, setShowNumImagesDropdown] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const isHoverConnectable = connection.inProgress && connection.fromNode?.type === 'imageNode' && isHovered;

    const settings = data.data;

    const availableStyles = getRenderStyles();

    // Find all connections to this node
    const inboundConnections = connections.filter(c => c.to === id);
    const sourceNodeId = inboundConnections[0]?.from;

    // Auto-position once when connected to a source node - DISABLED
    // Track the last source node ID to only auto-position on initial connection
    // const lastSourceId = React.useRef<string | null>(null);
    // useEffect(() => {
    //     if (sourceNodeId && sourceNodeId !== lastSourceId.current) {
    //         lastSourceId.current = sourceNodeId;
    //         const sourceNode = workbenchNodes.find(n => n.id === sourceNodeId);
    //         if (sourceNode) {
    //             const targetX = sourceNode.x + (sourceNode.width ?? 320) + 100;
    //             const targetY = sourceNode.y + ((sourceNode.height ?? 400) / 2) - ((data.height ?? 400) / 2);
    //             updateWorkbenchNode(id, { x: targetX, y: targetY });
    //         }
    //     }
    // }, [sourceNodeId, workbenchNodes, id, data.height, updateWorkbenchNode]);

    const updateSettings = (updates: Partial<RenderSettings>) => {
        updateWorkbenchNode(id, {
            data: { ...settings, ...updates }
        } as any);
    };

    const handleGenerate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!settings.prompt?.trim()) return;
        setRendering(true);

        const placeholderIds: string[] = [];

        try {
            let initImage = settings.referenceImage || "";
            
            if (sourceNodeId && !initImage) {
                 const sourceNode = workbenchNodes.find(n => n.id === sourceNodeId);
                 if (sourceNode?.type === 'image' && sourceNode.project?.thumbnail) {
                     initImage = sourceNode.project.thumbnail;
                 }
            }
            
            if (!initImage) {
                 const canvasData = (window as any).getFlattenedCanvas ? (window as any).getFlattenedCanvas() : "";
                 if (typeof canvasData === 'string') initImage = canvasData;
            }

            if (!initImage) {
                console.error("No input image for render");
                setRendering(false);
                return;
            }

            // --- 1. Create Placeholder Nodes ---
            const numImages = settings.numImages || 1;
            const startX = data.x + (data.width ?? 320) + 100;

            // Get source node dimensions and resolution
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
                         // Fallback for other node types
                        const ratio = nodeWidth / nodeHeight;
                        if (Math.abs(ratio - 1) < 0.1) aspectRatio = 'square';
                        else if (ratio > 1) aspectRatio = 'landscape';
                        else aspectRatio = 'portrait';

                        canvasWidth = aspectRatio === 'portrait' ? Math.round(1024 * (nodeWidth / nodeHeight)) : 1024;
                        canvasHeight = aspectRatio === 'landscape' ? Math.round(1024 * (nodeHeight / nodeWidth)) : 1024;
                    }
                }
            }

            // Center vertically relative to the generator node
            const startY = data.y + ((data.height ?? 400) / 2) - (nodeHeight / 2);
            
            const batchNewNodes: any[] = [];
            for (let i = 0; i < numImages; i++) {
                const newId = crypto.randomUUID();
                placeholderIds.push(newId);

                // Find a non-overlapping position using the positioning service
                // Include batchNewNodes in the search to avoid overlapping within the same batch
                const { x: currentX, y: currentY } = findNonOverlappingPosition({
                    startX,
                    startY,
                    nodeWidth,
                    nodeHeight,
                    existingNodes: [...workbenchNodes, ...batchNewNodes],
                    columns: 4,
                    gap: 50,
                    margin: 50
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
                            aspectRatio: aspectRatio as any,
                            zoomLevel: 1,
                            panX: 0,
                            panY: 0,
                            backgroundColor: '#ffffff'
                        },
                        layers: []
                    }
                };

                batchNewNodes.push(placeholderNode);
                addWorkbenchNode(placeholderNode);
                // Optional: Connect render node to output nodes
                addConnection(id, newId);
            }

            // --- 2. Call Render Service ---
            // Look up workflow ID
            const selectedStyle = availableStyles.find(s => s.name === settings.stylePreset);
            const workflowId = selectedStyle?.id;


            const response = await renderService.generate({
                ...settings,
                workflowId,
                init_image: initImage,
                width: canvasWidth,
                height: canvasHeight
            });

            // --- 3. Update Placeholders on Success ---
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
                                aspectRatio: aspectRatio as any,
                                zoomLevel: 1,
                                panX: 0,
                                panY: 0,
                                backgroundColor: '#ffffff'
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
                                    modified: Date.now()
                                }
                            ]
                        };

                        updateWorkbenchNode(nodeId, {
                            project: project,
                            status: 'done',
                            name: project.name
                        } as Partial<ImageNodeType>);
                    }
                });
            } else {
                // Handle success=false but no exception thrown
                 placeholderIds.forEach(id => {
                    updateWorkbenchNode(id, { status: 'error', name: 'Failed' } as any);
                });
            }

        } catch (error) {
            console.error("Generation failed", error);
            // --- 4. Handle Errors ---
            placeholderIds.forEach(id => {
                updateWorkbenchNode(id, { status: 'error', name: 'Error' } as any);
            });
        } finally {
            setRendering(false);
        }
    };

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "relative w-[240px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors pointer-events-auto flex flex-col overflow-hidden",
                selected ? 'border-[#6366f1]' : 'border-[#333] hover:border-[#6366f1]',
                isHoverConnectable && 'border-[#6366f1]'
            )}
        >
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    zIndex: 0,
                }}
            />
            <div className="px-3 py-2 border-b border-[#333] bg-[#222] rounded-t-xl overflow-hidden">
                 <div className="flex items-center gap-2">
                    <Wand2 size={14} className="text-[#6366f1]" />
                    <h3 className="text-white font-medium text-sm">Render</h3>
                </div>
            </div>

            <div className="p-3 space-y-3">
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Prompt</label>
                        <span className="text-[9px] text-gray-600">{(settings.prompt || "").length}/2000</span>
                    </div>
                    <textarea
                        className="w-full h-16 bg-[#2a2a2a] border border-[#333] rounded-lg p-2 text-xs text-white resize-none focus:outline-none focus:border-[#6366f1] placeholder-gray-600 transition-colors nodrag nowheel"
                        placeholder="Describe your design..."
                        value={settings.prompt || ''}
                        onChange={(e) => updateSettings({ prompt: e.target.value })}
                        onKeyDown={(e) => e.stopPropagation()} 
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                         <label className="text-gray-400 text-[9px] font-bold uppercase tracking-wider mb-1 block">Style</label>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowStyles(!showStyles); }}
                            className="w-full flex items-center justify-between bg-[#2a2a2a] border border-[#333] px-2 py-1.5 rounded-lg hover:border-gray-500 transition-colors"
                        >
                            <span className="text-white text-[11px] truncate">{settings.stylePreset || 'Style'}</span>
                            <ChevronDown size={10} className="text-gray-500" />
                        </button>
                        {showStyles && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#2a2a2a] border border-[#333] rounded-lg shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar nowheel nodrag">
                                {availableStyles.map(style => (
                                    <button
                                        key={style.id}
                                        className={cn(
                                            "w-full px-2 py-1.5 text-left text-[11px] text-gray-300 hover:bg-[#333] hover:text-white transition-colors flex flex-col gap-0.5",
                                            settings.stylePreset === style.name && "text-[#6366f1] bg-[#333]"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateSettings({ stylePreset: style.name });
                                            setShowStyles(false);
                                        }}
                                    >
                                        <span className="font-medium">{style.name}</span>
                                        <span className="text-[10px] opacity-50">{style.description}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <label className="text-gray-400 text-[9px] font-bold uppercase tracking-wider mb-1 block">Count</label>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowNumImagesDropdown(!showNumImagesDropdown); }}
                            className="w-full flex items-center justify-between bg-[#2a2a2a] border border-[#333] px-2 py-1.5 rounded-lg hover:border-gray-500 transition-colors"
                        >
                            <span className="text-white text-[11px]">{settings.numImages || 1} Images</span>
                            <ChevronDown size={10} className="text-gray-500" />
                        </button>
                         {showNumImagesDropdown && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#2a2a2a] border border-[#333] rounded-lg shadow-xl z-50 overflow-hidden nowheel nodrag">
                                {[1, 2, 3, 4].map(n => (
                                    <button
                                        key={n}
                                        className={cn(
                                            "w-full px-2 py-1.5 text-left text-[11px] text-gray-300 hover:bg-[#333] hover:text-white transition-colors",
                                            settings.numImages === n && "text-[#6366f1] bg-[#333]"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateSettings({ numImages: n });
                                            setShowNumImagesDropdown(false);
                                        }}
                                    >
                                        {n} Image{n > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                     <div className="flex justify-between items-center mb-1">
                        <label className="text-gray-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Layers size={9} /> Influence
                        </label>
                        <span className="text-[#6366f1] text-[11px] font-mono">{Math.round((settings.drawingInfluence || 0) * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings.drawingInfluence || 0}
                        onChange={(e) => updateSettings({ drawingInfluence: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-[#6366f1] nodrag nowheel"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isRendering || !settings.prompt?.trim()}
                    className={cn(
                        "w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all relative overflow-hidden group text-sm",
                        isRendering
                            ? "bg-[#333] text-gray-500 cursor-not-allowed"
                            : "bg-[#6366f1] hover:bg-[#5558e6] text-white shadow-lg shadow-indigo-500/20"
                    )}
                >
                    {isRendering ? (
                         <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-500 border-t-gray-300" />
                            <span>Generating...</span>
                        </>
                    ) : (
                        <>
                            <Wand2 size={14} className="group-hover:rotate-12 transition-transform" />
                            <span>Generate</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
