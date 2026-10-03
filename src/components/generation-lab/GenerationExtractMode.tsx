import { ImagePlus, Scissors } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { ExtractKind, GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, SectionLabel } from './GenerationModeControls';

interface GenerationExtractModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (label: string) => void;
    onBack: () => void;
}

const EXTRACT_OPTIONS: Array<{ kind: ExtractKind; label: string }> = [
    { kind: 'color', label: 'Color' },
    { kind: 'material', label: 'Material' },
    { kind: 'parts', label: 'Parts' },
];

export function GenerationExtractMode({ state, onUpdate, onGenerate, onBack }: GenerationExtractModeProps) {
    const actionLabel = state.extractKind === 'color' ? 'Update colors' : state.extractKind === 'material' ? 'Extract material' : 'Extract parts';
    return (
        <>
            <ModeHeader mode="extract" title="Extract" icon={Scissors} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <fieldset className="space-y-1.5">
                    <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-viz-muted">Type</legend>
                    <div className="grid grid-cols-3 rounded-lg border border-viz-border bg-viz-bg p-0.5">
                        {EXTRACT_OPTIONS.map(({ kind, label }) => <button key={kind} type="button" aria-pressed={state.extractKind === kind} onClick={() => onUpdate({ extractKind: kind })} className={`nodrag h-7 rounded-md text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent ${state.extractKind === kind ? 'bg-viz-selected text-white' : 'text-viz-muted hover:bg-viz-surface hover:text-white'}`}>{label}</button>)}
                    </div>
                </fieldset>
                <label htmlFor="extract-sample-by" className="block space-y-1.5"><SectionLabel>Sample by</SectionLabel>
                    <select id="extract-sample-by" value={state.sampleBy} onChange={(event) => onUpdate({ sampleBy: event.target.value as GenerationPlaygroundState['sampleBy'] })} className={`${NODE_CONTROL_CLASS} appearance-none`}>
                        <option>Hierarchy</option><option>Region</option>
                    </select>
                </label>
                <button type="button" aria-label={state.extractAttached ? 'Reference image attached' : 'Attach an image to sample'} aria-pressed={state.extractAttached} onClick={() => onUpdate({ extractAttached: !state.extractAttached })} className="nodrag flex min-h-20 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-viz-border bg-viz-surface/40 px-3 py-3 text-center transition-colors hover:border-viz-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                    <ImagePlus size={17} className="text-viz-muted" aria-hidden="true" />
                    <span className="text-xs text-white">{state.extractAttached ? 'Reference image attached' : 'Attach an image to sample'}</span>
                    <span className="text-[10px] text-viz-muted">{state.extractAttached ? 'Arc lamp · reference 1' : 'Drop an image or browse files'}</span>
                </button>
                <button type="button" disabled={!state.extractAttached} onClick={() => onGenerate('Extract')} className={`${NODE_BUTTON_CLASS} flex w-full items-center justify-center gap-1.5`}>
                    <Scissors size={13} aria-hidden="true" />{actionLabel}
                </button>
            </div>
        </>
    );
}
