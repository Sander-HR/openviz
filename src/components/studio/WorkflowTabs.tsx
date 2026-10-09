import React from 'react';

export type StudioWorkflowTab = 'generate' | 'modify' | 'adjust' | 'variation' | 'legacy';

interface WorkflowTabsProps {
    active: StudioWorkflowTab;
    onChange: (tab: StudioWorkflowTab) => void;
}

const tabs: Array<{ id: StudioWorkflowTab; label: string }> = [
    { id: 'generate', label: 'Generate' },
    { id: 'modify', label: 'Modify' },
    { id: 'adjust', label: 'Adjust' },
    { id: 'variation', label: 'Variation' },
];

export const WorkflowTabs: React.FC<WorkflowTabsProps> = ({ active, onChange }) => (
    <div role="tablist" aria-label="Studio workflows" className="pointer-events-auto flex border-b border-panel-border bg-panel">
        {tabs.map((tab) => (
            <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active === tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex-1 px-1 py-2 text-[10px] font-bold uppercase tracking-wide transition ${
                    active === tab.id ? 'border-b-2 border-primary text-primary' : 'text-white/40 hover:text-white/80'
                }`}
            >
                {tab.label}
            </button>
        ))}
    </div>
);
