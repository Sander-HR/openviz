import { Image as ImageIcon, Play, Video } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import { ProductArtwork } from './ProductArtwork';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, SectionLabel } from './GenerationModeControls';

interface GenerationAnimateModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (label: string) => void;
    onBack: () => void;
}

const STYLE_OPTIONS = [
    { id: 'standard_video', label: 'Standard Video' },
    { id: 'smooth_motion', label: 'Smooth motion' },
    { id: 'cinematic', label: 'Cinematic' },
];

const DURATION_OPTIONS = [
    { value: '2s', label: '2 seconds' },
    { value: '4s', label: '4 seconds' },
    { value: '8s', label: '8 seconds' },
];

export function GenerationAnimateMode({ state, onUpdate, onGenerate, onBack }: GenerationAnimateModeProps) {
    const updateAnimate = (patch: Partial<GenerationPlaygroundState['animate']>) => onUpdate({ animate: { ...state.animate, ...patch } });

    return (
        <>
            <ModeHeader mode="animate" title="Animate" icon={Video} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="space-y-1.5">
                    <SectionLabel>Frames</SectionLabel>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center gap-2 rounded-lg border border-viz-border bg-viz-surface p-1.5">
                            <ProductArtwork className="h-8 w-8 shrink-0 rounded-md" />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">Start</span>
                        </div>
                        <div className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-viz-border bg-viz-surface/50 p-1.5 opacity-60">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-viz-panel text-viz-muted">
                                <ImageIcon size={14} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-viz-muted">End · connect an image</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
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
                        <select id="animate-duration" value={state.animate.duration} onChange={(event) => updateAnimate({ duration: event.target.value })} className={NODE_CONTROL_CLASS}>
                            {DURATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button type="button" onClick={() => onGenerate('Animate')} className={`${NODE_BUTTON_CLASS} flex w-full items-center justify-center gap-1.5`}>
                    <Play size={14} aria-hidden="true" />Animate
                </button>
            </div>
        </>
    );
}
