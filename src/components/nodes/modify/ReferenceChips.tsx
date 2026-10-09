import React from 'react';
import { Plus, X } from 'lucide-react';
import type { ProductReferenceInput } from '@/types/productWorkflow.types';

interface ReferenceChipsProps {
    references: ProductReferenceInput[];
    onRemove: (assetId: string) => void;
    onAdd: () => void;
}

export const ReferenceChips: React.FC<ReferenceChipsProps> = ({ references, onRemove, onAdd }) => (
    <div className="flex flex-wrap items-center gap-2" aria-label="Image references">
        {references.map((reference) => (
            <span key={reference.assetId} className="inline-flex items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-950/40 px-2 py-1 text-[10px] text-violet-200">
                <span>{reference.token ?? '@ref'}</span>
                <span className="text-violet-300/70">{reference.role}</span>
                <button
                    type="button"
                    aria-label={`Remove ${reference.token ?? '@ref'} reference`}
                    onClick={() => onRemove(reference.assetId)}
                    className="rounded p-0.5 hover:bg-violet-500/30"
                >
                    <X size={10} />
                </button>
            </span>
        ))}
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-2 py-1 text-[10px] text-zinc-500 hover:border-violet-500 hover:text-zinc-300">
            <Plus size={10} /> Add reference
        </button>
    </div>
);
