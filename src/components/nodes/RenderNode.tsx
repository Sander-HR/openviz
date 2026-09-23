import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, Layers, Plus, Wand2 } from 'lucide-react';
import { RenderNode as RenderNodeType } from '../../types';
import { useRenderNodeGeneration } from './hooks/useRenderNodeGeneration';
import { cn, elevatedFullNodeTargetHandleStyle, getNodeContainerClass, imageLikeHandleStyle } from './nodeUi';

interface RenderNodeProps {
    id: string;
    data: RenderNodeType;
    selected: boolean;
}

export const RenderNode: React.FC<RenderNodeProps> = ({ id, data, selected }) => {
    const {
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
    } = useRenderNodeGeneration(id, data);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={getNodeContainerClass(selected, isHoverConnectable)}
        >
            <Handle
                type="target"
                position={Position.Left}
                id="render-target-visible"
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
                        <Wand2 size={16} className="text-[#6366f1]" />
                        <h3 className="text-white font-medium text-lg">Render</h3>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-gray-400 text-xs font-bold uppercase tracking-wider">Prompt</label>
                        <span className="text-[10px] text-gray-600">{(settings.prompt || '').length}/2000</span>
                    </div>
                    <textarea
                        className="w-full h-24 bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-sm text-white resize-none focus:outline-none focus:border-[#6366f1] placeholder-gray-600 transition-colors nodrag nowheel"
                        placeholder="Describe your design..."
                        value={settings.prompt || ''}
                        onChange={e => updateSettings({ prompt: e.target.value })}
                        onKeyDown={e => e.stopPropagation()}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 block">Style</label>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                setShowStyles(!showStyles);
                            }}
                            className="w-full flex items-center justify-between bg-[#2a2a2a] border border-[#333] px-3 py-2 rounded-lg hover:border-gray-500 transition-colors"
                        >
                            <span className="text-white text-xs truncate">{settings.stylePreset || 'Style'}</span>
                            <ChevronDown size={12} className="text-gray-500" />
                        </button>

                        {showStyles && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#2a2a2a] border border-[#333] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto overflow-hidden custom-scrollbar nowheel nodrag">
                                {availableStyles.map(style => (
                                    <button
                                        key={style.id}
                                        className={cn(
                                            'w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#333] hover:text-white transition-colors flex flex-col gap-0.5',
                                            settings.stylePreset === style.name && 'text-[#6366f1] bg-[#333]'
                                        )}
                                        onClick={e => {
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
                        <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1 block">Count</label>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                setShowNumImagesDropdown(!showNumImagesDropdown);
                            }}
                            className="w-full flex items-center justify-between bg-[#2a2a2a] border border-[#333] px-3 py-2 rounded-lg hover:border-gray-500 transition-colors"
                        >
                            <span className="text-white text-xs">{settings.numImages || 1} Images</span>
                            <ChevronDown size={12} className="text-gray-500" />
                        </button>

                        {showNumImagesDropdown && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#2a2a2a] border border-[#333] rounded-lg shadow-xl z-50 overflow-hidden nowheel nodrag">
                                {[1, 2, 3, 4].map(num => (
                                    <button
                                        key={num}
                                        className={cn(
                                            'w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#333] hover:text-white transition-colors',
                                            settings.numImages === num && 'text-[#6366f1] bg-[#333]'
                                        )}
                                        onClick={e => {
                                            e.stopPropagation();
                                            updateSettings({ numImages: num });
                                            setShowNumImagesDropdown(false);
                                        }}
                                    >
                                        {num} Image{num > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Layers size={10} /> Influence
                        </label>
                        <span className="text-[#6366f1] text-xs font-mono">
                            {Math.round((settings.drawingInfluence || 0) * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings.drawingInfluence || 0}
                        onChange={e => updateSettings({ drawingInfluence: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-[#6366f1] nodrag nowheel"
                        onClick={e => e.stopPropagation()}
                    />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isRendering || !settings.prompt?.trim()}
                    className={cn(
                        'w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all relative overflow-hidden group mt-2',
                        isRendering
                            ? 'bg-[#333] text-gray-500 cursor-not-allowed'
                            : 'bg-[#6366f1] hover:bg-[#5558e6] text-white shadow-lg shadow-indigo-500/20'
                    )}
                >
                    {isRendering ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-gray-300" />
                            <span>Generating...</span>
                        </>
                    ) : (
                        <>
                            <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
                            <span>Generate</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
