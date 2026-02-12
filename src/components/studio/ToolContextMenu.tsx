import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { ToolType } from '../../types';
import { Paintbrush, PaintBucket } from 'lucide-react';
import { ColorPicker } from './ColorPicker';

interface ToolContextMenuProps {
    x: number;
    y: number;
    tool: ToolType;
    onClose: () => void;
}

export const ToolContextMenu: React.FC<ToolContextMenuProps> = ({ x, y, tool, onClose }) => {
    const { toolSettings, setBrushSize, setBrushColor, setBrushOpacity, setBrushStabilizer, setBrushHardness, setEraserSize } = useStore();
    const [isVisible, setIsVisible] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    useEffect(() => {
        setIsVisible(true);
        const handleGlobalClick = () => onClose();
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [onClose]);

    if (tool !== 'brush' && tool !== 'eraser') return null;

    const size = tool === 'brush' ? toolSettings.brushSize : toolSettings.eraserSize;
    const color = tool === 'brush' ? toolSettings.brushColor : '#ffffff'; // Eraser usually visualizes as white or checkboard
    const opacity = tool === 'brush' ? toolSettings.brushOpacity / 100 : 1;
    const hardness = tool === 'brush' ? toolSettings.brushHardness : 100;

    return (
        <div
            className={`fixed z-50 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 w-[420px] backdrop-blur-3xl transition-all duration-200 origin-top-left text-white ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            style={{ left: Math.min(x, window.innerWidth - 440), top: Math.min(y, window.innerHeight - 300) }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header / Tool Selector style */}
            <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${tool === 'brush' ? 'bg-white/10' : 'opacity-50'}`}>
                    <Paintbrush size={14} />
                    <span className="text-sm font-medium">Brush</span>
                    <span className="ml-2 text-[10px] opacity-50 font-mono">B</span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg opacity-40`}>
                    <PaintBucket size={14} />
                    <span className="text-sm font-medium">Paint Bucket</span>
                </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-4">
                Brush settings
            </h4>

            <div className="flex gap-6">
                {/* Left Column: Sliders */}
                <div className="flex-1 space-y-5">
                    {/* Color Picker (Brush Only) */}
                    {tool === 'brush' && (
                        <div className="space-y-2 relative">
                            <div className="flex justify-between text-xs">
                                <span className="opacity-80">Color</span>
                                <span className="font-mono opacity-60 uppercase">{color}</span>
                            </div>
                            <button
                                className="w-full h-8 rounded-lg border border-white/10 shadow-sm flex items-center justify-center relative overflow-hidden transition-transform active:scale-95"
                                style={{ backgroundColor: color }}
                                onClick={() => setShowColorPicker(!showColorPicker)}
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                            </button>

                            {showColorPicker && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[60] cursor-default"
                                        onClick={(e) => { e.stopPropagation(); setShowColorPicker(false); }}
                                    />
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-[70] animate-in fade-in zoom-in duration-150">
                                        {/* Arrow */}
                                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#121212] border-t border-l border-white/10 rotate-45" />
                                        <ColorPicker color={color} onChange={setBrushColor} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Size */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="opacity-80">Size</span>
                            <span className="font-mono opacity-60">{size}px</span>
                        </div>
                        <input
                            type="range" min="1" max="100"
                            value={size}
                            onChange={(e) => tool === 'brush' ? setBrushSize(parseInt(e.target.value)) : setEraserSize(parseInt(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#5e6eff]"
                        />
                    </div>

                    {tool === 'brush' && (
                        <>
                            {/* Opacity */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="opacity-80">Opacity</span>
                                    <span className="font-mono opacity-60">{Math.round(opacity * 100)}%</span>
                                </div>
                                <input
                                    type="range" min="1" max="100"
                                    value={opacity * 100}
                                    onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#5e6eff]"
                                />
                            </div>

                            {/* Stabilizer */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="opacity-80">Stabilizer</span>
                                    <span className="font-mono opacity-60">{toolSettings.brushStabilizer}x</span>
                                </div>
                                <input
                                    type="range" min="0" max="100"
                                    value={toolSettings.brushStabilizer}
                                    onChange={(e) => setBrushStabilizer(parseInt(e.target.value))}
                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#5e6eff]"
                                />
                            </div>

                            {/* Hardness */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="opacity-80">Hardness</span>
                                    <span className="font-mono opacity-60">{toolSettings.brushHardness}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100"
                                    value={toolSettings.brushHardness}
                                    onChange={(e) => setBrushHardness(parseInt(e.target.value))}
                                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#5e6eff]"
                                />
                            </div>

                            {/* Pressure Checkbox */}
                            <div className="flex items-center justify-between pt-2">
                                <span className="text-xs opacity-80">Use pressure for size</span>
                                <input type="checkbox" className="accent-[#5e6eff] w-3 h-3 rounded" />
                            </div>
                        </>
                    )}
                </div>

                {/* Right Column: Preview */}
                <div className="w-32">
                    <div className="w-32 h-32 bg-[#121212] border border-white/10 rounded-lg flex items-center justify-center overflow-hidden relative">
                        {/* Grid Pattern Background */}
                        <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '8px 8px' }}>
                        </div>

                        {/* Brush Preview based on User Markup */}
                        <div
                            style={{
                                width: `${Math.min(size, 80)}px`,
                                height: `${Math.min(size, 80)}px`,
                                background: `radial-gradient(circle closest-side, ${color} ${hardness}%, transparent 100%)`,
                                opacity: opacity,
                                borderRadius: '50%',
                            }}
                        />

                        {/* Crosshair Graphic (Static decoration) */}
                        <div className="absolute inset-0 border border-white/5 rounded-full border-dashed" style={{ margin: '15%' }}></div>
                        <div className="absolute w-full h-[1px] bg-white/5"></div>
                        <div className="absolute h-full w-[1px] bg-white/5"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
