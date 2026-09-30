import React from 'react';
import {
    Plus,
    ChevronDown,
    Eye,
    EyeOff,
    MoreVertical,
    Search,
    FolderOpen,
    Users,
    User,
    FileImage
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

type LayerPanelTab = 'layers' | 'library';

const librarySources: Array<{ id: string; label: string; icon: React.ElementType }> = [
    { id: 'workspace', label: 'Workspace', icon: FolderOpen },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'my-library', label: 'My Library', icon: User },
    { id: 'this-file', label: 'This File', icon: FileImage },
];

export const LayerPanel: React.FC = () => {
    const {
        project,
        activeLayerId,
        addLayer,
        setActiveLayer,
        updateLayer,
        reorderLayers
    } = useStore();
    const panelRef = React.useRef<HTMLDivElement>(null);
    const [dropdownLayerId, setDropdownLayerId] = React.useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = React.useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const [tab, setTab] = React.useState<LayerPanelTab>('layers');

    const sortedLayers = [...project.layers].reverse();

    return (
        <div
            ref={panelRef}
            className="w-60 flex flex-col bg-viz-panel border border-viz-border rounded-xl2 shadow-viz overflow-hidden h-fit max-h-[calc(100vh-120px)] pointer-events-auto"
        >
            {/* Layers / Library tab bar */}
            <header className="flex h-10 shrink-0 items-center gap-1 px-3">
                <button type="button" aria-expanded={!isCollapsed} aria-controls="studio-layers-content" onClick={() => setIsCollapsed((collapsed) => !collapsed)} className="flex h-full items-center text-left">
                    <ChevronDown size={14} strokeWidth={2} className={`text-viz-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                </button>
                <nav className="flex items-center gap-3" aria-label="Layers panel tabs">
                    <button
                        type="button"
                        onClick={() => setTab('layers')}
                        aria-pressed={tab === 'layers'}
                        className={cn(
                            'text-xs font-semibold transition-colors',
                            tab === 'layers' ? 'text-white' : 'text-viz-muted hover:text-white/80'
                        )}
                    >
                        Layers
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('library')}
                        aria-pressed={tab === 'library'}
                        className={cn(
                            'text-xs font-semibold transition-colors',
                            tab === 'library' ? 'text-white' : 'text-viz-muted hover:text-white/80'
                        )}
                    >
                        Library
                    </button>
                </nav>
                <div className="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => addLayer()}
                        aria-label="Add layer"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <Plus size={15} />
                    </button>
                </div>
            </header>

            {/* Layer List */}
            {!isCollapsed && tab === 'layers' && <div id="studio-layers-content" className="flex-1 overflow-y-auto px-1.5 pb-1.5">
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
                                    ? "bg-viz-selected border-transparent"
                                    : "border-transparent hover:bg-white/5"
                            )}
                        >
                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-md bg-neutral-900 border border-viz-border flex items-center justify-center overflow-hidden checkerboard relative shrink-0">
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
                                    className="bg-transparent text-white text-xs outline-none w-full border-b border-transparent focus:border-viz-accent/50"
                                    value={layer.name}
                                    onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] text-viz-muted uppercase">{layer.blendMode}</span>
                                    <span className="text-[9px] text-viz-muted">{layer.opacity}%</span>
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
                                    className="p-1 text-viz-muted hover:text-white"
                                >
                                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-red-500" />}
                                </button>
                                <button
                                    className="p-1 text-viz-muted hover:text-white"
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
            </div>}

            {/* Library tab */}
            {!isCollapsed && tab === 'library' && (
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <div className="flex items-center gap-2 rounded-lg border border-viz-border bg-viz-surface px-2.5 py-2">
                        <Search size={13} className="shrink-0 text-viz-muted" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Find an asset..."
                            aria-label="Find an asset"
                            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-viz-muted"
                        />
                    </div>
                    <p className="mt-3 mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-viz-muted">All Libraries</p>
                    <ul className="space-y-0.5">
                        {librarySources.map(({ id, label, icon: Icon }) => (
                            <li key={id}>
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <Icon size={14} className="text-viz-muted" aria-hidden="true" />
                                    {label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

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
