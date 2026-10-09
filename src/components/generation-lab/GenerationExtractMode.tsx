'use client';

import { ImagePlus, Scissors } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { ExtractKind, GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import type { ExtractionOutput } from '@/services/ai/extractionService';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, ReferenceThumb, SectionLabel } from './GenerationModeControls';

interface GenerationExtractModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

const EXTRACT_OPTIONS: Array<{ kind: ExtractKind; label: string }> = [
    { kind: 'color', label: 'Color' },
    { kind: 'material', label: 'Material' },
    { kind: 'parts', label: 'Parts' },
];

export function GenerationExtractMode({ state, onUpdate, references, task, onGenerate, onBack }: GenerationExtractModeProps) {
    const actionLabel = state.extractKind === 'color' ? 'Update colors' : state.extractKind === 'material' ? 'Extract material' : 'Extract parts';
    const reference = references[0];
    const canRun = Boolean(reference) && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');

    const run = () => {
        if (!canRun || !reference) return;
        onGenerate({
            kind: 'extract',
            referenceImageId: reference.id,
            extractKind: state.extractKind,
            sampleBy: state.sampleBy === 'Hierarchy' ? 'hierarchy' : 'region',
        });
    };

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
                {reference ? (
                    <div className="flex items-center rounded-lg border border-viz-border bg-viz-surface p-1.5">
                        <ReferenceThumb reference={reference} number={1} trailing />
                    </div>
                ) : (
                    <p role="note" className="rounded-lg border border-dashed border-viz-border bg-viz-surface/40 px-3 py-3 text-center text-xs text-viz-muted">
                        <ImagePlus size={15} className="mx-auto mb-1 text-viz-muted" aria-hidden="true" />
                        Connect an image to sample.
                    </p>
                )}
                <button type="button" disabled={!canRun} onClick={run} className={`${NODE_BUTTON_CLASS} flex w-full items-center justify-center gap-1.5`}>
                    <Scissors size={13} aria-hidden="true" />{actionLabel}
                </button>

                {task.extraction && <ExtractionResults extraction={task.extraction} />}
            </div>
        </>
    );
}

function ExtractionResults({ extraction }: { extraction: ExtractionOutput }) {
    return (
        <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between">
                <SectionLabel>Result · {extraction.sampleBy}</SectionLabel>
                <span className="rounded bg-viz-panel px-1.5 py-0.5 text-[9px] text-viz-muted">{Math.round(extraction.confidence * 100)}% confidence</span>
            </div>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
                {extraction.components.map((component) => (
                    <li key={component.name} className="flex items-center gap-2 rounded-lg border border-viz-border bg-viz-surface px-2 py-1.5 text-[10px]">
                        {component.color?.hex ? (
                            <span role="img" aria-label={`${component.name} color ${component.color.hex}`} className="shrink-0 rounded border border-viz-border bg-viz-panel px-1 font-mono text-[9px] text-white/80">{component.color.hex}</span>
                        ) : (
                            <span className="h-4 w-4 shrink-0 rounded border border-dashed border-viz-border" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-white/90">
                            {component.name}
                            {component.role ? ` · ${component.role}` : ''}
                            {component.material?.category ? ` · ${component.material.category}` : ''}
                        </span>
                    </li>
                ))}
            </ul>
            <p role="status" className="text-center text-[9px] text-viz-muted">Saved as a reusable project asset.</p>
        </div>
    );
}
