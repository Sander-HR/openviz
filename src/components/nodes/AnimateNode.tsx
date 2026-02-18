import React, { useState } from 'react';
import { useConnection, Handle, Position } from '@xyflow/react';
import { Settings2, Video, ChevronDown, Play, Image as ImageIcon, Plus, X } from 'lucide-react';
import { AnimateNode as AnimateNodeType, VideoNode as VideoNodeType, Project } from '../../types';
import { useStore } from '../../store/useStore';
import { renderService } from '../../services/renderService';
import { getVideoStyles } from '../../services/ai/workflowRegistry';
import { findNonOverlappingPosition } from '../../services/nodePositioning';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface AnimateNodeProps {
    id: string;
    data: AnimateNodeType;
    selected: boolean;
}

export const AnimateNode: React.FC<AnimateNodeProps> = ({ id, data, selected }) => {
    const connection = useConnection();
    const { setActiveNodeId, updateWorkbenchNode, workbenchNodes, connections, removeConnection, addWorkbenchNode, addConnection } = useStore();
    const [isAnimating, setAnimating] = useState(false);
    const [showStyles, setShowStyles] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const isHoverConnectable = connection.inProgress && connection.fromNode?.type === 'imageNode' && isHovered;

    const videoStyles = getVideoStyles();
    const settings = data.data.settings || { model: 'standard', duration: '5s' };
    const prompt = data.data.prompt || "";

    const handleNodeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveNodeId(id);
    };

    const updateData = (updates: any) => {
        updateWorkbenchNode(id, {
            data: { ...data.data, ...updates }
        } as any);
    };

    const updateSettings = (updates: any) => {
        updateData({
            settings: { ...settings, ...updates }
        });
    };

    const inboundConnections = connections.filter(c => c.to === id);
    const sourceNodeId1 = inboundConnections[0]?.from;
    const sourceNodeId2 = inboundConnections[1]?.from;

    const sourceNode1 = workbenchNodes.find(n => n.id === sourceNodeId1);
    const sourceNode2 = workbenchNodes.find(n => n.id === sourceNodeId2);

    const handleDisconnect = (index: number) => {
        const connection = inboundConnections[index];
        if (connection) {
            removeConnection(connection.id);
        }
    };

    const handleSwapFrames = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (inboundConnections.length === 2) {
            const conn1 = inboundConnections[0];
            const conn2 = inboundConnections[1];
            // Remove both connections
            removeConnection(conn1.id);
            removeConnection(conn2.id);
            // Re-add with swapped sources
            addConnection(conn2.from, id);
            addConnection(conn1.from, id);
        }
    };

    // Auto-position once when connected to a source node - DISABLED
    // Track the last source node ID to only auto-position on initial connection
    // const lastSourceId = React.useRef<string | null>(null);
    // useEffect(() => {
    //     if (sourceNodeId1 && sourceNodeId1 !== lastSourceId.current) {
    //         lastSourceId.current = sourceNodeId1;
    //         const sourceNode = workbenchNodes.find(n => n.id === sourceNodeId1);
    //         if (sourceNode) {
    //             const targetX = sourceNode.x + (sourceNode.width || 0) + 100;
    //             const targetY = sourceNode.y + ((sourceNode.height || 0) / 2) - ((data.height || 0) / 2);
    //             updateWorkbenchNode(id, { x: targetX, y: targetY });
    //         }
    //     }
    // }, [sourceNodeId1, workbenchNodes, id, data.height, updateWorkbenchNode]);

    const handleAnimate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setAnimating(true);

        const placeholderId = crypto.randomUUID();

        try {
            // 1. Get Input Images
            let initImage = "";
            let endImage = "";
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
                console.error("No input image for animation");
                setAnimating(false);
                return;
            }

            // 2. Create Placeholder Output Node
            const startX = data.x + (data.width || 320) + 100;
            
            // Calculate aspect ratio and dimensions
            const aspectRatio = width / height;
            
            // Try to inherit dimensions from source node for visual consistency
            let nodeWidth = 512;
            let nodeHeight = 512 / aspectRatio;
            
            if (sourceNode1) {
                nodeWidth = sourceNode1.width || 512;
                nodeHeight = sourceNode1.height || (512 / aspectRatio);
            }

            const startY = data.y + ((data.height || 0) / 2) - (nodeHeight / 2);

            // Find a non-overlapping position using the positioning service
            const { x: currentX, y: currentY } = findNonOverlappingPosition({
                startX,
                startY,
                nodeWidth,
                nodeHeight,
                existingNodes: workbenchNodes,
                columns: 4,
                gap: 50,
                margin: 50
            });

            const placeholderNode: VideoNodeType = {
                id: placeholderId,
                type: 'video',
                name: `Animating...`,
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
                        width: width,
                        height: height,
                        aspectRatio: aspectRatio === 1 ? 'square' : aspectRatio > 1 ? 'landscape' : 'portrait',
                        zoomLevel: 1,
                        panX: 0,
                        panY: 0,
                        backgroundColor: '#ffffff'
                    },
                    layers: []
                }
            };

            addWorkbenchNode(placeholderNode);
            addConnection(id, placeholderId);

            // 3. Call Service
            const response = await renderService.animate({
                workflowId: endImage ? 'animate_from_to' : (settings.workflowId || 'video_standard'),
                init_image: initImage,
                end_image: endImage,
                prompt: prompt,
                width: width,
                height: height
            });

            // 4. Update Result
            if (response.success && response.images.length > 0) {
                const videoUrl = response.images[0];
                
                // Update the placeholder node to show result
                // Note: ImageNode currently expects 'thumbnail' to be an image URL. 
                // If it's a video, the ImageNode component needs to handle video URLs or we need a VideoNode.
                // For now, we put the URL in 'thumbnail' and hope ImageNode or Project handling can deal with it 
                // or we just display the thumbnail if it's a gif.
                
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
                        backgroundColor: '#000000'
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
                            modified: Date.now()
                        }
                    ]
                };

                updateWorkbenchNode(placeholderId, {
                    project: project,
                    status: 'done',
                    name: 'Animation Ready',
                    renderResults: [] // Initialize empty renderResults
                } as any);

                // Also update local data
                updateData({
                    frames: {
                        ...data.data.frames,
                        end: videoUrl
                    }
                });

            } else {
                updateWorkbenchNode(placeholderId, { status: 'error', name: 'Failed' } as any);
            }

        } catch (error) {
            console.error("Animation failed", error);
            updateWorkbenchNode(placeholderId, { status: 'error', name: 'Error' } as any);
        } finally {
            setAnimating(false);
        }
    };

    return (
        <div
            onClick={handleNodeClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "relative w-[320px] bg-[#1a1a1a] rounded-2xl shadow-2xl border-2 transition-colors pointer-events-auto flex flex-col overflow-hidden",
                selected ? 'border-[#6366f1]' : 'border-[#333] hover:border-[#6366f1]',
                isHoverConnectable && 'border-[#6366f1]'
            )}
        >
            {/* Invisible target handle covering the whole node for better snap detection */}
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
                    zIndex: 10000,
                }}
            />
             {/* Header */}
             <div className="p-4 border-b border-[#333] bg-[#222]">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Video size={16} className="text-[#6366f1]" />
                        <h3 className="text-white font-medium text-lg">Animate</h3>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Frames Section */}
                <div className="space-y-2 pointer-events-auto">
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Frames</div>
                    <div className="flex items-center gap-2">
                        {sourceNode1 && (sourceNode1.type === 'image' || sourceNode1.type === 'video') ? (
                            <div className="flex items-center gap-2 bg-[#2a2a2a] pl-1 pr-2 py-1 rounded-lg border border-[#333] group transition-colors hover:border-gray-600">
                                {sourceNode1.project?.thumbnail ? (
                                    <img src={sourceNode1.project.thumbnail} className="w-8 h-8 rounded object-cover bg-white" alt="Start" />
                                ) : (
                                    <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center">
                                        <ImageIcon size={14} className="text-gray-500" />
                                    </div>
                                )}
                                <span className="text-white text-xs font-medium">Start</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDisconnect(0); }}
                                    className="p-1 hover:bg-[#333] rounded-md transition-colors"
                                >
                                    <X size={12} className="text-gray-500 hover:text-white" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center gap-2 bg-[#2a2a2a]/50 px-3 py-2 rounded-lg border border-dashed border-[#333] opacity-60">
                                <ImageIcon size={14} className="text-gray-500" />
                                <span className="text-gray-500 text-xs">Drop Start</span>
                            </div>
                        )}

                        <button
                            onClick={handleSwapFrames}
                            disabled={inboundConnections.length !== 2}
                            className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                inboundConnections.length === 2
                                    ? "text-gray-400 hover:text-white hover:bg-[#333] cursor-pointer"
                                    : "text-gray-700 cursor-not-allowed"
                            )}
                            title={inboundConnections.length === 2 ? "Swap frames" : "Connect two frames to swap"}
                        >
                            ⇄
                        </button>

                        {sourceNode2 && (sourceNode2.type === 'image' || sourceNode2.type === 'video') ? (
                            <div className="flex items-center gap-2 bg-[#2a2a2a] pl-1 pr-2 py-1 rounded-lg border border-[#333] group transition-colors hover:border-gray-600">
                                {sourceNode2.project?.thumbnail ? (
                                    <img src={sourceNode2.project.thumbnail} className="w-8 h-8 rounded object-cover bg-white" alt="End" />
                                ) : (
                                    <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center">
                                        <ImageIcon size={14} className="text-gray-500" />
                                    </div>
                                )}
                                <span className="text-white text-xs font-medium">End</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDisconnect(1); }}
                                    className="p-1 hover:bg-[#333] rounded-md transition-colors"
                                >
                                    <X size={12} className="text-gray-500 hover:text-white" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center gap-2 bg-[#2a2a2a]/50 px-3 py-2 rounded-lg border border-dashed border-[#333] opacity-60">
                                <Plus size={14} className="text-gray-500" />
                                <span className="text-gray-500 text-xs">Add End</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Settings</div>
                    <div className="flex gap-2">
                        {/* Workflow/Style Selector */}
                        <div className="relative flex-1">
                             <button 
                                onClick={(e) => { e.stopPropagation(); setShowStyles(!showStyles); }}
                                className="w-full bg-[#2a2a2a] text-white text-xs py-2 px-3 rounded-lg border border-[#333] flex items-center justify-between hover:border-gray-600 transition-colors"
                            >
                                <span className="truncate">{settings.workflowId ? videoStyles.find(s => s.id === settings.workflowId)?.name : 'Standard Video'}</span>
                                <Settings2 size={12} className="text-gray-500" />
                            </button>
                            {showStyles && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-[#333] rounded-lg shadow-xl z-50 overflow-hidden nowheel nodrag">
                                    {videoStyles.map(style => (
                                        <button
                                            key={style.id}
                                            className={cn(
                                                "w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#333] hover:text-white transition-colors",
                                                settings.workflowId === style.id && "text-[#6366f1] bg-[#333]"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateSettings({ workflowId: style.id });
                                                setShowStyles(false);
                                            }}
                                        >
                                            {style.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <button className="w-24 bg-[#2a2a2a] text-white text-xs py-2 px-3 rounded-lg border border-[#333] flex items-center justify-between hover:border-gray-600 transition-colors">
                            {settings.duration || '5s'}
                            <ChevronDown size={12} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
                            Prompt <span className="text-[10px] text-gray-600 font-normal">(optional)</span>
                        </span>
                        <button className="text-[10px] text-[#6366f1] hover:underline">Describe</button>
                    </div>
                    <div className="relative">
                        <textarea
                            className="w-full bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-white text-sm min-h-[100px] resize-none focus:outline-none focus:border-[#6366f1] placeholder-gray-600 nowheel nodrag"
                            placeholder="Tell us how things should move..."
                            value={prompt}
                            onChange={(e) => updateData({ prompt: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>

                <button 
                    onClick={handleAnimate}
                    disabled={isAnimating}
                    className={cn(
                        "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all relative overflow-hidden group",
                        isAnimating 
                            ? "bg-[#333] text-gray-500 cursor-not-allowed"
                            : "bg-[#6366f1] hover:bg-[#5558e6] text-white shadow-lg shadow-indigo-500/20"
                    )}
                >
                    {isAnimating ? (
                         <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-gray-300" />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <Play size={16} className="fill-current" />
                            <span>Animate</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
