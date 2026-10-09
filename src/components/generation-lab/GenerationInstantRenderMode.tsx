'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { WandSparkles } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import { composeStylePrompt, type RenderStyleId } from '@/services/ai/stylePromptRegistry';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskAspectRatio, RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, ReferenceThumb, SectionLabel } from './GenerationModeControls';

interface GenerationInstantRenderModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

const RATIO_OPTIONS: RenderTaskAspectRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'];

/** The three Instant Render styles, resolved through the studio legacy renderer's style registry. */
const STYLE_OPTIONS: Array<{ id: RenderStyleId; label: string }> = [
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'ultra_realistic', label: 'Ultra Realistic' },
    { id: 'sketch', label: 'Sketch' },
];

const DEFAULT_STYLE: RenderStyleId = 'cinematic';

export function GenerationInstantRenderMode({ state, onUpdate, references, task, onGenerate, onBack }: GenerationInstantRenderModeProps) {
    const reduceMotion = useReducedMotion();
    const reference = references[0];
    const hasReference = Boolean(reference);
    const style = state.instantStyle ?? DEFAULT_STYLE;
    const canGenerate = hasReference && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');

    const generate = () => {
        if (!canGenerate || !reference) return;
        onGenerate({
            kind: 'instant-render',
            // The style selector replaces the free-form prompt: the selected preset is
            // composed through the studio legacy renderer's style registry.
            prompt: composeStylePrompt('the referenced product', style),
            referenceImageId: reference.id,
            aspectRatio: state.instantRatio,
            advanced: { steps: state.advanced.steps, guidance: state.advanced.guidance, referenceResolution: state.advanced.referenceResolution },
        });
    };

    return (
        <>
            <ModeHeader mode="instant-render" title="Instant Render" icon={WandSparkles} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="space-y-1.5">
                    <SectionLabel>Reference image</SectionLabel>
                    {reference ? (
                        <div className="flex items-center rounded-lg border border-viz-border bg-viz-surface p-1.5">
                            <ReferenceThumb reference={reference} number={1} trailing />
                        </div>
                    ) : (
                        <p role="note" className="rounded-lg border border-dashed border-viz-border bg-viz-panel px-2.5 py-2 text-[10px] text-viz-muted">Connect an image before generating.</p>
                    )}
                </div>

                <div className="mt-2 space-y-1">
                    <label htmlFor="instant-style" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Style</label>
                    <select
                        id="instant-style"
                        value={style}
                        onChange={(event) => onUpdate({ instantStyle: event.target.value })}
                        className={NODE_CONTROL_CLASS}
                    >
                        {STYLE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </select>
                </div>

                <div className="mt-2 space-y-1">
                    <label htmlFor="instant-ratio" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Aspect ratio</label>
                    <select
                        id="instant-ratio"
                        value={state.instantRatio}
                        onChange={(event) => onUpdate({ instantRatio: event.target.value as RenderTaskAspectRatio })}
                        className="nodrag w-full rounded-lg border border-viz-border bg-viz-surface px-2 py-1.5 text-xs text-white outline-none transition-colors focus:border-viz-accent"
                    >
                        {RATIO_OPTIONS.map((ratio) => (
                            <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                    </select>
                </div>

                <motion.button
                    type="button"
                    disabled={!canGenerate}
                    onClick={generate}
                    initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 28, delay: 0.04 }}
                    className={`${NODE_BUTTON_CLASS} mt-2 flex w-full items-center justify-center gap-1.5`}
                >
                    <WandSparkles size={14} aria-hidden="true" />Generate
                </motion.button>
            </div>
        </>
    );
}
