import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, Image as ImageIcon, Play, Plus, Settings2, Video, X } from 'lucide-react';
import { AnimateNode as AnimateNodeType, ImageNode, VideoNode, WorkbenchNode } from '../../types';
import { useAnimateNodeActions } from './hooks/useAnimateNodeActions';
import { cn, elevatedFullNodeTargetHandleStyle, getNodeContainerClass, imageLikeHandleStyle } from './nodeUi';

interface AnimateNodeProps {
    id: string;
    data: AnimateNodeType;
    selected: boolean;
}

function isFrameNode(node: WorkbenchNode | undefined): node is ImageNode | VideoNode {
    return Boolean(node && (node.type === 'image' || node.type === 'video'));
}

export const AnimateNode: React.FC<AnimateNodeProps> = ({ id, data, selected }) => {
    const {
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
    } = useAnimateNodeActions(id, data);

    const selectedStyle = videoStyles.find(style => style.id === settings.workflowId)?.name || 'Standard Video';

    return (
        <div
            onClick={handleNodeClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={getNodeContainerClass(selected, isHoverConnectable)}
        >
            <Handle
                type="target"
                position={Position.Left}
                id="animate-target-visible"
                style={{
                    ...imageLikeHandleStyle,
                    left: '13px',
                    top: '50%',
                    zIndex: 11000,
                    opacity: selected ? 1 : 0,
                    pointerEvents: selected ? 'auto' : 'none',
                }}
            >
                <Plus size={16} color="white" strokeWidth={3} className="pointer-events-none" />
            </Handle>
            <Handle type="target" position={Position.Left} style={elevatedFullNodeTargetHandleStyle} />

            <div className="border-[#333] bg-[#222] p-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Video size={16} className="text-[#6366f1]" />
                        <h3 className="text-white font-medium text-lg">Animate</h3>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4">
                <div className="space-y-2 pointer-events-auto">
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Frames</div>
                    <div className="flex items-center gap-2">
                        {isFrameNode(sourceNode1) ? (
                            <div className="flex items-center gap-2 bg-[#2a2a2a] pl-1 pr-2 py-1 rounded-lg border border-[#333] group transition-colors hover:border-gray-600">
                                {sourceNode1.project?.thumbnail ? (
                                    <img
                                        src={sourceNode1.project.thumbnail}
                                        className="w-8 h-8 rounded object-cover bg-white"
                                        alt="Start"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center">
                                        <ImageIcon size={14} className="text-gray-500" />
                                    </div>
                                )}
                                <span className="text-white text-xs font-medium">Start</span>
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleDisconnect(0);
                                    }}
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
                                'p-1.5 rounded-lg transition-colors',
                                inboundConnections.length === 2
                                    ? 'text-gray-400 hover:text-white hover:bg-[#333] cursor-pointer'
                                    : 'text-gray-700 cursor-not-allowed'
                            )}
                            title={inboundConnections.length === 2 ? 'Swap frames' : 'Connect two frames to swap'}
                        >
                            ⇄
                        </button>

                        {isFrameNode(sourceNode2) ? (
                            <div className="flex items-center gap-2 bg-[#2a2a2a] pl-1 pr-2 py-1 rounded-lg border border-[#333] group transition-colors hover:border-gray-600">
                                {sourceNode2.project?.thumbnail ? (
                                    <img
                                        src={sourceNode2.project.thumbnail}
                                        className="w-8 h-8 rounded object-cover bg-white"
                                        alt="End"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center">
                                        <ImageIcon size={14} className="text-gray-500" />
                                    </div>
                                )}
                                <span className="text-white text-xs font-medium">End</span>
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleDisconnect(1);
                                    }}
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
                        <div className="relative flex-1">
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    setShowStyles(!showStyles);
                                }}
                                className="w-full bg-[#2a2a2a] text-white text-xs py-2 px-3 rounded-lg border border-[#333] flex items-center justify-between hover:border-gray-600 transition-colors"
                            >
                                <span className="truncate">{selectedStyle}</span>
                                <Settings2 size={12} className="text-gray-500" />
                            </button>
                            {showStyles && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-[#333] rounded-lg shadow-xl z-50 overflow-hidden nowheel nodrag">
                                    {videoStyles.map(style => (
                                        <button
                                            key={style.id}
                                            className={cn(
                                                'w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#333] hover:text-white transition-colors',
                                                settings.workflowId === style.id && 'text-[#6366f1] bg-[#333]'
                                            )}
                                            onClick={e => {
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
                    <textarea
                        className="w-full bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-white text-sm min-h-[100px] resize-none focus:outline-none focus:border-[#6366f1] placeholder-gray-600 nowheel nodrag"
                        placeholder="Tell us how things should move..."
                        value={prompt}
                        onChange={e => updateData({ prompt: e.target.value })}
                        onClick={e => e.stopPropagation()}
                    />
                </div>

                <button
                    onClick={handleAnimate}
                    disabled={isAnimating}
                    className={cn(
                        'w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all relative overflow-hidden group',
                        isAnimating
                            ? 'bg-[#333] text-gray-500 cursor-not-allowed'
                            : 'bg-[#6366f1] hover:bg-[#5558e6] text-white shadow-lg shadow-indigo-500/20'
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
