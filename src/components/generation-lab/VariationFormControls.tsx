import { useRef, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import type { VariationAxis, VariationConfiguration, VariationCount, VariationPreset } from './generationNodeMockup.types';
import { VARIATION_COUNTS, VARIATION_PRESETS } from './variationConstants';
import { NODE_CONTROL_CLASS, SectionLabel } from './GenerationModeControls';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

/** Studio axis → stored label keys (vertical pair top/bottom, horizontal pair left/right). */
const AXIS_KEYS: Record<'horizontal' | 'vertical', [VariationAxis, VariationAxis]> = {
    vertical: ['top', 'bottom'],
    horizontal: ['left', 'right'],
};

interface VariationFormControlsProps {
    config: VariationConfiguration;
    onUpdate: (config: VariationConfiguration) => void;
}

/**
 * Form-variation internals copied from the studio VariationPanel: continuous
 * 2D direction slider with editable axis labels, the seven direction-template
 * presets, magnitude and output count.
 */
export function VariationFormControls({ config, onUpdate }: VariationFormControlsProps) {
    const gridRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef(false);
    const [editingLabel, setEditingLabel] = useState<{ axis: 'horizontal' | 'vertical'; index: 0 | 1 } | null>(null);

    const commitPosition = (nextX: number, nextY: number) => onUpdate({ ...config, position: { x: clamp(nextX), y: clamp(nextY) } });

    const updatePosition = (clientX: number, clientY: number) => {
        const bounds = gridRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width === 0 || bounds.height === 0) return;
        commitPosition(((clientX - bounds.left) / bounds.width) * 100, ((clientY - bounds.top) / bounds.height) * 100);
    };

    const applyPreset = (name: VariationPreset) => {
        if (name === 'Custom') {
            onUpdate({ ...config, preset: name });
            return;
        }
        const template = VARIATION_PRESETS.find((preset) => preset.name === name);
        if (!template) return;
        onUpdate({
            ...config,
            preset: name,
            axisLabels: { top: template.vertical[0], bottom: template.vertical[1], left: template.horizontal[0], right: template.horizontal[1] },
        });
    };

    const updateLabel = (axisKey: VariationAxis, value: string) => {
        // Editing a label always lands on Custom (studio panel behavior).
        onUpdate({ ...config, preset: 'Custom', axisLabels: { ...config.axisLabels, [axisKey]: value } });
    };

    const renderEditableLabel = (axis: 'horizontal' | 'vertical', index: 0 | 1, className: string) => {
        const axisKey = AXIS_KEYS[axis][index];
        const isEditing = editingLabel?.axis === axis && editingLabel.index === index;
        if (isEditing) {
            return (
                <input
                    autoFocus
                    defaultValue={config.axisLabels[axisKey]}
                    onBlur={(event) => { updateLabel(axisKey, event.target.value.trim() || config.axisLabels[axisKey]); setEditingLabel(null); }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                        if (event.key === 'Escape') { event.stopPropagation(); setEditingLabel(null); }
                    }}
                    className="nodrag w-24 rounded border border-viz-accent bg-viz-surface px-1 py-0.5 text-[10px] leading-none text-white outline-none"
                />
            );
        }
        return (
            <button type="button" onClick={() => setEditingLabel({ axis, index })} className={`nodrag cursor-text whitespace-nowrap rounded px-1 text-[10px] leading-none text-white/70 hover:bg-white/10 hover:text-white ${className}`}>
                {config.axisLabels[axisKey]}
            </button>
        );
    };

    const verticalLabel = config.position.y < 50 ? config.axisLabels.top : config.axisLabels.bottom;
    const horizontalLabel = config.position.x < 50 ? config.axisLabels.left : config.axisLabels.right;

    return (
        <div className="space-y-2">
            <SectionLabel>Form morph</SectionLabel>
            <div ref={gridRef} className="relative aspect-square overflow-hidden rounded-lg border border-viz-border bg-viz-surface" role="group" aria-label="form variation controls">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/5" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/5" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/5" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/5" />
                <span className="absolute left-1/2 top-2 flex h-4 -translate-x-1/2 items-center justify-center">{renderEditableLabel('vertical', 0, '')}</span>
                <span className="absolute bottom-2 left-1/2 flex h-4 -translate-x-1/2 items-center justify-center">{renderEditableLabel('vertical', 1, '')}</span>
                <span className="absolute left-2 top-1/2 -translate-y-1/2"><span className="flex h-4 w-4 items-center justify-center overflow-visible">{renderEditableLabel('horizontal', 0, '-rotate-90')}</span></span>
                <span className="absolute right-2 top-1/2 -translate-y-1/2"><span className="flex h-4 w-4 items-center justify-center overflow-visible">{renderEditableLabel('horizontal', 1, 'rotate-90')}</span></span>
                <button
                    type="button"
                    role="slider"
                    aria-label="Form variation position"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(config.position.x)}
                    aria-valuetext={`${verticalLabel}, ${horizontalLabel}`}
                    onPointerDown={(event) => { dragRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); updatePosition(event.clientX, event.clientY); }}
                    onPointerMove={(event) => { if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) updatePosition(event.clientX, event.clientY); }}
                    onPointerUp={() => { dragRef.current = false; }}
                    onPointerCancel={() => { dragRef.current = false; }}
                    onKeyDown={(event) => {
                        if (event.key.startsWith('Arrow')) {
                            event.preventDefault();
                            const step = event.shiftKey ? 10 : 25;
                            commitPosition(
                                config.position.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
                                config.position.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
                            );
                        }
                    }}
                    className="nodrag absolute h-7 w-7 touch-none cursor-grab -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-viz-accent shadow-lg shadow-viz-accent/30 active:cursor-grabbing"
                    style={{ left: `${config.position.x}%`, top: `${config.position.y}%` }}
                />
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <label htmlFor="variation-preset" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Preset</label>
                <div className="relative">
                    <select id="variation-preset" value={config.preset} onChange={(event) => applyPreset(event.target.value as VariationPreset)} className={`${NODE_CONTROL_CLASS} min-w-[128px] appearance-none pr-7`}>
                        {VARIATION_PRESETS.map((preset) => <option key={preset.name}>{preset.name}</option>)}
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-viz-muted" aria-hidden="true" />
                </div>
            </div>
            <VariationCountSelector id="form-count" label="Outputs" value={config.formCount} onChange={(formCount) => onUpdate({ ...config, formCount })} />
            <div className="space-y-1">
                <label htmlFor="form-magnitude" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Form magnitude</label>
                <div className="flex items-center gap-2">
                    <input
                        id="form-magnitude"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(config.magnitude * 100)}
                        onChange={(event) => onUpdate({ ...config, magnitude: Number(event.target.value) / 100 })}
                        className="nodrag w-full accent-viz-accent"
                    />
                    <span className="w-8 text-right text-[10px] text-viz-muted">{Math.round(config.magnitude * 100)}%</span>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-viz-muted">Position: {Math.round(config.position.x)}, {Math.round(config.position.y)}</span>
                <button type="button" onClick={() => onUpdate({ ...config, position: { x: 50, y: 50 } })} className="nodrag flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] text-viz-muted hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                    <RotateCcw size={11} aria-hidden="true" />Reset to center
                </button>
            </div>
        </div>
    );
}

export function VariationCountSelector({ id, label, value, onChange }: { id: string; label: string; value: VariationCount; onChange: (value: VariationCount) => void }) {
    return (
        <label htmlFor={id} className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-viz-muted">{label}
            <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value) as VariationCount)} className="nodrag h-8 rounded-lg border border-viz-border bg-viz-surface px-2 text-xs font-normal normal-case tracking-normal text-white outline-none focus:border-viz-accent">
                {VARIATION_COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
        </label>
    );
}
