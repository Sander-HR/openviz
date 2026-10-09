'use client';

import { Image as ImageIcon, Play, Video } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskDuration, RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, PromptEditor, ReferenceThumb, SectionLabel } from './GenerationModeControls';

interface GenerationAnimateModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

const STYLE_OPTIONS = [
    { id: 'standard_video', label: 'Standard Video' },
    { id: 'smooth_motion', label: 'Smooth motion' },
    { id: 'cinematic', label: 'Cinematic' },
];

const DURATION_OPTIONS: Array<{ value: RenderTaskDuration; label: string }> = [
    { value: '2s', label: '2 seconds' },
    { value: '4s', label: '4 seconds' },
    { value: '8s', label: '8 seconds' },
];

export function GenerationAnimateMode({ state, onUpdate, references, task, onGenerate, onBack }: GenerationAnimateModeProps) {
    const updateAnimate = (patch: Partial<GenerationPlaygroundState['animate']>) => onUpdate({ animate: { ...state.animate, ...patch } });
    const startFrame = references[0];
    const endFrame = references[1];
    const canGenerate = Boolean(startFrame) && state.prompt.trim().length > 0 && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');

    const generate = () => {
        if (!canGenerate || !startFrame) return;
        onGenerate({
            kind: 'animate',
            prompt: state.prompt.trim(),
            referenceImageId: startFrame.id,
            endFrameImageId: endFrame?.id,
            duration: state.animate.duration,
        });
    };

    return (
        <>
            <ModeHeader mode="animate" title="Animate" icon={Video} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="space-y-1.5">
                    <SectionLabel>Frames</SectionLabel>
                    <div className="flex items-center gap-2">
                        <div className={`flex flex-1 items-center gap-2 rounded-lg border bg-viz-surface p-1.5 ${startFrame ? 'border-viz-border' : 'border-dashed border-viz-border opacity-60'}`}>
                            {startFrame ? (
                                <>
                                    <ReferenceThumb reference={startFrame} number={1} sizeClass="h-8 w-8 rounded-md" />
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">Start</span>
                                </>
                            ) : (
                                <>
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-viz-panel text-viz-muted"><ImageIcon size={14} aria-hidden="true" /></span>
                                    <span className="min-w-0 flex-1 truncate text-xs text-viz-muted">Start · connect an image</span>
                                </>
                            )}
                        </div>
                        <div className={`flex flex-1 items-center gap-2 rounded-lg border bg-viz-surface/50 p-1.5 ${endFrame ? 'border-viz-border' : 'border-dashed border-viz-border opacity-60'}`}>
                            {endFrame ? (
                                <>
                                    <ReferenceThumb reference={endFrame} number={2} sizeClass="h-8 w-8 rounded-md" />
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">End</span>
                                </>
                            ) : (
                                <>
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-viz-panel text-viz-muted"><ImageIcon size={14} aria-hidden="true" /></span>
                                    <span className="min-w-0 flex-1 truncate text-xs text-viz-muted">End · optional</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <PromptEditor id="animate-prompt" value={state.prompt} onChange={(prompt) => onUpdate({ prompt })} placeholder="Describe the motion…" />

                {!startFrame && (
                    <p role="note" className="mt-2 text-center text-[10px] text-viz-muted">Connect a start image before animating.</p>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                        <label htmlFor="animate-style" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-viz-muted">Style</label>
                        <select id="animate-style" value={state.animate.styleId} onChange={(event) => updateAnimate({ styleId: event.target.value })} className={NODE_CONTROL_CLASS}>
                            {STYLE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="animate-duration" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-viz-muted">Duration</label>
                        <select id="animate-duration" value={state.animate.duration} onChange={(event) => updateAnimate({ duration: event.target.value as RenderTaskDuration })} className={NODE_CONTROL_CLASS}>
                            {DURATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button type="button" disabled={!canGenerate} onClick={generate} className={`${NODE_BUTTON_CLASS} mt-2 flex w-full items-center justify-center gap-1.5`}>
                    <Play size={14} aria-hidden="true" />Animate
                </button>
            </div>
        </>
    );
}
