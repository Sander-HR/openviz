import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Cuboid, Layers3, Sparkles } from 'lucide-react';
import { StudioPanelFrame } from './StudioPanelFrame';

interface Make3DPanelProps {
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

type MeshDetail = 'Low Poly' | 'Balanced' | 'Highest';

export const Make3DPanel: React.FC<Make3DPanelProps> = ({ collapsed, onCollapsedChange }) => {
    const [model, setModel] = useState('Detailed Sharp V3');
    const [meshDetail, setMeshDetail] = useState<MeshDetail>('Balanced');
    const [texture, setTexture] = useState('None');
    const [multipleLayers, setMultipleLayers] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [status, setStatus] = useState('');

    const handleGenerate = () => {
        setStatus('3D generation queued');
    };

    return (
        <StudioPanelFrame title="Make 3D" className="h-full max-h-full" collapsed={collapsed} onCollapsedChange={onCollapsedChange}>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 text-white custom-scrollbar">
                <div className="flex items-center gap-2 rounded-lg border border-viz-border bg-viz-surface p-3">
                    <Cuboid size={22} className="text-viz-accent" aria-hidden="true" />
                    <div>
                        <p className="text-xs font-semibold">Transform a drawing into 3D</p>
                        <p className="mt-1 text-[10px] leading-4 text-viz-muted">Create an interactive model with depth and dimension.</p>
                    </div>
                </div>

                <label htmlFor="make-3d-model" className="mt-5 block text-[10px] font-medium text-white/55">Mode</label>
                <select id="make-3d-model" value={model} onChange={(event) => setModel(event.target.value)} className="mt-2 min-h-9 w-full rounded-lg border border-viz-border bg-viz-surface px-3 text-xs text-white outline-none focus:ring-1 focus:ring-viz-accent">
                    <option>Detailed Sharp V3</option>
                    <option>Fast Preview</option>
                    <option>Organic Surface V2</option>
                </select>

                <button type="button" aria-pressed={multipleLayers} onClick={() => setMultipleLayers((value) => !value)} className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-lg border border-viz-border bg-viz-surface px-3 text-left transition hover:bg-white/10">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${multipleLayers ? 'bg-viz-accent text-white' : 'bg-white/10 text-viz-muted'}`}><Layers3 size={16} aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block text-[10px] font-medium">Make 3D from multiple layers</span><span className="mt-1 block truncate text-[9px] text-white/40">{multipleLayers ? 'Using selected layers as source' : 'Using entire canvas as source'}</span></span>
                </button>

                <fieldset className="mt-5">
                    <legend className="text-[10px] font-medium text-white/55">Mesh detail</legend>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {(['Low Poly', 'Balanced', 'Highest'] as const).map((detail) => <button key={detail} type="button" aria-pressed={meshDetail === detail} onClick={() => setMeshDetail(detail)} className={`min-h-9 rounded-lg border px-1 text-[10px] transition ${meshDetail === detail ? 'border-viz-accent bg-viz-accent/20 text-white' : 'border-viz-border bg-viz-surface text-viz-muted hover:text-white'}`}>{detail}</button>)}
                    </div>
                </fieldset>

                <label htmlFor="make-3d-texture" className="mt-5 block text-[10px] font-medium text-white/55">Texture</label>
                <select id="make-3d-texture" value={texture} onChange={(event) => setTexture(event.target.value)} className="mt-2 min-h-9 w-full rounded-lg border border-viz-border bg-viz-surface px-3 text-xs text-white outline-none focus:ring-1 focus:ring-viz-accent">
                    <option>None</option>
                    <option>Preserve source texture</option>
                    <option>Generate material texture</option>
                </select>

                <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)} className="mt-5 flex min-h-9 w-full items-center justify-between text-left text-[10px] font-medium text-white/65 hover:text-white"><span>Advanced options</span>{advancedOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</button>
                {advancedOpen && <div className="space-y-3 border-t border-white/10 pt-3 text-[10px] text-viz-muted"><label className="flex items-center justify-between gap-3">Depth smoothing<input type="range" min="0" max="100" defaultValue="50" className="w-32 accent-viz-accent" /></label><label className="flex items-center justify-between gap-3">Auto material<input type="checkbox" defaultChecked className="h-4 w-4 accent-viz-accent" /></label></div>}
            </div>
            <div className="shrink-0 border-t border-white/10 p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] text-viz-muted"><Sparkles size={13} aria-hidden="true" /> Estimated time · ~1 min</div>
                <button type="button" onClick={handleGenerate} className="min-h-9 w-full rounded-lg bg-viz-accent text-xs font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-viz-accent/50">Generate</button>
                <p role="status" aria-live="polite" className="min-h-5 pt-2 text-center text-[10px] text-viz-muted">{status}</p>
            </div>
        </StudioPanelFrame>
    );
};