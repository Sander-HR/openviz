import React from 'react';
import {
    Plus,
    Eye,
    EyeOff,
    GripVertical,
    MoreVertical,
    ChevronDown
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const LayerPanel: React.FC = () => {
    const { project, activeLayerId, addLayer, setActiveLayer, updateLayer } = useStore();

    return (
        <div className="w-72 flex flex-col bg-panel border border-panel-border rounded-panel shadow-2xl overflow-hidden h-fit max-h-[calc(100vh-120px)] backdrop-blur-md bg-opacity-95">
            {/* Project Header */}
            <div className="p-4 border-b border-panel-border flex items-center justify-between group">
                <div className="flex flex-col">
                    <input
                        className="bg-transparent text-white font-bold text-lg outline-none border-b border-transparent focus:border-primary transition-colors w-full"
                        value={project.name}
                        onChange={() => { }} // TODO: implement setName
                    />
                </div>
                <button className="text-text-secondary hover:text-white transition-colors">
                    <ChevronDown size={20} />
                </button>
            </div>

            {/* Layers Header */}
            <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider opacity-60">Layers</h3>
                <button
                    onClick={() => addLayer()}
                    className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Layer List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                {[...project.layers].reverse().map((layer) => (
                    <div
                        key={layer.id}
                        onClick={() => setActiveLayer(layer.id)}
                        className={cn(
                            "group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border",
                            activeLayerId === layer.id
                                ? "bg-primary/20 border-primary/40"
                                : "border-transparent hover:bg-neutral-800/50"
                        )}
                    >
                        <div className="text-text-secondary group-hover:text-white cursor-grab active:cursor-grabbing">
                            <GripVertical size={16} />
                        </div>

                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded bg-neutral-900 border border-panel-border flex items-center justify-center overflow-hidden checkerboard relative shrink-0">
                            {layer.thumbnail ? (
                                <img
                                    src={layer.thumbnail}
                                    alt={layer.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="text-[10px] text-text-secondary uppercase opacity-40">
                                    {layer.type === 'sketch' ? 'SK' : 'IMG'}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <input
                                className="bg-transparent text-white text-sm outline-none w-full border-b border-transparent focus:border-primary/50"
                                value={layer.name}
                                onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-text-secondary uppercase">{layer.blendMode}</span>
                                <span className="text-[10px] text-text-secondary">{layer.opacity}%</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateLayer(layer.id, { visible: !layer.visible });
                                }}
                                className="p-1 text-text-secondary hover:text-white"
                            >
                                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} className="text-red-500" />}
                            </button>
                            <button className="p-1 text-text-secondary hover:text-white">
                                <MoreVertical size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LayerPanel;
