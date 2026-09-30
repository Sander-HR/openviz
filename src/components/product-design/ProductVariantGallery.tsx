import React from 'react';
import { Check, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { GenerationJob, GenerationJobOutput } from '@/types/generationJob.types';

interface ProductVariantGalleryProps {
    jobs: GenerationJob[];
    onSelectReference: (job: GenerationJob, output: GenerationJobOutput) => void;
}

function statusLabel(status: GenerationJob['status']): string {
    if (status === 'completed') return 'Ready';
    if (status === 'partial') return 'Partial batch';
    if (status === 'failed') return 'Needs attention';
    if (status === 'cancelled') return 'Cancelled';
    return status === 'running' ? 'Generating' : 'Queued';
}

export const ProductVariantGallery: React.FC<ProductVariantGalleryProps> = ({ jobs, onSelectReference }) => {
    const outputs = jobs.flatMap((job) => job.outputs.map((output) => ({ job, output })));
    if (outputs.length === 0) {
        return <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center text-sm text-zinc-600" role="status">Your concept board will appear here.</div>;
    }

    return (
        <section aria-labelledby="concept-results-title" className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Output board</p>
                    <h2 id="concept-results-title" className="mt-1 text-lg font-semibold text-white">Choose a reference</h2>
                </div>
                <span className="text-xs text-zinc-600" role="status" aria-live="polite">{outputs.length} result{outputs.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-live="polite">
                {outputs.map(({ job, output }, index) => {
                    const ready = job.status === 'completed' || job.status === 'partial';
                    return (
                        <article key={`${job.id}-${output.index}`} className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                            <div className="relative aspect-square bg-zinc-900">
                                {output.contentType?.startsWith('video') ? <video src={output.url} controls className="h-full w-full object-cover" aria-label={`Generated concept ${index + 1}`} /> : <img src={output.url} alt={`Generated product concept ${index + 1}`} className="h-full w-full object-cover" />}
                                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] text-zinc-200">
                                    {job.status === 'running' ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : job.status === 'failed' ? <TriangleAlert size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
                                    {statusLabel(job.status)}
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 p-2">
                                <span className="truncate text-[10px] text-zinc-500">{job.modelTier.toUpperCase()} · {job.workflowId}</span>
                                <button type="button" disabled={!ready} onClick={() => onSelectReference(job, output)} aria-label={`Select concept ${index + 1}`} className="shrink-0 rounded-lg bg-violet-500 px-2 py-1.5 text-[10px] font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-30">Use</button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};
