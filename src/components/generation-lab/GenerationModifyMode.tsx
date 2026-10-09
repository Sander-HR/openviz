'use client';

import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Wand2, WandSparkles } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskAspectRatio, RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import { ModeHeader, NODE_BUTTON_CLASS, PromptEditor, ReferenceThumb } from './GenerationModeControls';

interface GenerationModifyModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    /** Connected source images, numbered 1..n for @-mentions. */
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

const RATIO_OPTIONS: Array<RenderTaskAspectRatio | '1:1'> = ['1:1', '4:3', '3:4', '16:9', '9:16'];

/** Sentence starters inserted by the template chips (displayed with a trailing ellipsis). */
export const MODIFY_PROMPT_TEMPLATES = [
    'Make ',
    'Change ',
    'Insert ',
];

/** Active "@..." fragment at the end of the prompt (cursor assumed at end in the mockup). */
const MENTION_PATTERN = /@([A-Za-z0-9]*)$/;

const ICON_BUTTON_CLASS = 'nodrag flex h-7 w-7 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';
const TEMPLATE_CHIP_CLASS = 'nodrag touch-manipulation rounded-full border border-viz-border bg-viz-surface px-2.5 py-1 text-[10px] text-white/80 transition-colors hover:border-viz-accent hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';

function toMentionReferences(references: RenderTaskReference[]): Array<{ number: number; name: string }> {
    return references.map((reference, index) => ({ number: index + 1, name: reference.name }));
}

export function GenerationModifyMode({ state, onUpdate, references, task, onGenerate, onBack }: GenerationModifyModeProps) {
    const promptRef = useRef<HTMLTextAreaElement>(null);
    const [showRatios, setShowRatios] = useState(false);
    const hasPrompt = state.prompt.trim().length > 0;
    const hasReference = references.length > 0;
    const canGenerate = hasPrompt && hasReference && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');

    const placeCursorAtEnd = (next: string) => {
        const place = () => {
            const el = promptRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(next.length, next.length);
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(place);
        else setTimeout(place, 0);
    };

    const insertTemplate = (template: string) => {
        const next = state.prompt.trim() ? `${state.prompt.trimEnd()} ${template}` : template;
        onUpdate({ prompt: next });
        placeCursorAtEnd(next);
    };

    const mentionReferences = toMentionReferences(references);
    const mentionMatch = MENTION_PATTERN.exec(state.prompt);
    const mentionFragment = mentionMatch ? mentionMatch[1] : null;
    const suggestions = mentionFragment === null
        ? []
        : mentionReferences.filter((reference) => reference.name.toLowerCase().startsWith(mentionFragment.toLowerCase()) || String(reference.number) === mentionFragment);

    const applyMention = (reference: { number: number; name: string }) => {
        const match = MENTION_PATTERN.exec(state.prompt);
        if (!match) return;
        const next = `${state.prompt.slice(0, match.index)}@${reference.number} `;
        onUpdate({ prompt: next });
        placeCursorAtEnd(next);
    };

    const generate = () => {
        if (!canGenerate) return;
        onGenerate({
            kind: 'modify',
            prompt: state.prompt.trim(),
            referenceImageId: references[0]?.id,
            aspectRatio: state.modify.aspectRatio as RenderTaskAspectRatio,
            referenceFidelity: state.modify.fidelity,
            advanced: { steps: state.advanced.steps, guidance: state.advanced.guidance, referenceResolution: state.advanced.referenceResolution },
        });
    };

    return (
        <>
            <ModeHeader mode="modify" title="Modify" icon={Wand2} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="relative">
                    <PromptEditor
                        id="modify-prompt"
                        autoFocus
                        labelless
                        inputRef={promptRef}
                        tokenReferences={mentionReferences}
                        topContent={
                            references.length > 0 ? (
                                references.map((reference, index) => (
                                    <span key={reference.id} className="inline-flex items-center rounded-lg border border-viz-border bg-viz-panel p-0.5" aria-label={`Reference image ${index + 1}`}>
                                        <ReferenceThumb reference={reference} number={index + 1} sizeClass="h-5 w-5 rounded" />
                                    </span>
                                ))
                            ) : (
                                <p className="rounded-lg border border-dashed border-viz-border bg-viz-panel px-2 py-1.5 text-[10px] text-viz-muted">Connect an image to start modifying.</p>
                            )
                        }
                        value={state.prompt}
                        onChange={(prompt) => onUpdate({ prompt })}
                    />

                    {suggestions.length > 0 && (
                        <div role="listbox" aria-label="Reference suggestions" className="absolute left-2 top-full z-50 mt-1 w-44 rounded-lg border border-viz-border bg-viz-panel p-1 shadow-viz">
                            {suggestions.map((reference) => (
                                <button
                                    key={reference.number}
                                    type="button"
                                    role="option"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        applyMention(reference);
                                    }}
                                    className="nodrag flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-white/90 transition-colors hover:bg-viz-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                                >
                                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-viz-accent px-1 text-[9px] font-bold text-white">{reference.number}</span>
                                    {reference.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-1.5" aria-label="Prompt templates">
                    {MODIFY_PROMPT_TEMPLATES.map((template) => (
                        <button key={template} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertTemplate(template)} className={TEMPLATE_CHIP_CLASS}>
                            {template.trim()}…
                        </button>
                    ))}
                </div>

                <div className="mt-2 space-y-1">
                    <label htmlFor="modify-fidelity" className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Reference fidelity</label>
                    <div className="flex items-center gap-2">
                        <input
                            id="modify-fidelity"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={Math.round(state.modify.fidelity * 100)}
                            onChange={(event) => onUpdate({ modify: { ...state.modify, fidelity: Number(event.target.value) / 100 } })}
                            className="nodrag w-full accent-viz-accent"
                        />
                        <span className="w-8 text-right text-[10px] text-viz-muted">{Math.round(state.modify.fidelity * 100)}%</span>
                    </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            aria-haspopup="listbox"
                            aria-expanded={showRatios}
                            aria-label={`Aspect ratio ${state.modify.aspectRatio}`}
                            onClick={() => setShowRatios((visible) => !visible)}
                            className="nodrag flex h-8 items-center gap-1.5 rounded-lg border border-viz-border bg-viz-surface px-2.5 text-xs text-white transition-colors hover:border-viz-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                        >
                            <ImageIcon size={13} className="text-viz-muted" aria-hidden="true" />
                            {state.modify.aspectRatio}
                        </button>
                        {showRatios && (
                            <div role="listbox" aria-label="Aspect ratio options" className="absolute left-0 top-full z-50 mt-1 w-24 rounded-lg border border-viz-border bg-viz-panel p-1 shadow-viz">
                                {RATIO_OPTIONS.map((ratio) => (
                                    <button
                                        key={ratio}
                                        type="button"
                                        role="option"
                                        aria-selected={state.modify.aspectRatio === ratio}
                                        onClick={() => {
                                            onUpdate({ modify: { ...state.modify, aspectRatio: ratio } });
                                            setShowRatios(false);
                                        }}
                                        className={`nodrag w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${state.modify.aspectRatio === ratio ? 'bg-viz-surface text-white' : 'text-white/80 hover:bg-viz-surface'}`}
                                    >
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="ml-auto flex items-center gap-1">
                        <button type="button" aria-label="Camera" className={ICON_BUTTON_CLASS}>
                            <Camera size={14} aria-hidden="true" />
                        </button>
                        <button type="button" aria-label="Magic prompt" className={ICON_BUTTON_CLASS}>
                            <WandSparkles size={14} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {!hasPrompt && (
                    <p role="note" className="mt-2 text-center text-[10px] text-viz-muted">A description is required to generate.</p>
                )}

                <button
                    type="button"
                    disabled={!canGenerate}
                    onClick={generate}
                    className={`${NODE_BUTTON_CLASS} mt-2 flex w-full items-center justify-center gap-1.5`}
                >
                    <WandSparkles size={14} aria-hidden="true" />Generate
                </button>
            </div>
        </>
    );
}
