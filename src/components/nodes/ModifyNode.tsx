import React, { useState } from 'react';
import { useConnection } from '@xyflow/react';
import { ChevronDown, ImageIcon, Layers, Wand2 } from 'lucide-react';
import type { ModifyNode as ModifyNodeType } from '@/types';
import { cn, nodeCardClass, NodeCardHeader, nodeCardBodyClass, NodeTargetHandle } from './nodeUi';
import { ReferenceChips } from './modify/ReferenceChips';

interface ModifyNodeData extends ModifyNodeType {
    onGenerate?: (nodeId: string) => void;
    onDataChange?: (nodeId: string, data: Partial<ModifyNodeType['data']>) => void;
}

interface ModifyNodeProps {
    id: string;
    data: ModifyNodeData;
    selected: boolean;
}

const modes = [
    { id: 'product_edit', label: 'Product edit' },
    { id: 'material_study', label: 'Material & color' },
    { id: 'sketch_to_render', label: 'Sketch to render' },
    { id: 'product_background', label: 'Background' },
];

export const ModifyNode: React.FC<ModifyNodeProps> = ({ id, data, selected }) => {
    const connection = useConnection();
    const [settings, setSettings] = useState(data.data);
    const [showModes, setShowModes] = useState(false);
    const isConnectable = connection.inProgress && connection.fromNode?.type === 'imageNode';
    const canGenerate = settings.prompt.trim().length > 0 && settings.references.length > 0 && settings.status !== 'rendering';

    const updateSettings = (updates: Partial<ModifyNodeType['data']>) => {
        const next = { ...settings, ...updates };
        setSettings(next);
        data.onDataChange?.(id, updates);
    };

    return (
        <div className={cn(nodeCardClass(selected), isConnectable && 'border-viz-accent')}>
            <NodeTargetHandle id="modify-target-visible" selected={selected} />

            <NodeCardHeader icon={Wand2} label="Modify" badge={<span className="rounded-full bg-viz-surface px-2 py-1 text-[10px] font-medium text-viz-muted">AI EDIT</span>} />

            <div className={nodeCardBodyClass()}>
                <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Source</span>
                    <div className="flex items-center gap-2 rounded-xl border border-[#333] bg-[#2a2a2a] p-2">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[#444]">
                            <ImageIcon size={16} className="text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-white">
                                {settings.references[0]?.token ?? 'Connect an image'}
                            </p>
                            <p className="text-[10px] text-gray-500">Primary product reference</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor={`${id}-prompt`} className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            What should change?
                        </label>
                        <span className="text-[10px] text-gray-600">{settings.prompt.length}/2000</span>
                    </div>
                    <textarea
                        id={`${id}-prompt`}
                        value={settings.prompt}
                        onChange={(event) => updateSettings({ prompt: event.target.value })}
                        onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canGenerate) {
                                event.preventDefault();
                                data.onGenerate?.(id);
                            }
                            event.stopPropagation();
                        }}
                        placeholder="Replace the plastic housing with brushed aluminum..."
                        aria-describedby={`${id}-prompt-help`}
                        className="nodrag nowheel min-h-[92px] w-full resize-none rounded-xl border border-[#333] bg-[#2a2a2a] p-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-[#8b5cf6]"
                    />
                    <p id={`${id}-prompt-help`} className="text-[10px] text-gray-500">
                        Start with a direct action and say what should stay unchanged.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <label htmlFor={`${id}-mode`} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Mode</label>
                        <button
                            id={`${id}-mode`}
                            type="button"
                            aria-expanded={showModes}
                            aria-haspopup="listbox"
                            onClick={(event) => {
                                event.stopPropagation();
                                setShowModes((visible) => !visible);
                            }}
                            className="flex w-full items-center justify-between rounded-lg border border-[#333] bg-[#2a2a2a] px-3 py-2 text-left text-xs text-white hover:border-gray-500"
                        >
                            <span className="truncate">{modes.find((mode) => mode.id === settings.workflowId)?.label ?? 'Product edit'}</span>
                            <ChevronDown size={12} className="text-gray-500" />
                        </button>
                        {showModes && (
                            <div role="listbox" className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-lg border border-[#333] bg-[#2a2a2a] shadow-xl">
                                {modes.map((mode) => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        role="option"
                                        aria-selected={settings.workflowId === mode.id}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            updateSettings({ workflowId: mode.id });
                                            setShowModes(false);
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#3a3a3a] hover:text-white"
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label htmlFor={`${id}-ratio`} className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Ratio</label>
                        <select
                            id={`${id}-ratio`}
                            value={settings.aspectRatio}
                            onChange={(event) => updateSettings({ aspectRatio: event.target.value as ModifyNodeType['data']['aspectRatio'] })}
                            className="nodrag nowheel w-full rounded-lg border border-[#333] bg-[#2a2a2a] px-3 py-2 text-xs text-white outline-none focus:border-[#8b5cf6]"
                        >
                            <option value="square">Original / 1:1</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor={`${id}-preservation`} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <Layers size={11} /> Preserve structure
                        </label>
                        <span className="font-mono text-xs text-[#a78bfa]">{Math.round(settings.preservation * 100)}%</span>
                    </div>
                    <input
                        id={`${id}-preservation`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings.preservation}
                        onChange={(event) => updateSettings({ preservation: Number(event.target.value) })}
                        className="nodrag nowheel h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#2a2a2a] accent-[#8b5cf6]"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600"><span>Creative</span><span>Precise</span></div>
                </div>

                <ReferenceChips
                    references={settings.references}
                    onRemove={(assetId) => updateSettings({ references: settings.references.filter((reference) => reference.assetId !== assetId) })}
                    onAdd={() => undefined}
                />

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        if (canGenerate) data.onGenerate?.(id);
                    }}
                    disabled={!canGenerate}
                    className={cn(
                        'nodrag w-full rounded-xl py-3 font-bold text-white shadow-lg transition-all',
                        canGenerate ? 'bg-[#8b5cf6] shadow-purple-500/20 hover:bg-[#7c3aed]' : 'cursor-not-allowed bg-[#333] text-gray-500'
                    )}
                >
                    {settings.status === 'rendering' ? 'Generating...' : 'Generate'}
                </button>
                <p className="text-center text-[10px] text-gray-600">Press ⌘/Ctrl + Enter to generate</p>
            </div>
        </div>
    );
};
