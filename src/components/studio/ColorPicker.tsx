import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pipette, ChevronDown, Plus } from 'lucide-react';
import { hsvToHex, hexToHsv } from '../../utils/colorUtils';

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
    const [hsv, setHsv] = useState({ h: 0, s: 0, v: 0 });
    const [isDragging, setIsDragging] = useState<'sv' | 'hue' | null>(null);
    const svRef = useRef<HTMLDivElement>(null);
    const hueRef = useRef<HTMLDivElement>(null);

    // Sync from props only if not dragging
    useEffect(() => {
        if (!isDragging) {
            setHsv(hexToHsv(color));
        }
    }, [color, isDragging]);

    const handleSvChange = useCallback((e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
        if (!svRef.current) return;

        const rect = svRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        let x = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
        let y = Math.max(0, Math.min((clientY - rect.top) / rect.height, 1));

        const ns = x * 100;
        const nv = (1 - y) * 100;

        const newHsv = { ...hsv, s: ns, v: nv };
        setHsv(newHsv);
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    }, [hsv, onChange]);

    const handleHueChange = useCallback((e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
        if (!hueRef.current) return;

        const rect = hueRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;

        let x = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));

        const nh = x * 360;
        const newHsv = { ...hsv, h: nh };
        setHsv(newHsv);
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    }, [hsv, onChange]);

    useEffect(() => {
        const handleUp = () => setIsDragging(null);
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (isDragging === 'sv') handleSvChange(e);
            if (isDragging === 'hue') handleHueChange(e);
        };

        if (isDragging) {
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('touchend', handleUp);
            window.addEventListener('touchmove', handleMove);
        }

        return () => {
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchend', handleUp);
            window.removeEventListener('touchmove', handleMove);
        };
    }, [isDragging, handleSvChange, handleHueChange]);

    const handleEyeDropper = async () => {
        if ('EyeDropper' in window) {
            try {
                const eyeDropper = new (window as any).EyeDropper();
                const result = await eyeDropper.open();
                onChange(result.sRGBHex);
            } catch (e) {
                console.log('Eyedropper cancelled', e);
            }
        }
    };

    const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

    return (
        <div className="w-[220px] bg-panel rounded-panel shadow-2xl p-3 select-none flex flex-col gap-3 text-white border border-panel-border" onClick={e => e.stopPropagation()}>
            {/* SV Box */}
            <div
                ref={svRef}
                className="w-full h-32 rounded-lg relative overflow-hidden cursor-crosshair border border-white/5 shadow-inner"
                style={{ backgroundColor: hueColor }}
                onMouseDown={(e) => { setIsDragging('sv'); handleSvChange(e); }}
                onTouchStart={(e) => { setIsDragging('sv'); handleSvChange(e); }}
            >
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />

                {/* Thumb - White/Black Ring */}
                <div
                    className="absolute w-4 h-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                        left: `${hsv.s}%`,
                        top: `${100 - hsv.v}%`,
                    }}
                />
            </div>

            {/* Hue row */}
            <div className="flex items-center gap-2">
                <div
                    ref={hueRef}
                    className="flex-1 h-2 rounded-full relative cursor-pointer"
                    style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
                    onMouseDown={(e) => { setIsDragging('hue'); handleHueChange(e); }}
                    onTouchStart={(e) => { setIsDragging('hue'); handleHueChange(e); }}
                >
                    <div
                        className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -top-1 pointer-events-none"
                        style={{
                            left: `${(hsv.h / 360) * 100}%`,
                            backgroundColor: hueColor
                        }}
                    />
                </div>
                <button
                    onClick={handleEyeDropper}
                    className="w-10 h-8 flex items-center justify-center rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors border border-white/5 text-white/70"
                >
                    <Pipette size={14} />
                </button>
            </div>

            {/* Input row */}
            <div className="flex gap-1.5">
                <div className="flex-1 bg-black/20 rounded-lg h-8 flex items-center px-3 border border-panel-border transition-colors focus-within:border-primary/50">
                    <input
                        type="text"
                        value={color.replace('#', '').toUpperCase()}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (/^[0-9A-Fa-f]{0,6}$/.test(val)) {
                                if (val.length === 6) onChange('#' + val.toLowerCase());
                            }
                        }}
                        className="bg-transparent text-xs font-bold outline-none w-full tracking-wider"
                        maxLength={6}
                    />
                </div>
                <div className="flex items-center gap-1.5 bg-black/20 px-3 rounded-lg border border-panel-border cursor-pointer hover:bg-black/30 transition-colors">
                    <span className="text-xs font-medium opacity-90">Hex</span>
                    <ChevronDown size={12} className="opacity-40" />
                </div>
            </div>

            <div className="h-[1px] bg-panel-border/50 my-0.5" />

            {/* Swatches Section */}
            <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 flex items-center justify-between bg-black/20 px-3 py-2 rounded-lg border border-panel-border cursor-pointer hover:bg-black/30 transition-colors">
                        <span className="text-xs font-bold opacity-90">This File</span>
                        <ChevronDown size={12} className="opacity-40" />
                    </div>
                    <button className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group">
                        <Plus size={16} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>

                <div className="bg-black/10 border border-dashed border-panel-border rounded-lg p-4 flex flex-col items-center justify-center gap-1 group cursor-pointer hover:bg-black/20 transition-all text-center">
                    <span className="text-xs font-bold opacity-90 group-hover:opacity-100">Create Colors</span>
                    <span className="text-[9px] opacity-40 font-medium tracking-tight">Add your favorite colors</span>
                </div>
            </div>

            {/* Design accents */}
            <div className="absolute right-3.5 bottom-12 flex flex-col gap-6 opacity-5 pointer-events-none">
                <ChevronDown className="rotate-180" size={10} />
                <ChevronDown size={10} />
            </div>
        </div>
    );
};
