import React from 'react';
import {
    Plus,
    Eye,
    EyeOff,
    GripVertical,
    MoreVertical,
    ChevronDown
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Reorder } from 'framer-motion';
import { LayerDropdown } from './LayerDropdown';
import { LayerPanelCanvasSettings } from './LayerPanelCanvasSettings';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const LayerPanel: React.FC = () => {
    const {
        project,
        activeLayerId,
        addLayer,
        setActiveLayer,
        updateLayer,
        reorderLayers,
        setName
    } = useStore();
    const panelRef = React.useRef<HTMLDivElement>(null);
    const [dropdownLayerId, setDropdownLayerId] = React.useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = React.useState<{ x: number, y: number }>({ x: 0, y: 0 });

    const sortedLayers = [...project.layers].reverse();

    return (
        <div
            ref={panelRef}
            className="w-60 flex flex-col bg-panel border border-panel-border rounded-panel shadow-2xl overflow-hidden h-fit max-h-[calc(100vh-120px)] backdrop-blur-md bg-opacity-95 pointer-events-auto"
        >
            {/* Project Header */}
            <div className="p-2.5 border-b border-panel-border flex items-center justify-between group">
                <div className="flex flex-col">
                    <input
                        className="bg-transparent text-white font-bold text-base outline-none border-b border-transparent focus:border-primary transition-colors w-full"
                        value={project.name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <button className="text-text-secondary hover:text-white transition-colors">
                    <ChevronDown size={18} />
                </button>
            </div>

            {/* Layers Header */}
            <div className="px-3 py-2 flex items-center justify-between">
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider opacity-60">Layers</h3>
                <button
                    onClick={() => addLayer()}
                    className="p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Layer List */}
            <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
                <Reorder.Group
                    axis="y"
                    values={sortedLayers}
                    onReorder={(newOrder) => {
                        const movedItem = sortedLayers.find((layer, i) => layer.id !== newOrder[i].id);
                        if (!movedItem) return;

                        const newIdxInSorted = newOrder.indexOf(movedItem);
                        const oldIdxInSorted = sortedLayers.indexOf(movedItem);

                        if (newIdxInSorted === oldIdxInSorted) return;

                        const oldIdx = (project.layers.length - 1) - oldIdxInSorted;
                        const newIdx = (project.layers.length - 1) - newIdxInSorted;

                        reorderLayers(oldIdx, newIdx);
                    }}
                    className="space-y-1"
                >
                    {sortedLayers.map((layer) => (
                        <Reorder.Item
                            key={layer.id}
                            value={layer}
                            onClick={() => setActiveLayer(layer.id)}
                            layout
                            className={cn(
                                "group flex items-center gap-2 p-1.5 rounded-lg cursor-pointer border",
                                activeLayerId === layer.id
                                    ? "bg-primary/20 border-primary/40"
                                    : "border-transparent hover:bg-neutral-800/50"
                            )}
                        >
                            <div className="text-text-secondary group-hover:text-white cursor-grab active:cursor-grabbing">
                                <GripVertical size={14} />
                            </div>

                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded bg-neutral-900 border border-panel-border flex items-center justify-center overflow-hidden checkerboard relative shrink-0">
                                {layer.thumbnail ? (
                                    <img
                                        src={layer.thumbnail}
                                        alt={layer.name}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-[10px] text-text-secondary uppercase opacity-40">
                                        {layer.type === 'sketch' ? 'SK' : 'IMG'}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <input
                                    className="bg-transparent text-white text-xs outline-none w-full border-b border-transparent focus:border-primary/50"
                                    value={layer.name}
                                    onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] text-text-secondary uppercase">{layer.blendMode}</span>
                                    <span className="text-[9px] text-text-secondary">{layer.opacity}%</span>
                                </div>
                            </div>

                            <div className={cn(
                                "flex items-center gap-0.5 transition-opacity",
                                layer.visible ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                            )}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateLayer(layer.id, { visible: !layer.visible });
                                    }}
                                    className="p-1 text-text-secondary hover:text-white"
                                >
                                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-red-500" />}
                                </button>
                                <button
                                    className="p-1 text-text-secondary hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const buttonRect = e.currentTarget.getBoundingClientRect();
                                        const panelRect = panelRef.current?.getBoundingClientRect();

                                        setDropdownPos({
                                            x: panelRect ? panelRect.right + 8 : buttonRect.right + 8,
                                            y: buttonRect.top
                                        });
                                        setDropdownLayerId(layer.id);
                                    }}
                                >
                                    <MoreVertical size={14} />
                                </button>
                            </div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>

                {/* Canvas Settings Layer */}
                <LayerPanelCanvasSettings />
            </div>

            {dropdownLayerId && (
                <LayerDropdown
                    layerId={dropdownLayerId}
                    position={dropdownPos}
                    onClose={() => setDropdownLayerId(null)}
                />
            )}
        </div>
    );
};
