import { useState } from 'react';
import { ChevronLeft, Info } from 'lucide-react';
import { Fragment } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { GenerationMode } from './generationNodeMockup.types';

export const NODE_CONTROL_CLASS = 'nodrag nowheel w-full rounded-lg border border-viz-border bg-viz-surface px-2.5 py-2 text-xs text-white outline-none transition-colors placeholder:text-viz-muted focus:border-viz-accent';
export const NODE_BUTTON_CLASS = 'nodrag h-9 rounded-lg bg-viz-accent px-3 text-xs font-medium text-white transition-colors hover:bg-viz-accent/90 disabled:cursor-not-allowed disabled:opacity-40';

const MODE_INFO: Record<Exclude<GenerationMode, 'base'>, string> = {
    modify: 'Edit the connected product image while preserving its structure.',
    animate: 'Turn the connected frames into a short video animation.',
    'instant-render': 'Create a new render from a prompt and the connected reference image.',
    variation: 'Explore form or color directions while preserving the connected source image.',
    'new-view': 'Choose a camera angle to generate a new view of the connected reference.',
    extract: 'Sample color, material, or parts from a reference image.',
};

export function ModeHeader({ mode, title, icon: Icon, onBack }: { mode: Exclude<GenerationMode, 'base'>; title: string; icon: LucideIcon; onBack: () => void }) {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <div className="relative flex h-9 shrink-0 items-center gap-2 border-b border-viz-border px-2">
            <button type="button" onClick={onBack} aria-label="Back to actions" className="nodrag flex h-7 w-7 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <Icon size={14} className="shrink-0 text-white" aria-hidden="true" />
            <h3 className="min-w-0 flex-1 truncate text-xs font-medium text-white">{title}</h3>
            <div className="relative">
                <button type="button" aria-label={`About ${title}`} aria-expanded={showInfo} onClick={() => setShowInfo((visible) => !visible)} className="nodrag flex h-7 w-7 items-center justify-center rounded-lg text-viz-muted hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                    <Info size={13} aria-hidden="true" />
                </button>
                {showInfo && <span role="tooltip" className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-viz-border bg-viz-surface p-2 text-[10px] leading-4 text-white shadow-viz">{MODE_INFO[mode]}</span>}
            </div>
        </div>
    );
}

interface PromptEditorProps {
    value: string;
    onChange: (value: string) => void;
    id?: string;
    label?: string;
    placeholder?: string;
    autoFocus?: boolean;
    /** No header row; the character counter renders inside the box, bottom-right. */
    labelless?: boolean;
    /** Rendered inside the bordered box, above the textarea (labelless mode only). */
    topContent?: ReactNode;
    /** Ref forwarded to the textarea so callers can focus it and place the cursor. */
    inputRef?: Ref<HTMLTextAreaElement>;
    /** When provided (labelless mode), @number tokens are shown as blue blocks and delete atomically on Backspace. */
    tokenReferences?: Array<{ number: number; name: string }>;
}

export function PromptEditor({ value, onChange, id = 'node-prompt', label = 'Prompt', placeholder = 'Describe your changes', autoFocus = false, labelless = false, topContent, inputRef, tokenReferences }: PromptEditorProps) {
    const highlightTokens = labelless && Boolean(tokenReferences);

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        event.stopPropagation();
        const target = event.target as HTMLTextAreaElement;
        if (!highlightTokens || event.key !== 'Backspace' || target.selectionStart !== target.selectionEnd) return;
        const before = value.slice(0, target.selectionStart);
        const match = /@\d+$/.exec(before);
        if (!match) return;
        event.preventDefault();
        let caret = before.length - match[0].length;
        if (before[caret - 1] === ' ') caret -= 1;
        onChange(`${before.slice(0, caret)}${value.slice(target.selectionEnd)}`);
        const el = event.currentTarget;
        const placeCaret = () => {
            el.focus();
            el.setSelectionRange(caret, caret);
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(placeCaret);
        else setTimeout(placeCaret, 0);
    };

    const textarea = (
        <textarea
            ref={inputRef}
            id={id}
            value={value}
            maxLength={2000}
            rows={labelless ? 5 : 3}
            autoFocus={autoFocus}
            onChange={(event) => onChange(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`nodrag nowheel touch-manipulation w-full resize-none p-2.5 text-xs outline-none transition-colors placeholder:text-viz-muted ${highlightTokens ? 'text-transparent caret-white' : 'text-white'} ${labelless ? 'min-h-[120px] rounded-none border-0 bg-transparent pb-6' : 'rounded-lg border border-viz-border bg-viz-surface min-h-[72px] focus:border-viz-accent'}`}
        />
    );

    const tokenMirror = highlightTokens ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-2.5 pb-6 text-xs text-white">
            {value.split(/(@\d+)/g).map((segment, index) => {
                const token = /^@(\d+)$/.exec(segment);
                if (token && tokenReferences?.some((reference) => reference.number === Number(token[1]))) {
                    // No padding/border: the mirror must stay metric-identical to the transparent textarea or the caret drifts.
                    return (
                        <span key={index} className="rounded-full bg-viz-accent font-bold text-white">
                            {segment}
                        </span>
                    );
                }
                return <Fragment key={index}>{segment}</Fragment>;
            })}
        </div>
    ) : null;

    if (labelless) {
        return (
            <div className="relative rounded-lg border border-viz-border bg-viz-surface transition-colors focus-within:border-viz-accent" aria-label="Prompt editor">
                {topContent ? <div className="px-2.5 pt-2.5">{topContent}</div> : null}
                <div className="relative">
                    {tokenMirror}
                    {textarea}
                </div>
                <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-viz-muted">{value.length}/2000</span>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">{label}</label>
                <span className="text-[10px] text-viz-muted">{value.length}/2000</span>
            </div>
            {textarea}
        </div>
    );
}

export function SectionLabel({ children }: { children: ReactNode }) {
    return <p className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">{children}</p>;
}
