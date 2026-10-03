import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Wand2, WandSparkles } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import { ProductArtwork } from './ProductArtwork';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import { ModeHeader, NODE_BUTTON_CLASS, PromptEditor } from './GenerationModeControls';

interface GenerationModifyModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (label: string) => void;
    onBack: () => void;
}

const RATIO_OPTIONS = ['1:1', '4:3', '3:4', '16:9', '9:16'];

/** Sentence starters inserted by the template chips (displayed with a trailing ellipsis). */
export const MODIFY_PROMPT_TEMPLATES = [
    'Make ',
    'Change ',
    'Insert ',
];

const REFERENCES = [{ number: 1, name: 'Arc Lamp' }];

/** Active "@..." fragment at the end of the prompt (cursor assumed at end in the mockup). */
const MENTION_PATTERN = /@([A-Za-z0-9]*)$/;

const ICON_BUTTON_CLASS = 'nodrag flex h-7 w-7 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';
const TEMPLATE_CHIP_CLASS = 'nodrag touch-manipulation rounded-full border border-viz-border bg-viz-surface px-2.5 py-1 text-[10px] text-white/80 transition-colors hover:border-viz-accent hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';

export function GenerationModifyMode({ state, onUpdate, onGenerate, onBack }: GenerationModifyModeProps) {
    const [showRatios, setShowRatios] = useState(false);
    const promptRef = useRef<HTMLTextAreaElement>(null);
    const canGenerate = state.prompt.trim().length > 0;

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

    const mentionMatch = MENTION_PATTERN.exec(state.prompt);
    const mentionFragment = mentionMatch ? mentionMatch[1] : null;
    const suggestions = mentionFragment === null
        ? []
        : REFERENCES.filter((reference) => reference.name.toLowerCase().startsWith(mentionFragment.toLowerCase()) || String(reference.number) === mentionFragment);

    const applyMention = (reference: { number: number; name: string }) => {
        const match = MENTION_PATTERN.exec(state.prompt);
        if (!match) return;
        const next = `${state.prompt.slice(0, match.index)}@${reference.number} `;
        onUpdate({ prompt: next });
        placeCursorAtEnd(next);
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
                    tokenReferences={REFERENCES}
                    topContent={
                        REFERENCES.map((reference) => (
                            <span key={reference.number} className="inline-flex items-center gap-1.5 rounded-lg border border-viz-border bg-viz-panel py-0.5 pl-1 pr-2" aria-label={`Reference image ${reference.number}`}>
                                <span className="relative">
                                    <ProductArtwork className="h-5 w-5 rounded" />
                                    <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-viz-accent px-0.5 text-[8px] font-bold text-white">{reference.number}</span>
                                </span>
                                <span className="text-[10px] text-white/90">{reference.name}</span>
                            </span>
                        ))
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

                <div className="flex items-center gap-2">
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

                <button
                    type="button"
                    disabled={!canGenerate}
                    onClick={() => onGenerate('Modify')}
                    className={`${NODE_BUTTON_CLASS} flex w-full items-center justify-center gap-1.5`}
                >
                    <WandSparkles size={14} aria-hidden="true" />Generate
                </button>
            </div>
        </>
    );
}
