import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/components/nodes/nodeUi';

interface FloatingArrowToolbarProps {
    color: string;
    strokeWidth: number;
    onChange: (data: Record<string, unknown>) => void;
    style?: React.CSSProperties;
}

const COLOR_SWATCHES = ['#111827', '#4b5563', '#9ca3af', '#f9fafb', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'] as const;
const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8] as const;
const chipButtonClass = 'flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-viz-surface';

export const FloatingArrowToolbar: React.FC<FloatingArrowToolbarProps> = ({ color, strokeWidth, onChange, style }) => {
    const [colorOpen, setColorOpen] = useState(false);
    const [widthOpen, setWidthOpen] = useState(false);
    const colorRef = useRef<HTMLDivElement>(null);
    const widthRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!colorOpen && !widthOpen) return;
        const close = (event: MouseEvent) => {
            const target = event.target as Node;
            if (colorRef.current && !colorRef.current.contains(target)) setColorOpen(false);
            if (widthRef.current && !widthRef.current.contains(target)) setWidthOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [colorOpen, widthOpen]);

    return (
        <div style={style} className="nodrag nopan pointer-events-auto absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-xl2 border border-viz-border bg-viz-panel px-1.5 py-1 shadow-viz" onPointerDown={(event) => event.stopPropagation()}>
            <div ref={colorRef} className="relative">
                <button type="button" title="Color" aria-label="Arrow color" onClick={() => { setColorOpen((open) => !open); setWidthOpen(false); }} className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-viz-border p-0.5 shadow-inner transition-transform hover:scale-105 active:scale-95" style={{ backgroundColor: color }} />
                {colorOpen && (
                    <div className="absolute bottom-full left-1/2 z-40 mb-2 w-max -translate-x-1/2 rounded-xl2 border border-viz-border bg-viz-panel p-2 shadow-viz">
                        <div className="grid grid-cols-6 gap-1.5">
                            {COLOR_SWATCHES.map((swatch) => (
                                <button key={swatch} type="button" title={swatch} aria-label={`Color ${swatch}`} onClick={() => { onChange({ strokeColor: swatch }); setColorOpen(false); }} className={cn('h-5 w-5 rounded-full border border-white/10 transition-transform hover:scale-110 active:scale-95', swatch.toLowerCase() === color.toLowerCase() && 'ring-2 ring-viz-accent ring-offset-1 ring-offset-viz-panel')} style={{ backgroundColor: swatch }} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div ref={widthRef} className="relative">
                <button type="button" title="Line thickness" aria-label="Line thickness" onClick={() => { setWidthOpen((open) => !open); setColorOpen(false); }} className={chipButtonClass}>
                    <span className="inline-block rounded-full bg-current" style={{ width: 18, height: Math.max(2, Math.min(8, strokeWidth)) }} />
                    {strokeWidth}px
                    <ChevronDown size={12} className="text-viz-muted" />
                </button>
                {widthOpen && (
                    <div className="absolute bottom-full left-1/2 z-40 mb-2 w-28 -translate-x-1/2 rounded-xl2 border border-viz-border bg-viz-panel p-1 shadow-viz">
                        {STROKE_WIDTHS.map((width) => (
                            <button key={width} type="button" onClick={() => { onChange({ strokeWidth: width }); setWidthOpen(false); }} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-viz-muted hover:bg-viz-surface hover:text-white', width === strokeWidth && 'bg-viz-surface text-white')}>
                                <span className="inline-block w-12 rounded-full bg-current" style={{ height: Math.max(1, Math.min(8, width)) }} />
                                {width}px
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
