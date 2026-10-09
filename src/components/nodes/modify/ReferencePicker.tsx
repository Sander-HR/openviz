import React from 'react';
import { ImageIcon, X } from 'lucide-react';

export interface ReferenceCandidate {
    assetId: string;
    label: string;
    thumbnail?: string;
}

interface ReferencePickerProps {
    open: boolean;
    candidates: ReferenceCandidate[];
    onSelect: (assetId: string) => void;
    onClose: () => void;
}

export const ReferencePicker: React.FC<ReferencePickerProps> = ({ open, candidates, onSelect, onClose }) => {
    if (!open) return null;
    return (
        <div role="dialog" aria-label="Add image reference" className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-2 pb-2">
                <h2 className="text-xs font-medium text-white">Add image reference</h2>
                <button type="button" aria-label="Close reference picker" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"><X size={13} /></button>
            </div>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {candidates.length === 0 ? <p className="p-2 text-xs text-zinc-500">No eligible image references.</p> : candidates.map((candidate) => (
                    <button key={candidate.assetId} type="button" onClick={() => onSelect(candidate.assetId)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white">
                        {candidate.thumbnail ? <img src={candidate.thumbnail} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800"><ImageIcon size={14} /></span>}
                        <span className="truncate">{candidate.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
