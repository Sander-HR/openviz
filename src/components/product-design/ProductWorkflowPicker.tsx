import React from 'react';
import { Boxes, Film, ImagePlus, Layers3, ScanLine, Sparkles, type LucideIcon } from 'lucide-react';
import { listProductWorkflows } from '@/services/ai/productWorkflowRegistry';
import type { ProductWorkflowCategory } from '@/types/productWorkflow.types';

interface ProductWorkflowPickerProps {
    selectedWorkflowId: string;
    onChange: (workflowId: string) => void;
}

const icons: Record<ProductWorkflowCategory, LucideIcon> = {
    concept: Sparkles,
    edit: ImagePlus,
    variant: Boxes,
    render: ScanLine,
    background: Layers3,
    animation: Film,
};

export const ProductWorkflowPicker: React.FC<ProductWorkflowPickerProps> = ({ selectedWorkflowId, onChange }) => (
    <div className="space-y-3" aria-label="Product workflow">
        <div className="flex items-end justify-between">
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Design lab</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Choose a direction</h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">ComfyUI workflows</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3" role="tablist" aria-label="Product workflow types">
            {listProductWorkflows().map((workflow) => {
                const Icon = icons[workflow.category];
                const selected = selectedWorkflowId === workflow.id;
                return (
                    <button
                        key={workflow.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`workflow-description-${workflow.id}`}
                        onClick={() => onChange(workflow.id)}
                        className={`group rounded-xl border p-3 text-left transition ${selected ? 'border-violet-400/70 bg-violet-400/10 shadow-lg shadow-violet-950/20' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-600 hover:bg-zinc-900'}`}
                    >
                        <Icon size={16} />
                        <span className="mt-2 block text-xs font-medium text-zinc-200">{workflow.name}</span>
                        <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-zinc-500">{workflow.description}</span>
                    </button>
                );
            })}
        </div>
        {listProductWorkflows().map((workflow) => (
            <p key={workflow.id} id={`workflow-description-${workflow.id}`} hidden={selectedWorkflowId !== workflow.id} className="text-xs text-zinc-500">
                {workflow.description}
            </p>
        ))}
    </div>
);
