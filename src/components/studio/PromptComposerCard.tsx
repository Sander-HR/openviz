import React from 'react';
import { ArrowRight, ImageIcon, Mic } from 'lucide-react';

interface PromptComposerCardProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
}

export const PromptComposerCard: React.FC<PromptComposerCardProps> = ({ id, label, value, onChange, onSubmit }) => {
    const submit = () => {
        if (value.trim()) onSubmit?.();
    };

    return (
        <div className="rounded-lg border border-viz-border bg-viz-surface">
            <label htmlFor={id} className="sr-only">{label}</label>
            <textarea id={id} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="What are you creating?" className="min-h-9 w-full resize-none bg-transparent p-2 text-xs text-white outline-none placeholder:text-white/35" />
            <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex gap-1.5">
                    <button type="button" aria-label="Add image reference" className="flex h-6 w-6 items-center justify-center rounded-lg bg-viz-border text-viz-muted transition-colors hover:text-white"><ImageIcon size={12} /></button>
                    <button type="button" aria-label="Use microphone" className="flex h-6 w-6 items-center justify-center rounded-lg bg-viz-border text-viz-muted transition-colors hover:text-white"><Mic size={12} /></button>
                </div>
                <button type="button" aria-label="Generate" disabled={!value.trim()} onClick={submit} className="flex h-6 w-6 items-center justify-center rounded-lg bg-viz-accent text-white transition-colors hover:bg-viz-accent/80 disabled:cursor-not-allowed disabled:opacity-30"><ArrowRight size={16} /></button>
            </div>
        </div>
    );
};
