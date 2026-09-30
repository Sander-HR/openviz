import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, Eye, ImagePlus, Pipette, RotateCcw, Sparkles, Undo2, WandSparkles } from 'lucide-react';
import { StudioPanelFrame } from './StudioPanelFrame';
import { useStore } from '../../store/useStore';
import { colorAdjustments, initialAdjustments, lightAdjustments, type AdjustmentName } from '../../types/adjustments';

interface AdjustPanelProps {
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    onEnhance?: () => void;
    onRemoveBackground?: () => void;
    onUnify?: () => void;
    onRasterize?: () => boolean | void;
}

const sliderConfig: Record<AdjustmentName, { min: number; max: number; step: number; tone: string; decimals?: number }> = {
    Exposure: { min: -5, max: 5, step: 0.01, tone: 'light', decimals: 2 },
    Contrast: { min: -100, max: 100, step: 1, tone: 'light' },
    Highlights: { min: -100, max: 100, step: 1, tone: 'light' },
    Shadows: { min: -100, max: 100, step: 1, tone: 'light' },
    Temp: { min: -100, max: 100, step: 1, tone: 'temperature' },
    Tint: { min: -100, max: 100, step: 1, tone: 'tint' },
    Hue: { min: -180, max: 180, step: 1, tone: 'hue' },
    Vibrance: { min: -100, max: 100, step: 1, tone: 'vibrance' },
    Saturation: { min: -100, max: 100, step: 1, tone: 'saturation' },
    Lightness: { min: -100, max: 100, step: 1, tone: 'lightness' },
};

export const AdjustPanel: React.FC<AdjustPanelProps> = ({ collapsed, onCollapsedChange, onEnhance, onRemoveBackground, onUnify, onRasterize }) => {
    const { project, activeLayerId, updateLayer } = useStore();
    const [lightOpen, setLightOpen] = useState(true);
    const [colorOpen, setColorOpen] = useState(true);
    const [status, setStatus] = useState('');
    const activeLayer = project.layers.find((layer) => layer.id === activeLayerId);
    const values = activeLayer?.adjustments ?? initialAdjustments;
    const [localValues, setLocalValues] = useState(values);
    const pendingValuesRef = useRef(values);
    const frameRef = useRef<number | null>(null);
    const preview = activeLayer?.adjustmentsEnabled === false;

    useEffect(() => {
        setLocalValues(values);
        pendingValuesRef.current = values;
    }, [activeLayerId, values]);

    useEffect(() => () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    }, []);

    const updateValue = (name: AdjustmentName, value: number) => {
        if (!activeLayerId) return;
        const nextValues = { ...pendingValuesRef.current, [name]: value };
        pendingValuesRef.current = nextValues;
        setLocalValues(nextValues);
        if (frameRef.current === null) {
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = null;
                updateLayer(activeLayerId, { adjustments: pendingValuesRef.current, adjustmentsEnabled: true });
            });
        }
        setStatus('');
    };

    const runAction = (label: string, action?: () => void) => {
        action?.();
        setStatus(action ? `${label} started` : `${label} is unavailable`);
    };

    const reset = () => {
        pendingValuesRef.current = initialAdjustments;
        setLocalValues(initialAdjustments);
        if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        if (activeLayerId) updateLayer(activeLayerId, { adjustments: initialAdjustments, adjustmentsEnabled: true });
        setStatus('Adjustments reset');
    };

    const resetWhiteBalance = () => {
        if (activeLayerId) updateLayer(activeLayerId, { adjustments: { ...values, Temp: 0, Tint: 0 }, adjustmentsEnabled: true });
        setStatus('White balance reset');
    };

    const renderSlider = (name: AdjustmentName) => {
        const { min, max, step, tone, decimals } = sliderConfig[name];
        const value = localValues[name];
        const position = ((value - min) / (max - min)) * 100;
        const center = ((0 - min) / (max - min)) * 100;
        const displayValue = value.toFixed(decimals ?? 0);
        const hue = localValues.Hue;
        const hueColor = `hsl(${hue}, 100%, 50%)`;
        const track = tone === 'light'
            ? `linear-gradient(to right, #3b3b3f 0%, #3b3b3f ${Math.min(position, center)}%, #5148f4 ${Math.min(position, center)}%, #5148f4 ${Math.max(position, center)}%, #3b3b3f ${Math.max(position, center)}%, #3b3b3f 100%)`
            : tone === 'temperature'
                ? 'linear-gradient(to right, #1599ee, #b1a66d 50%, #ff9e00)'
                : tone === 'tint'
                    ? 'linear-gradient(to right, #00ee10, #7d8b77 50%, #ee00df)'
                    : tone === 'hue'
                        ? 'linear-gradient(to right, #f05050, #f5e735, #28ee4c, #27dbe8, #3e50f0, #d337ed, #f05050)'
                        : tone === 'vibrance'
                            ? `linear-gradient(to right, hsl(${hue}, 35%, 35%), ${hueColor}, hsl(${hue}, 100%, 70%))`
                            : tone === 'saturation'
                                ? `linear-gradient(to right, hsl(${hue}, 0%, 50%), ${hueColor})`
                                : tone === 'lightness'
                                    ? `linear-gradient(to right, #050505, ${hueColor}, #f1f1f1)`
                                    : 'linear-gradient(to right, #050505, #050505)';

        return (
        <label key={name} htmlFor={`studio-adjust-${name.toLowerCase()}`} className="grid h-7 grid-cols-[4rem_1fr_3rem] items-center gap-1 text-[10px] text-white/50">
            <span>{name === 'Temp' ? 'Temp' : name}</span>
            <input
                id={`studio-adjust-${name.toLowerCase()}`}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => updateValue(name, Number(event.target.value))}
                aria-valuetext={displayValue}
                style={{ background: track }}
                className="h-3.5 w-full cursor-pointer appearance-none rounded-full accent-white touch-none [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/40 [&::-webkit-slider-thumb]:bg-white"
            />
            <output htmlFor={`studio-adjust-${name.toLowerCase()}`} className="rounded-md bg-viz-surface px-1.5 py-0.5 text-right text-[11px] leading-5 text-white/85">{displayValue}</output>
        </label>
        );
    };

    return (
        <StudioPanelFrame title="Adjust" className="h-full max-h-full" collapsed={collapsed} onCollapsedChange={onCollapsedChange}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 custom-scrollbar">
                    <div className="grid grid-cols-3 gap-3">
                    {[
                        ['Enhance', WandSparkles, onEnhance],
                        ['Remove Bg.', ImagePlus, onRemoveBackground],
                        ['Unify', Sparkles, onUnify],
                    ].map(([label, Icon, action]) => (
                        <button key={label as string} type="button" onClick={() => runAction(label as string, action as (() => void) | undefined)} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-viz-border bg-viz-surface px-1 text-center text-[9px] font-semibold text-white/85 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50">
                            {React.createElement(Icon as React.ElementType, { size: 25, strokeWidth: 1.6, 'aria-hidden': true })}
                            <span>{label as string}</span>
                        </button>
                    ))}
                    </div>

                <div className="mt-10 flex items-center justify-between">
                    <h3 className="text-[11px] font-medium">Settings</h3>
                    <div className="flex items-center gap-3 text-white/90">
                        <button type="button" onClick={reset} aria-label="Reset adjustments" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"><RotateCcw size={19} /></button>
                        <button type="button" onClick={() => { if (activeLayerId) updateLayer(activeLayerId, { adjustmentsEnabled: preview }); setStatus(''); }} aria-pressed={preview} aria-label="Toggle settings preview" className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 ${preview ? 'text-white' : 'text-white/55'}`}><Eye size={19} /></button>
                    </div>
                </div>

                <button type="button" aria-expanded={lightOpen} onClick={() => setLightOpen((open) => !open)} className="mt-2 flex min-h-9 w-full items-center justify-between text-left text-[11px] font-medium focus:outline-none">
                    <span>Light</span>
                    <span className="flex items-center gap-4"><Eye size={18} aria-hidden="true" /><ChevronUp size={18} className={lightOpen ? 'transition-transform' : 'rotate-180 transition-transform'} aria-hidden="true" /></span>
                </button>

                {lightOpen && <div className="space-y-1.5 pb-2 pt-2">
                    {lightAdjustments.map((name) => renderSlider(name))}
                    <div className="flex min-h-9 items-center justify-between text-[10px] text-white/55">
                        <span>White point</span>
                        <span className="flex items-center gap-4">
                            <Pipette size={19} aria-hidden="true" />
                            <input type="color" value={values.whitePoint} onChange={(event) => activeLayerId && updateLayer(activeLayerId, { adjustments: { ...values, whitePoint: event.target.value }, adjustmentsEnabled: true })} aria-label="White point color" className="h-7 w-7 cursor-pointer rounded border border-white/20 bg-white p-0" />
                        </span>
                    </div>
                </div>}

                <button type="button" aria-expanded={colorOpen} onClick={() => setColorOpen((open) => !open)} className="mt-2 flex min-h-9 w-full items-center justify-between text-left text-[11px] font-medium focus:outline-none">
                    <span>Color</span>
                    <span className="flex items-center gap-4"><Eye size={18} aria-hidden="true" /><ChevronUp size={18} className={colorOpen ? 'transition-transform' : 'rotate-180 transition-transform'} aria-hidden="true" /></span>
                </button>
                {colorOpen && <div className="space-y-1.5 pb-2 pt-2">
                    <div className="flex min-h-9 items-center justify-between text-[10px] text-white/55">
                        <span>White balance</span>
                        <span className="flex items-center gap-2 text-white/90">
                            <button type="button" onClick={resetWhiteBalance} aria-label="Reset white balance" className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"><Undo2 size={19} /></button>
                            <button type="button" onClick={() => setStatus('Auto white balance unavailable')} aria-label="Auto white balance" className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"><Sparkles size={18} /></button>
                            <button type="button" onClick={() => setStatus('White balance picker unavailable')} aria-label="Pick white balance" className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"><Pipette size={19} /></button>
                        </span>
                    </div>
                    {colorAdjustments.map((name) => renderSlider(name))}
                </div>}
                </div>
                <div className="flex shrink-0 flex-col gap-2 px-3 pb-3 pt-3">
                    <button type="button" onClick={() => { const rasterized = onRasterize?.(); setStatus(onRasterize && rasterized !== false ? 'Rasterize started' : 'Rasterize unavailable'); }} className="min-h-9 w-full rounded-lg bg-viz-surface text-[10px] font-medium text-white/70 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50">Rasterize adjustment</button>
                    <p role="status" aria-live="polite" className="min-h-5 text-center text-[11px] text-white/50">{status || (preview ? 'Previewing original' : '')}</p>
                </div>
            </div>
        </StudioPanelFrame>
    );
};