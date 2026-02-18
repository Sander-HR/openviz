import React, { useRef, useState, useEffect } from 'react';
import {
    ChevronDown,
    Pipette,
    Maximize,
    Eye
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';
import { AspectRatio } from '../../types';
import { ColorPicker } from './ColorPicker';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ASPECT_RATIOS: { label: string, value: AspectRatio, w: number, h: number }[] = [
    { label: '16:9', value: '16:9', w: 1024, h: 576 },
    { label: '4:3', value: '4:3', w: 1024, h: 768 },
    { label: '1:1', value: '1:1', w: 1024, h: 1024 },
    { label: '9:16', value: '9:16', w: 576, h: 1024 },
    { label: '3:4', value: '3:4', w: 768, h: 1024 },
];

export const LayerPanelCanvasSettings: React.FC = () => {
    const {
        project,
        setBackgroundColor,
        setCanvasSize
    } = useStore();
    
    const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [hexInput, setHexInput] = useState(project.canvas.backgroundColor.replace('#', '').toUpperCase());
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Sync local input state when project color changes externally (e.g. undo/redo)
    useEffect(() => {
        setHexInput(project.canvas.backgroundColor.replace('#', '').toUpperCase());
    }, [project.canvas.backgroundColor]);

    // Close color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setShowColorPicker(false);
            }
        };

        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColorPicker]);

    const handleEyedropper = async () => {
        if ('EyeDropper' in window) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const eyeDropper = new (window as any).EyeDropper();
                const result = await eyeDropper.open();
                setBackgroundColor(result.sRGBHex);
            } catch (e) {
                console.log('Eyedropper cancelled', e);
            }
        }
    };

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow typing only hex characters
        if (/^[0-9A-Fa-f]*$/.test(val) && val.length <= 6) {
            setHexInput(val.toUpperCase());
            // Only update store if it's a valid hex color
            if (val.length === 6) {
                setBackgroundColor('#' + val.toLowerCase());
            } else if (val.length === 3) {
                // Expand shorthand hex
                const r = val[0];
                const g = val[1];
                const b = val[2];
                setBackgroundColor('#' + r + r + g + g + b + b);
            }
        }
    };

    return (
        <div className="mt-1 space-y-1 relative">
            <div
                onClick={() => setIsCanvasExpanded(!isCanvasExpanded)}
                className={cn(
                    "group flex items-center gap-2 p-1.5 rounded-lg cursor-pointer border border-transparent hover:bg-neutral-800/50 transition-all",
                    isCanvasExpanded && "bg-neutral-800/30"
                )}
            >
                <div className="text-text-secondary w-[14px] flex justify-center">
                    <Eye size={14} className="opacity-40" />
                </div>

                {/* Thumbnail */}
                <div className="w-10 h-10 rounded bg-white border border-panel-border shrink-0 shadow-inner" 
                     style={{ backgroundColor: project.canvas.backgroundColor }} 
                />

                <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium">Canvas</div>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-text-secondary uppercase">Settings</span>
                        <ChevronDown 
                            size={10} 
                            className={cn("text-text-secondary transition-transform", isCanvasExpanded && "rotate-180")} 
                        />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isCanvasExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-black/20 rounded-lg border border-panel-border/30 mx-0.5"
                    >
                        <div className="p-3 space-y-4">
                            {/* Size Selector */}
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-text-secondary text-[11px] font-medium shrink-0">Size</label>
                                <div className="flex-1 relative group">
                                    <div className="flex items-center gap-2 bg-neutral-900 px-2.5 py-1.5 rounded-md border border-panel-border/50 group-hover:border-primary/30 transition-colors">
                                        <Maximize size={12} className="text-text-secondary" />
                                        <select
                                            value={project.canvas.aspectRatio}
                                            onChange={(e) => {
                                                const ratio = ASPECT_RATIOS.find(r => r.value === e.target.value);
                                                if (ratio) setCanvasSize(ratio.w, ratio.h, ratio.value);
                                            }}
                                            className="bg-transparent text-white text-[11px] outline-none w-full appearance-none cursor-pointer pr-4 font-medium"
                                        >
                                            {ASPECT_RATIOS.map(ratio => (
                                                <option key={ratio.value} value={ratio.value} className="bg-neutral-900">
                                                    {ratio.label}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown size={10} className="text-text-secondary absolute right-2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="h-[1px] bg-panel-border/20" />

                            {/* Color Picker Row */}
                            <div className="flex items-center justify-between gap-3 relative">
                                <label className="text-text-secondary text-[11px] font-medium shrink-0">Color</label>
                                <div className="flex-1 flex items-center gap-2 bg-neutral-900 px-2 py-1.5 rounded-md border border-panel-border/50 focus-within:border-primary/30 transition-colors">
                                    <div 
                                        className="w-4 h-4 rounded-sm border border-white/10 shrink-0 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                        style={{ backgroundColor: project.canvas.backgroundColor }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowColorPicker(!showColorPicker);
                                        }}
                                    />
                                    <input
                                        className="bg-transparent text-white text-[11px] outline-none w-full font-mono font-medium tracking-tighter uppercase"
                                        value={hexInput}
                                        onChange={handleHexChange}
                                        maxLength={6}
                                    />
                                    <button 
                                        onClick={handleEyedropper}
                                        className="p-1 hover:bg-white/5 rounded transition-colors text-text-secondary hover:text-white"
                                        title="Pick color from screen"
                                    >
                                        <Pipette size={12} />
                                    </button>
                                </div>

                                {/* Color Picker Popover */}
                                {showColorPicker && (
                                    <div 
                                        ref={colorPickerRef}
                                        className="absolute right-0 top-full mt-2 z-50"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ColorPicker 
                                            color={project.canvas.backgroundColor} 
                                            onChange={setBackgroundColor} 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
