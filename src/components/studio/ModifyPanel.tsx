import React, { useState } from 'react';
import { ChevronDown, MoreHorizontal, Sparkles, Shuffle, Wand2 } from 'lucide-react';
import { PromptComposerCard } from './PromptComposerCard';

interface ModifyPanelProps {
    height: number;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    referenceImage?: string;
    onGenerate?: (prompt: string) => void;
    onAction?: (action: ModifyAction) => void;
}

export type ModifyAction = 'instant-render' | 'new-view' | 'variate-form-and-color';

const actions: Array<{ id: ModifyAction; label: string; icon: React.ElementType }> = [
    { id: 'instant-render', label: 'Instant Render', icon: Sparkles },
    { id: 'new-view', label: 'New view', icon: Wand2 },
    { id: 'variate-form-and-color', label: 'Variate form and color', icon: Shuffle },
];

export const ModifyPanel: React.FC<ModifyPanelProps> = ({ height: _height, referenceImage, onGenerate, onAction, collapsed, onCollapsedChange }) => {
    const [prompt, setPrompt] = useState('');
    const [outputs, setOutputs] = useState(1);
    const [mode, setMode] = useState('Standard');
    const [selectedAction, setSelectedAction] = useState<ModifyAction | null>(null);
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCollapsed = collapsed ?? internalCollapsed;
    const setCollapsed = (nextCollapsed: boolean) => {
        onCollapsedChange?.(nextCollapsed);
        if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    };

    const handleAction = (action: ModifyAction) => {
        setSelectedAction(action);
        onAction?.(action);
        if (prompt.trim()) onGenerate?.(prompt.trim());
    };

    return (
        <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl2 border border-viz-border bg-viz-panel text-white shadow-viz"
            onSubmit={(event) => {
                event.preventDefault();
                if (prompt.trim()) onGenerate?.(prompt.trim());
            }}
        >
            <header className="flex h-10 shrink-0 items-center justify-between px-3">
                <button type="button" aria-expanded={!isCollapsed} aria-controls="studio-modify-content" onClick={() => setCollapsed(!isCollapsed)} className="flex h-full items-center gap-2 text-left">
                    <ChevronDown size={14} strokeWidth={2} className={`text-viz-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                    <h2 className="text-xs font-semibold">Modify</h2>
                </button>
                <button type="button" aria-label="Modify menu" className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white"><MoreHorizontal size={16} aria-hidden="true" /></button>
            </header>
            {!isCollapsed && <div id="studio-modify-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 custom-scrollbar">
                <PromptComposerCard id="studio-modify-prompt" label="Modify prompt" value={prompt} onChange={setPrompt} onSubmit={() => { if (prompt.trim()) onGenerate?.(prompt.trim()); }} />
                {referenceImage && <div className="mt-3 flex items-center gap-2 text-xs text-viz-muted"><img src={referenceImage} alt="Product reference" className="h-8 w-8 rounded object-cover" /><span>Selected product reference</span></div>}
                <label htmlFor="studio-modify-outputs" className="mt-4 flex items-center justify-between text-xs"><span className="text-white/90">Outputs</span><select id="studio-modify-outputs" value={outputs} onChange={(event) => setOutputs(Number(event.target.value))} className="h-8 rounded-lg bg-viz-surface px-3 text-xs font-medium text-white outline-none"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
                <label htmlFor="studio-modify-mode" className="mt-3 flex items-center justify-between text-xs"><span className="text-white/90">Mode</span><select id="studio-modify-mode" value={mode} onChange={(event) => setMode(event.target.value)} className="h-8 rounded-lg bg-viz-surface px-3 text-xs font-medium text-white outline-none"><option>Standard</option><option>Precise</option><option>Creative</option></select></label>
                <div className="my-5 h-px bg-white/10" />
                <div className="space-y-0.5" aria-label="Modify actions">
                    {actions.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={selectedAction === id} onClick={() => handleAction(id)} className={`flex min-h-9 w-full items-center gap-3 rounded-lg px-2 text-left text-xs transition-colors ${selectedAction === id ? 'bg-viz-accent text-white' : 'text-white/85 hover:bg-white/10'}`}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}
                </div>
            </div>}
        </form>
    );
};
