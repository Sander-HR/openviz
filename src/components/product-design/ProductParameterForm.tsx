import React from 'react';
import type { AspectRatio } from '@/types';

interface ProductParameterFormProps {
    prompt: string;
    negativePrompt?: string;
    batchSize: number;
    aspectRatio: AspectRatio;
    isSubmitting?: boolean;
    error?: string;
    onPromptChange: (prompt: string) => void;
    onNegativePromptChange?: (prompt: string) => void;
    onBatchSizeChange: (batchSize: number) => void;
    onAspectRatioChange: (aspectRatio: AspectRatio) => void;
    onSubmit: () => void;
}

const ratios: Array<{ value: AspectRatio; label: string }> = [
    { value: '1:1', label: 'Square · 1:1' },
    { value: '4:3', label: 'Landscape · 4:3' },
    { value: '3:4', label: 'Portrait · 3:4' },
    { value: '16:9', label: 'Wide · 16:9' },
    { value: '9:16', label: 'Tall · 9:16' },
];

export const ProductParameterForm: React.FC<ProductParameterFormProps> = ({
    prompt,
    negativePrompt = '',
    batchSize,
    aspectRatio,
    isSubmitting = false,
    error,
    onPromptChange,
    onNegativePromptChange,
    onBatchSizeChange,
    onAspectRatioChange,
    onSubmit,
}) => (
    <form
        className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"
        onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
        noValidate
    >
        <div>
            <div className="flex items-center justify-between">
                <label htmlFor="product-prompt" className="text-xs font-medium text-zinc-300">Product description <span aria-hidden="true">*</span></label>
                <span className="text-[10px] text-zinc-600">{prompt.length}/2000</span>
            </div>
            <textarea
                id="product-prompt"
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                required
                aria-required="true"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'product-prompt-error' : 'product-prompt-help'}
                placeholder="A compact desktop speaker with a perforated aluminum shell…"
                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm leading-6 text-white outline-none transition focus:border-violet-400"
            />
            <p id="product-prompt-help" className="mt-1 text-[10px] leading-4 text-zinc-600">Describe the object, materials, proportions, and intended point of view.</p>
            {error && <p id="product-prompt-error" role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
            <div>
                <label htmlFor="product-aspect-ratio" className="text-xs font-medium text-zinc-300">Output ratio</label>
                <select id="product-aspect-ratio" value={aspectRatio} onChange={(event) => onAspectRatioChange(event.target.value as AspectRatio)} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400">
                    {ratios.map((ratio) => <option key={ratio.value} value={ratio.value}>{ratio.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="product-batch-size" className="text-xs font-medium text-zinc-300">Concepts per batch</label>
                <select id="product-batch-size" value={batchSize} onChange={(event) => onBatchSizeChange(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400">
                    {[1, 2, 4, 8].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'concept' : 'concepts'}</option>)}
                </select>
            </div>
        </div>

        <div>
            <label htmlFor="product-negative-prompt" className="text-xs font-medium text-zinc-300">Avoid <span className="text-zinc-600">(optional)</span></label>
            <input id="product-negative-prompt" value={negativePrompt} onChange={(event) => onNegativePromptChange?.(event.target.value)} placeholder="text, watermark, distorted geometry" className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" />
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60">
            {isSubmitting ? 'Preparing concepts…' : 'Generate concepts'}
        </button>
        <p className="text-center text-[10px] text-zinc-600">Enter submits the form · results remain linked to this prompt</p>
    </form>
);
