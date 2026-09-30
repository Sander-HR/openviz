import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal, Plus, RefreshCw, Shuffle, X } from 'lucide-react';
import { StudioPanelFrame } from './StudioPanelFrame';
import { useStore } from '../../store/useStore';
import { renderService } from '../../services/renderService';
import { ColorPicker } from './ColorPicker';
import { normalizeHex } from '../../utils/colorUtils';
import { createLocalComfyTarget } from '../../services/ai/targets/localComfyTarget';
import { createOpenAIImageTarget } from '@/services/ai/targets/openAIImageTarget';
import { useProductGeneration } from '../product-design/hooks/useProductGeneration';
import { generateUUID } from '../../utils/uuid';

type VariationMode = 'form' | 'color';

type VariationPreset = {
    name: string;
    horizontal: [string, string];
    vertical: [string, string];
};

const variationPresets: VariationPreset[] = [
    { name: 'Expression', horizontal: ['Geometric', 'Organic'], vertical: ['Complex', 'Simple'] },
    { name: 'Proportion', horizontal: ['Narrow', 'Wide'], vertical: ['Tall', 'Short'] },
    { name: 'Massing', horizontal: ['Light', 'Heavy'], vertical: ['Airy', 'Dense'] },
    { name: 'Edge Quality', horizontal: ['Soft', 'Sharp'], vertical: ['Rounded', 'Angular'] },
    { name: 'Symmetry & Balance', horizontal: ['Symmetrical', 'Asymmetrical'], vertical: ['Stable', 'Dynamic'] },
    { name: 'Flow / Continuity', horizontal: ['Smooth', 'Faceted'], vertical: ['Flowing', 'Broken'] },
    { name: 'Custom', horizontal: ['Geometric', 'Organic'], vertical: ['Complex', 'Simple'] },
];

const colorPresets = [
    { name: 'Modern Industrial', colors: ['#111111', '#52627b', '#9fa8d0', '#313236'] },
    { name: 'Soft Pink', colors: ['#f9e6eb', '#f7bac9', '#f29ab4', '#ef668c'] },
    { name: 'Autumn Harvest', colors: ['#851d1d', '#c29a58', '#4c2c1b', '#9f5b2c', '#ffebb2'] },
    { name: 'Midnight Oasis', colors: ['#102131', '#1c304b', '#466381', '#91a3ba', '#e7e8e2'] },
    { name: 'Coastal Breeze', colors: ['#d5f3f6', '#a4e3eb', '#86d7e2', '#4ac1d6', '#079ac2'] },
];

const clamp = (value: number) => Math.max(0, Math.min(100, value));

interface VariationPanelProps {
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export const VariationPanel: React.FC<VariationPanelProps> = ({ collapsed, onCollapsedChange }) => {
    const { project, renderSettings, setRenderPrompt, setRendering, isRendering, addRenderResultGroup, setResultsPanelOpen, computeSettings, currentProjectId, activeProductReferenceId, productReferences, upsertProductVariantSet } = useStore();
    const [mode, setMode] = useState<VariationMode>('form');
    const [presetIndex, setPresetIndex] = useState(0);
    const [horizontal, setHorizontal] = useState(50);
    const [vertical, setVertical] = useState(50);
    const [customLabels, setCustomLabels] = useState(variationPresets[6]);
    const [outputs, setOutputs] = useState(1);
    const [palette, setPalette] = useState(colorPresets[0].colors);
    const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
    const [selectedPreset, setSelectedPreset] = useState(colorPresets[0].name);
    const [outputsMenuOpen, setOutputsMenuOpen] = useState(false);
    const [editingLabel, setEditingLabel] = useState<{ axis: 'horizontal' | 'vertical'; index: 0 | 1 } | null>(null);
    const outputsMenuRef = useRef<HTMLDivElement>(null);
    const adapter = useMemo(() => {
        if (computeSettings.protocol === 'openai-image' && computeSettings.imageApiEndpoint) {
            return createOpenAIImageTarget({
                id: 'image-api',
                endpoint: computeSettings.imageApiEndpoint,
                model: computeSettings.imageApiModel,
                apiKey: computeSettings.imageApiKey,
                keyless: computeSettings.imageApiKeyless,
                size: computeSettings.imageApiSize,
            });
        }
        return computeSettings.targetKind === 'local' && computeSettings.localEndpoint
            ? createLocalComfyTarget({ id: 'local', endpoint: computeSettings.localEndpoint })
            : null;
    }, [computeSettings]);
    const generation = useProductGeneration({ adapter, targetKind: computeSettings.targetKind, targetId: computeSettings.targetKind, projectId: currentProjectId ?? undefined });
    const activeReference = activeProductReferenceId ? productReferences[activeProductReferenceId] : undefined;
    const variationAreaRef = useRef<HTMLDivElement>(null);
    const activePreset = presetIndex === variationPresets.length - 1 ? customLabels : variationPresets[presetIndex];

    useEffect(() => {
        if (!outputsMenuOpen) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (outputsMenuRef.current && !outputsMenuRef.current.contains(event.target as Node)) setOutputsMenuOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOutputsMenuOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [outputsMenuOpen]);

    const updateLabel = (axis: 'horizontal' | 'vertical', index: 0 | 1, value: string) => {
        if (presetIndex === variationPresets.length - 1) {
            setCustomLabels((current) => ({ ...current, [axis]: index === 0 ? [value, current[axis][1]] : [current[axis][0], value] }));
        } else {
            const source = variationPresets[presetIndex];
            const next: VariationPreset = { name: 'Custom', horizontal: [...source.horizontal], vertical: [...source.vertical] };
            next[axis][index] = value;
            setCustomLabels(next);
            setPresetIndex(variationPresets.length - 1);
        }
    };

    const renderEditableLabel = (axis: 'horizontal' | 'vertical', index: 0 | 1, className: string) => {
        const isEditing = editingLabel?.axis === axis && editingLabel.index === index;
        if (isEditing) {
            return (
                <input
                    autoFocus
                    defaultValue={activePreset[axis][index]}
                    onBlur={(event) => { updateLabel(axis, index, event.target.value.trim() || activePreset[axis][index]); setEditingLabel(null); }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                        if (event.key === 'Escape') { event.stopPropagation(); setEditingLabel(null); }
                    }}
                    className="w-24 rounded border border-viz-accent bg-viz-surface px-1 py-0.5 text-[10px] leading-none text-white outline-none"
                />
            );
        }
        return (
            <button type="button" onClick={() => setEditingLabel({ axis, index })} className={`cursor-text whitespace-nowrap rounded px-1 text-[10px] leading-none text-white/70 hover:bg-white/10 hover:text-white ${className}`}>
                {activePreset[axis][index]}
            </button>
        );
    };

    const updateColor = (color: string) => {
        if (selectedColorIndex === null) return;
        const normalized = normalizeHex(color);
        if (!normalized) return;
        setPalette((current) => current.map((value, index) => index === selectedColorIndex ? normalized : value));
    };

    const applyColorPreset = (preset: typeof colorPresets[number]) => {
        setPalette(preset.colors);
        setSelectedPreset(preset.name);
        setSelectedColorIndex(null);
    };

    const shufflePalette = () => setPalette((current) => [...current].sort(() => Math.random() - 0.5));

    const commitPosition = (nextHorizontal: number, nextVertical: number) => {
        const resolvedHorizontal = clamp(nextHorizontal);
        const resolvedVertical = clamp(nextVertical);
        setHorizontal(resolvedHorizontal);
        setVertical(resolvedVertical);
        const horizontalLabel = resolvedHorizontal < 50 ? activePreset.horizontal[0] : activePreset.horizontal[1];
        const verticalLabel = resolvedVertical < 50 ? activePreset.vertical[0] : activePreset.vertical[1];
        setRenderPrompt(`${activePreset.name}: ${verticalLabel}, ${horizontalLabel}`);
    };

    const updatePosition = (clientX: number, clientY: number) => {
        const bounds = variationAreaRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width === 0 || bounds.height === 0) return;
        const nextHorizontal = clamp(((clientX - bounds.left) / bounds.width) * 100);
        const nextVertical = clamp(((clientY - bounds.top) / bounds.height) * 100);
        commitPosition(nextHorizontal, nextVertical);
    };

    const handleGenerate = async () => {
        if (mode === 'color') {
            if (!activeReference) return;
            try {
                const submitted = await generation.generateVariants({
                    prompt: `Explore coordinated colorways using palette ${palette.join(', ')}. Preserve the product form, materials, lighting, and camera.`,
                    referenceAssetId: activeReference.assetId,
                    values: palette,
                    variableType: 'color',
                    width: project.canvas.width,
                    height: project.canvas.height,
                });
                upsertProductVariantSet({ id: generateUUID(), referenceId: activeReference.id, variableType: 'color', requestedValues: palette, jobIds: [submitted.id], status: 'pending', createdAt: Date.now(), updatedAt: Date.now() });
                setResultsPanelOpen(true);
            } catch (error) {
                console.error('Color variation generation failed', error);
            }
            return;
        }
        if (isRendering || !renderSettings.prompt.trim()) return;
        setRendering(true);
        try {
            const canvasData = (window as { getFlattenedCanvas?: () => string }).getFlattenedCanvas?.() ?? '';
            const response = await renderService.generate({
                ...renderSettings,
                numImages: outputs,
                init_image: canvasData,
                width: project.canvas.width,
                height: project.canvas.height,
            });
            if (response.success && response.images.length > 0) {
                addRenderResultGroup({ ...renderSettings, numImages: outputs }, response.images, project.canvas.width, project.canvas.height);
                setResultsPanelOpen(true);
            }
        } catch (error) {
            console.error('Variation generation failed', error);
        } finally {
            setRendering(false);
        }
    };

    return (
        <StudioPanelFrame title="Variation" className="flex-1" collapsed={collapsed} onCollapsedChange={onCollapsedChange}>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                <div className="grid grid-cols-2 rounded-lg bg-viz-surface p-1" role="tablist" aria-label="Variation type">
                    {(['form', 'color'] as const).map((tab) => (
                        <button key={tab} type="button" role="tab" aria-selected={mode === tab} onClick={() => setMode(tab)} className={`min-h-8 rounded-md text-xs font-medium capitalize transition ${mode === tab ? 'bg-white/10 text-white' : 'text-viz-muted hover:text-white'}`}>{tab[0].toUpperCase() + tab.slice(1)}</button>
                    ))}
                </div>

                {mode === 'form' && <div ref={variationAreaRef} className="relative mt-4 aspect-square overflow-hidden rounded-lg border border-viz-border bg-viz-surface" role="group" aria-label="form variation controls">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
                    <div className="absolute inset-y-0 left-1/3 w-px bg-white/5" />
                    <div className="absolute inset-y-0 left-2/3 w-px bg-white/5" />
                    <div className="absolute inset-x-0 top-1/3 h-px bg-white/5" />
                    <div className="absolute inset-x-0 top-2/3 h-px bg-white/5" />
                    <span className="absolute left-1/2 top-2 flex h-4 -translate-x-1/2 items-center justify-center">{renderEditableLabel('vertical', 0, '')}</span>
                    <span className="absolute bottom-2 left-1/2 flex h-4 -translate-x-1/2 items-center justify-center">{renderEditableLabel('vertical', 1, '')}</span>
                    <span className="absolute left-2 top-1/2 -translate-y-1/2"><span className="flex h-4 w-4 items-center justify-center overflow-visible">{renderEditableLabel('horizontal', 0, '-rotate-90')}</span></span>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2"><span className="flex h-4 w-4 items-center justify-center overflow-visible">{renderEditableLabel('horizontal', 1, 'rotate-90')}</span></span>
                    <button type="button" role="slider" aria-label="Form variation position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(horizontal)} aria-valuetext={`${activePreset.vertical[vertical < 50 ? 0 : 1]}, ${activePreset.horizontal[horizontal < 50 ? 0 : 1]}`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updatePosition(event.clientX, event.clientY); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePosition(event.clientX, event.clientY); }} onKeyDown={(event) => { const step = event.shiftKey ? 10 : 25; if (event.key === 'ArrowLeft') commitPosition(horizontal - step, vertical); if (event.key === 'ArrowRight') commitPosition(horizontal + step, vertical); if (event.key === 'ArrowUp') commitPosition(horizontal, vertical - step); if (event.key === 'ArrowDown') commitPosition(horizontal, vertical + step); }} className="absolute h-7 w-7 touch-none cursor-grab -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-viz-accent shadow-lg shadow-viz-accent/30 active:cursor-grabbing" style={{ left: `${horizontal}%`, top: `${vertical}%` }} />
                </div>}

                {mode === 'color' && <div className="mt-4 space-y-4" role="group" aria-label="color variation controls">
                    <div className="flex items-center justify-between">
                        <div><p className="text-[10px] font-medium text-white/80">Color Palette</p><p className="mt-1 text-[9px] text-white/35">Adjust the extracted colorway</p></div>
                        <div className="flex items-center gap-1"><button type="button" aria-label="Shuffle palette" onClick={shufflePalette} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"><Shuffle size={14} /></button><button type="button" aria-label="Refresh palette" onClick={() => applyColorPreset(colorPresets[0])} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"><RefreshCw size={14} /></button></div>
                    </div>
                    <div className="rounded-lg border border-viz-border bg-viz-surface p-3">
                        <div className="flex h-16 overflow-hidden rounded-md border border-viz-border">
                            {palette.map((color, index) => <button key={`${color}-${index}`} type="button" aria-label={`Edit palette color ${index + 1}`} onClick={() => setSelectedColorIndex(index)} className={`relative min-w-0 flex-1 transition ${selectedColorIndex === index ? 'z-10 ring-2 ring-inset ring-white' : 'hover:brightness-110'}`} style={{ backgroundColor: color }}><span className="sr-only">{color}</span></button>)}
                            {palette.length < 8 && <button type="button" aria-label="Add palette color" onClick={() => setPalette((current) => [...current, '#ffffff'])} className="flex w-12 shrink-0 items-center justify-center bg-white/10 text-white/70 hover:bg-white/20 transition-colors"><Plus size={16} /></button>}
                        </div>
                        <div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-white/35">{palette.length} colors</span><button type="button" aria-label="Remove selected palette color" disabled={selectedColorIndex === null || palette.length <= 1} onClick={() => { if (selectedColorIndex === null) return; setPalette((current) => current.filter((_, index) => index !== selectedColorIndex)); setSelectedColorIndex(null); }} className="flex h-7 items-center gap-1 rounded-md px-2 text-[9px] text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"><X size={12} /> Remove</button></div>
                    </div>
                    {selectedColorIndex !== null && <div className="flex justify-center"><ColorPicker color={palette[selectedColorIndex]} onChange={updateColor} /></div>}
                    <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-[10px] text-white/45">Presets</span><MoreHorizontal size={14} className="text-white/35" /></div><div className="space-y-2">{colorPresets.map((preset) => <button key={preset.name} type="button" onClick={() => applyColorPreset(preset)} className={`flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition ${selectedPreset === preset.name ? 'bg-white/10' : 'hover:bg-white/5'}`}><span className="flex h-7 flex-1 overflow-hidden rounded-md">{preset.colors.map((color) => <span key={color} className="min-w-0 flex-1" style={{ backgroundColor: color }} />)}</span><span className="w-24 truncate text-[9px] text-white/55">{preset.name}</span></button>)}</div></div>
                </div>}

                {mode === 'form' && <div className="mt-4 flex items-center gap-2 text-white/60">
                    <label htmlFor="variation-preset" className="text-[10px]">Presets</label>
                    <select id="variation-preset" value={presetIndex} onChange={(event) => setPresetIndex(Number(event.target.value))} className="min-h-8 min-w-0 flex-1 rounded-lg border border-viz-border bg-viz-surface px-3 text-xs text-white outline-none focus:ring-1 focus:ring-viz-accent">
                        {variationPresets.map((preset, index) => <option key={preset.name} value={index}>{preset.name}</option>)}
                    </select>
                </div>}
            </div>
            <div className="flex shrink-0 gap-3 p-3">
                <div ref={outputsMenuRef} className="relative">
                    <button type="button" aria-label="Number of outputs" aria-haspopup="menu" aria-expanded={outputsMenuOpen} onClick={() => setOutputsMenuOpen((open) => !open)} className="flex h-8 min-w-12 items-center justify-between gap-1 rounded-lg bg-viz-surface px-3 text-xs font-medium text-white/90 hover:bg-white/10 transition-colors">{outputs}<ChevronDown size={13} /></button>
                    {outputsMenuOpen && <div role="menu" aria-label="Number of outputs" className="absolute bottom-full left-0 z-50 mb-1 w-24 overflow-hidden rounded-lg border border-viz-border bg-viz-panel py-1 shadow-viz">
                        {[1, 2, 4].map((count) => <button key={count} type="button" role="menuitemradio" aria-checked={outputs === count} onClick={() => { setOutputs(count); setOutputsMenuOpen(false); }} className={`flex w-full items-center justify-between px-3 py-1.5 text-xs transition ${outputs === count ? 'text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>{count} images{outputs === count && <span className="h-1.5 w-1.5 rounded-full bg-viz-accent" />}</button>)}
                    </div>}
                </div>
                <button type="button" onClick={handleGenerate} disabled={mode === 'color' ? generation.isGenerating || !activeReference : isRendering || !renderSettings.prompt.trim()} className="min-h-9 flex-1 rounded-lg bg-viz-accent text-xs font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">{mode === 'color' ? (generation.isGenerating ? 'Generating...' : 'Generate') : (isRendering ? 'Generating...' : 'Generate')}</button>
            </div>
        </StudioPanelFrame>
    );
};