import React, { useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ArrowUpRight,
    Eraser,
    ImagePlus,
    MousePointer2,
    PenLine,
    Plus,
    Redo2,
    Smartphone,
    StickyNote,
    Type,
    Undo2,
    Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ColorPicker } from '@/components/studio/ColorPicker';
import { AddNodeMenu, type AddNodeKind } from './AddNodeMenu';
import { WorkbenchToolType } from '@/types';

type SketchFormat = {
    label: string;
    width: number;
    height: number;
};

type WorkbenchToolbarProps = {
    activeTool: WorkbenchToolType;
    freehandColor: string;
    freehandStrokeWidth: number;
    onSelectTool: (tool: WorkbenchToolType) => void;
    onFreehandColorChange: (color: string) => void;
    onFreehandStrokeWidthChange: (strokeWidth: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onMediaUpload: () => void;
    onMediaUploadFromPhone: () => void;
    sketchFormats: SketchFormat[];
    onFormatSelect: (width: number, height: number) => void;
    /** Add-node menu (US3): routes a chosen type to its creation flow. */
    onCreateNode: (kind: AddNodeKind) => void;
};

const clampStrokeWidth = (value: number, min = 1, max = 64): number => {
    if (Number.isNaN(value)) {
        return min;
    }

    return Math.min(Math.max(value, min), max);
};

// Shared Radix menu-item styling (Constitution IV: accessible primitives).
const menuItemClass =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground outline-none transition-colors data-[highlighted]:bg-white/5';

const TOOL_CONFIG: Array<{ id: WorkbenchToolType; label: string; shortcut: string; icon: LucideIcon }> = [
    { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
    { id: 'draw', label: 'Draw', shortcut: 'D', icon: PenLine },
    { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
    { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowUpRight },
    { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
    { id: 'note', label: 'Note', shortcut: 'N', icon: StickyNote },
    { id: 'media', label: 'Media', shortcut: 'M', icon: ImagePlus },
];

export const WorkbenchToolbar: React.FC<WorkbenchToolbarProps> = ({
    activeTool,
    freehandColor,
    freehandStrokeWidth,
    onSelectTool,
    onFreehandColorChange,
    onFreehandStrokeWidthChange,
    onUndo,
    onRedo,
    canUndo = true,
    canRedo = true,
    onMediaUpload,
    onMediaUploadFromPhone,
    sketchFormats,
    onFormatSelect,
    onCreateNode,
}) => {
    const [showColorMenu, setShowColorMenu] = useState(false);
    const [isCreateNewOpen, setIsCreateNewOpen] = useState(false);

    // The Media/Create-new menus are Radix DropdownMenu (T026): they manage
    // their own open state, Escape-to-close, outside-click dismissal, and
    // focus return. Only the color picker still uses local state.
    const closeMenus = () => {
        setShowColorMenu(false);
    };

    const isDrawTool = activeTool === 'draw';

    return (
        <div className="pointer-events-none flex flex-col items-center gap-2">
            {showColorMenu && (
                <button
                    type="button"
                    className="fixed inset-0 z-[30] cursor-default"
                    aria-label="Close toolbar menu"
                    onClick={closeMenus}
                />
            )}

            <div className="pointer-events-auto z-[40] flex items-center gap-0.5 rounded-xl2 border border-viz-border bg-viz-panel/90 p-1 shadow-viz backdrop-blur-md">
                {/* US3 (ui-translation §3.1): the add-node menu is the FIRST
                    toolbar button; it owns its own Radix trigger + content. */}
                <AddNodeMenu onUploadImage={onMediaUpload} onUploadFromPhone={onMediaUploadFromPhone} onCreateNode={onCreateNode} />
                {TOOL_CONFIG.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = activeTool === tool.id;

                    if (tool.id === 'media') {
                        // C-1.4/C-1.5: Media submenu via Radix DropdownMenu —
                        // keyboard navigation, Escape-to-close, focus return (T026).
                        return (
                            <DropdownMenu
                                key={tool.id}
                                onOpenChange={(open) => {
                                    if (!open) setIsCreateNewOpen(false);
                                }}
                            >
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => onSelectTool(tool.id)}
                                        className={`group relative rounded-full p-1.5 transition-all duration-200 ${
                                            isActive
                                                ? 'bg-viz-accent text-white shadow-lg'
                                                : 'text-viz-muted hover:bg-white/10 hover:text-white'
                                        }`}
                                        title={`${tool.label} (${tool.shortcut})`}
                                        aria-pressed={isActive}
                                    >
                                        <Icon size={16} strokeWidth={2.3} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    sideOffset={16}
                                    align="center"
                                    className="w-60 overflow-hidden rounded-xl2 backdrop-blur-md"
                                >
                                    <DropdownMenuItem onSelect={() => onMediaUpload()} className={menuItemClass}>
                                        <Upload size={14} />
                                        Upload
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => onMediaUploadFromPhone()} className={menuItemClass}>
                                        <Smartphone size={14} />
                                        Upload from phone
                                    </DropdownMenuItem>
                                    <DropdownMenuSub open={isCreateNewOpen} onOpenChange={setIsCreateNewOpen}>
                                        <DropdownMenuSubTrigger
                                            className={`${menuItemClass} justify-between`}
                                            // Radix normally opens submenus on pointer movement. Also
                                            // open on click so the touch/click-only path is reliable.
                                            onClick={() => setIsCreateNewOpen(true)}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <Plus size={14} />
                                                Create new
                                            </span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="min-w-[12rem] overflow-hidden rounded-xl2 backdrop-blur-md">
                                            {sketchFormats.map((format) => (
                                                <DropdownMenuItem
                                                    key={format.label}
                                                    onSelect={() => onFormatSelect(format.width, format.height)}
                                                    className={`${menuItemClass} justify-between`}
                                                >
                                                    <span className="text-xs font-medium">{format.label}</span>
                                                    <span className="text-[10px] opacity-50">
                                                        {format.width}x{format.height}
                                                    </span>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        );
                    }

                    return (
                        <div key={tool.id} className="relative flex items-center">
                            <button
                                type="button"
                                onClick={() => {
                                    onSelectTool(tool.id);
                                    if (tool.id !== 'draw') {
                                        setShowColorMenu(false);
                                    }
                                }}
                                className={`group relative rounded-full p-1.5 transition-all duration-200 ${
                                    isActive
                                        ? 'bg-viz-accent text-white shadow-lg'
                                        : 'text-viz-muted hover:bg-white/10 hover:text-white'
                                }`}
                                title={`${tool.label} (${tool.shortcut})`}
                                aria-pressed={isActive}
                            >
                                <Icon size={16} strokeWidth={2.3} />
                            </button>
                        </div>
                    );
                })}

                <div className="mx-0.5 h-5 w-px bg-viz-border" />
                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    aria-label="Undo"
                    className="rounded-full p-1.5 text-viz-muted transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-viz-muted"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={16} />
                </button>
                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    aria-label="Redo"
                    className="rounded-full p-1.5 text-viz-muted transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-viz-muted"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 size={16} />
                </button>
            </div>

            {isDrawTool && (
                <div className="pointer-events-auto z-[40] flex items-center gap-3 rounded-xl2 border border-viz-border bg-viz-panel/90 px-3 py-2 shadow-viz backdrop-blur-md">
                    <span className="text-xs font-medium text-viz-muted">Thickness</span>
                    <input
                        type="range"
                        min={1}
                        max={64}
                        step={1}
                        value={freehandStrokeWidth}
                        onChange={(event) => onFreehandStrokeWidthChange(clampStrokeWidth(Number(event.target.value)))}
                        className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-viz-surface accent-viz-accent"
                        aria-label="Freehand thickness"
                    />
                    <div className="relative">
                        <button
                            type="button"
                            className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-viz-border p-0.5 shadow-inner transition-transform hover:scale-105 active:scale-95"
                            style={{ backgroundColor: freehandColor }}
                            onClick={() => setShowColorMenu((current) => !current)}
                            title="Change Color"
                        >
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent" />
                        </button>
                        {showColorMenu && (
                            <div
                                className="absolute left-1/2 top-full z-[50] mt-4 -translate-x-1/2"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-viz-border bg-viz-panel" />
                                <ColorPicker color={freehandColor} onChange={onFreehandColorChange} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
