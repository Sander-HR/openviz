import { useRef } from 'react';
import { ArrowDownRight, ChevronDown, CopyPlus, Plus, RotateCcw } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { FormPosition, GenerationPlaygroundState, GenerationStatePatch, VariationAxis, VariationCount, VariationPreset } from './generationNodeMockup.types';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, SectionLabel } from './GenerationModeControls';

interface GenerationVariationModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (label: string) => void;
    onBack: () => void;
}

const COUNTS: VariationCount[] = [2, 4, 8];
const PRESETS: VariationPreset[] = ['Balanced', 'Soft sculpt', 'Geometric', 'Organic'];
const SWATCH_CYCLE = ['stone', 'moss', 'sea', 'ember', 'sand'];
const SWATCH_CLASSES: Record<string, string> = {
    stone: 'bg-zinc-400',
    moss: 'bg-emerald-700',
    sea: 'bg-sky-700',
    ember: 'bg-orange-700',
    sand: 'bg-amber-200',
};
const POSITION_CLASS: Record<FormPosition, string> = {
    'top-left': 'left-[25%] top-[25%]',
    top: 'left-1/2 top-[25%]',
    'top-right': 'left-[75%] top-[25%]',
    left: 'left-[25%] top-1/2',
    center: 'left-1/2 top-1/2',
    right: 'left-[75%] top-1/2',
    'bottom-left': 'left-[25%] top-[75%]',
    bottom: 'left-1/2 top-[75%]',
    'bottom-right': 'left-[75%] top-[75%]',
};
const POSITIONS: FormPosition[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];
const AXIS_INPUT_CLASS = 'nodrag absolute z-10 w-[4.5rem] rounded border border-viz-border bg-viz-panel/90 px-1 py-0.5 text-center text-[9px] text-white outline-none focus:border-viz-accent';

export function GenerationVariationMode({ state, onUpdate, onGenerate, onBack }: GenerationVariationModeProps) {
    const config = state.variation;
    const count = config.kind === 'form' ? config.formCount : config.colorCount;

    return (
        <>
            <ModeHeader mode="variation" title="Variation" icon={CopyPlus} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="grid grid-cols-2 rounded-lg border border-viz-border bg-viz-bg p-0.5" role="group" aria-label="Variation type">
                    {(['form', 'color'] as const).map((kind) => (
                        <button key={kind} type="button" aria-label={kind === 'form' ? 'Form' : 'Color'} aria-pressed={config.kind === kind} onClick={() => onUpdate({ variation: { ...config, kind } })} className={`nodrag h-7 rounded-md text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent ${config.kind === kind ? 'bg-viz-selected text-white' : 'text-viz-muted hover:bg-viz-surface hover:text-white'}`}>
                            {kind}
                        </button>
                    ))}
                </div>
                {config.kind === 'form' ? <FormVariation config={config} onUpdate={(variation) => onUpdate({ variation })} /> : <ColorVariation config={config} onUpdate={(variation) => onUpdate({ variation })} />}
                <button type="button" onClick={() => onGenerate('Variation')} className={`${NODE_BUTTON_CLASS} w-full`}>
                    Generate {count} variations
                </button>
            </div>
        </>
    );
}

function FormVariation({ config, onUpdate }: { config: GenerationPlaygroundState['variation']; onUpdate: (config: GenerationPlaygroundState['variation']) => void }) {
    const gridRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef(false);
    const setPositionFromPointer = (clientX: number, clientY: number) => {
        const bounds = gridRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width === 0 || bounds.height === 0) return;
        const column = Math.min(2, Math.max(0, Math.floor(((clientX - bounds.left) / bounds.width) * 3)));
        const row = Math.min(2, Math.max(0, Math.floor(((clientY - bounds.top) / bounds.height) * 3)));
        onUpdate({ ...config, position: POSITIONS[row * 3 + column] });
    };
    const movePosition = (key: string) => {
        const currentIndex = POSITIONS.indexOf(config.position);
        const row = Math.floor(currentIndex / 3);
        const column = currentIndex % 3;
        const nextRow = Math.min(2, Math.max(0, row + (key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0)));
        const nextColumn = Math.min(2, Math.max(0, column + (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0)));
        onUpdate({ ...config, position: POSITIONS[nextRow * 3 + nextColumn] });
    };

    return (
        <div className="space-y-2">
            <SectionLabel>Form morph</SectionLabel>
            <div ref={gridRef} className="relative aspect-square overflow-hidden rounded-lg border border-viz-border bg-viz-surface/20" role="group" aria-label="2 by 2 form morph grid" onPointerMove={(event) => { if (dragRef.current) setPositionFromPointer(event.clientX, event.clientY); }} onPointerUp={() => { dragRef.current = false; }} onPointerCancel={() => { dragRef.current = false; }}>
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2" aria-hidden="true">
                    <div className="border-b border-r border-dashed border-viz-border bg-viz-surface/20" />
                    <div className="border-b border-dashed border-viz-border bg-viz-surface/10" />
                    <div className="border-r border-dashed border-viz-border bg-viz-surface/10" />
                    <div className="bg-viz-surface/20" />
                </div>
                <AxisInput axis="top" value={config.axisLabels.top} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, top: value } })} className="left-1/2 top-1.5 -translate-x-1/2" />
                <AxisInput axis="bottom" value={config.axisLabels.bottom} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, bottom: value } })} className="bottom-1.5 left-1/2 -translate-x-1/2" />
                <AxisInput axis="left" value={config.axisLabels.left} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, left: value } })} className="left-1 top-1/2 -translate-y-1/2" />
                <AxisInput axis="right" value={config.axisLabels.right} onChange={(value) => onUpdate({ ...config, axisLabels: { ...config.axisLabels, right: value } })} className="right-1 top-1/2 -translate-y-1/2" />
                <button
                    type="button"
                    role="slider"
                    aria-label="Variation position"
                    aria-valuemin={0}
                    aria-valuemax={8}
                    aria-valuenow={POSITIONS.indexOf(config.position)}
                    aria-valuetext={config.position}
                    onPointerDown={(event) => {
                        dragRef.current = true;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setPositionFromPointer(event.clientX, event.clientY);
                    }}
                    onKeyDown={(event) => {
                        if (event.key.startsWith('Arrow')) {
                            event.preventDefault();
                            movePosition(event.key);
                        }
                    }}
                    className={`nodrag absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-viz-bg bg-viz-accent text-white shadow-viz focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viz-accent ${POSITION_CLASS[config.position]}`}
                >
                    <ArrowDownRight size={13} aria-hidden="true" />
                </button>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <label htmlFor="variation-preset" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Preset</label>
                <div className="relative">
                    <select id="variation-preset" value={config.preset} onChange={(event) => onUpdate({ ...config, preset: event.target.value as VariationPreset })} className={`${NODE_CONTROL_CLASS} min-w-[128px] appearance-none pr-7`}>
                        {PRESETS.map((preset) => <option key={preset}>{preset}</option>)}
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-viz-muted" aria-hidden="true" />
                </div>
            </div>
            <CountSelector id="form-count" label="Outputs" value={config.formCount} onChange={(formCount) => onUpdate({ ...config, formCount })} />
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-viz-muted">Position: {config.position}</span>
                <button type="button" onClick={() => onUpdate({ ...config, position: 'center' })} className="nodrag flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] text-viz-muted hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                    <RotateCcw size={11} aria-hidden="true" />Reset to center
                </button>
            </div>
        </div>
    );
}

function AxisInput({ axis, value, onChange, className }: { axis: VariationAxis; value: string; onChange: (value: string) => void; className: string }) {
    return <input aria-label={`${axis} axis label`} value={value} onChange={(event) => onChange(event.target.value)} className={`${AXIS_INPUT_CLASS} ${className}`} />;
}

function ColorVariation({ config, onUpdate }: { config: GenerationPlaygroundState['variation']; onUpdate: (config: GenerationPlaygroundState['variation']) => void }) {
    const addSwatch = () => {
        const next = SWATCH_CYCLE.find((swatch) => !config.swatches.includes(swatch)) ?? SWATCH_CYCLE[config.swatches.length % SWATCH_CYCLE.length];
        onUpdate({ ...config, swatches: [...config.swatches, next] });
    };
    return (
        <div className="space-y-2">
            <SectionLabel>Color palette</SectionLabel>
            <div className="flex items-center gap-1.5" role="group" aria-label="Palette swatches">
                {config.swatches.map((swatch, index) => <span key={`${swatch}-${index}`} role="img" aria-label={`${swatch} swatch`} className={`h-8 min-w-0 flex-1 rounded-md border border-viz-border ${SWATCH_CLASSES[swatch] ?? 'bg-viz-surface'}`} />)}
                <button type="button" aria-label="Add swatch" onClick={addSwatch} className="nodrag flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-viz-border text-viz-muted hover:border-viz-accent hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"><Plus size={14} aria-hidden="true" /></button>
            </div>
            <label htmlFor="palette-name" className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-viz-muted">Palette name
                <input id="palette-name" value={config.paletteName} onChange={(event) => onUpdate({ ...config, paletteName: event.target.value })} className={NODE_CONTROL_CLASS} />
            </label>
            <CountSelector id="color-count" label="Colorways" value={config.colorCount} onChange={(colorCount) => onUpdate({ ...config, colorCount })} />
        </div>
    );
}

function CountSelector({ id, label, value, onChange }: { id: string; label: string; value: VariationCount; onChange: (value: VariationCount) => void }) {
    return (
        <label htmlFor={id} className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-viz-muted">{label}
            <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value) as VariationCount)} className="nodrag h-8 rounded-lg border border-viz-border bg-viz-surface px-2 text-xs font-normal normal-case tracking-normal text-white outline-none focus:border-viz-accent">
                {COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
        </label>
    );
}
