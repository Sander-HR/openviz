import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
};

const clampStrokeWidth = (value: number, min = 1, max = 64): number => {
    if (Number.isNaN(value)) {
        return min;
    }

    return Math.min(Math.max(value, min), max);
};

// Shared Radix menu-item styling (Constitution IV: accessible primitives).
const menuItemClass =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary outline-none transition-colors data-[highlighted]:bg-panel-light data-[highlighted]:text-white';

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

            <div className="pointer-events-auto z-[40] flex items-center gap-0.5 rounded-2xl border border-panel-border bg-panel/90 p-1 shadow-2xl backdrop-blur-md">
                {TOOL_CONFIG.map((tool) => {
                    const Icon = tool.icon;
                    const isActive = activeTool === tool.id;

                    if (tool.id === 'media') {
                        // C-1.4/C-1.5: Media submenu via Radix DropdownMenu —
                        // keyboard navigation, Escape-to-close, focus return (T026).
                        return (
                            <DropdownMenu.Root
                                key={tool.id}
                                onOpenChange={(open) => {
                                    if (!open) setIsCreateNewOpen(false);
                                }}
                            >
                                <DropdownMenu.Trigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => onSelectTool(tool.id)}
                                        className={`group relative rounded-full p-1.5 transition-all duration-200 ${
                                            isActive
                                                ? 'bg-primary text-white shadow-lg'
                                                : 'text-text-secondary hover:bg-neutral-800 hover:text-white'
                                        }`}
                                        title={`${tool.label} (${tool.shortcut})`}
                                        aria-pressed={isActive}
                                    >
                                        <Icon size={16} strokeWidth={2.3} />
                                    </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content
                                    sideOffset={16}
                                    align="center"
                                    className="z-[50] w-60 overflow-hidden rounded-xl border border-panel-border bg-panel p-1 shadow-2xl backdrop-blur-md"
                                >
                                    <DropdownMenu.Item onSelect={() => onMediaUpload()} className={menuItemClass}>
                                        <Upload size={14} />
                                        Upload
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item onSelect={() => onMediaUploadFromPhone()} className={menuItemClass}>
                                        <Smartphone size={14} />
                                        Upload from phone
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Sub open={isCreateNewOpen} onOpenChange={setIsCreateNewOpen}>
                                        <DropdownMenu.SubTrigger
                                            className={`${menuItemClass} justify-between`}
                                            // Radix normally opens submenus on pointer movement. Also
                                            // open on click so the touch/click-only path is reliable.
                                            onClick={() => setIsCreateNewOpen(true)}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <Plus size={14} />
                                                Create new
                                            </span>
                                        </DropdownMenu.SubTrigger>
                                        <DropdownMenu.SubContent className="z-[50] min-w-[12rem] overflow-hidden rounded-xl border border-panel-border bg-panel p-1 shadow-2xl backdrop-blur-md">
                                            {sketchFormats.map((format) => (
                                                <DropdownMenu.Item
                                                    key={format.label}
                                                    onSelect={() => onFormatSelect(format.width, format.height)}
                                                    className={`${menuItemClass} justify-between`}
                                                >
                                                    <span className="text-sm font-medium">{format.label}</span>
                                                    <span className="text-xs opacity-50">
                                                        {format.width}x{format.height}
                                                    </span>
                                                </DropdownMenu.Item>
                                            ))}
                                        </DropdownMenu.SubContent>
                                    </DropdownMenu.Sub>
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>
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
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-text-secondary hover:bg-neutral-800 hover:text-white'
                                }`}
                                title={`${tool.label} (${tool.shortcut})`}
                                aria-pressed={isActive}
                            >
                                <Icon size={16} strokeWidth={2.3} />
                            </button>
                        </div>
                    );
                })}

                <div className="mx-0.5 h-5 w-px bg-panel-border" />
                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    aria-label="Undo"
                    className="rounded-full p-1.5 text-text-secondary transition-all hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={16} />
                </button>
                <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    aria-label="Redo"
                    className="rounded-full p-1.5 text-text-secondary transition-all hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 size={16} />
                </button>
            </div>

            {isDrawTool && (
                <div className="pointer-events-auto z-[40] flex items-center gap-3 rounded-2xl border border-panel-border bg-panel/90 px-3 py-2 shadow-2xl backdrop-blur-md">
                    <span className="text-xs font-medium text-text-secondary">Thickness</span>
                    <input
                        type="range"
                        min={1}
                        max={64}
                        step={1}
                        value={freehandStrokeWidth}
                        onChange={(event) => onFreehandStrokeWidthChange(clampStrokeWidth(Number(event.target.value)))}
                        className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-neutral-800 accent-primary"
                        aria-label="Freehand thickness"
                    />
                    <div className="relative">
                        <button
                            type="button"
                            className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-panel-border p-0.5 shadow-inner transition-transform hover:scale-105 active:scale-95"
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
                                <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-panel-border bg-panel" />
                                <ColorPicker color={freehandColor} onChange={onFreehandColorChange} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
