import React, { useEffect, useRef, useState } from 'react';

import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    ChevronDown,
    Italic,
    MoreHorizontal,
    Type,
    Underline,
} from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from './nodeUi';

/** Resolved formatting state for the shared text/note toolbar. */
export interface TextFormattingState {
    fontSize: number;
    color: string;
    fontWeight?: number;
    fontStyle?: 'normal' | 'italic';
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    fontFamily?: string;
}

export interface TextFormattingToolbarProps {
    state: TextFormattingState;
    /** Reports a partial data patch to the owning node. */
    onChange: (data: Record<string, unknown>) => void;
}

const FONT_FAMILIES = [
    { id: 'sans', label: 'Sans', value: '"Inter", ui-sans-serif, system-ui, sans-serif' },
    { id: 'note', label: 'Note', value: '"Comic Sans MS", "Bradley Hand", "Segoe Print", "Chalkboard SE", cursive' },
    { id: 'mono', label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
    { id: 'serif', label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
] as const;

const FONT_SIZES = [16, 20, 24, 32, 40, 48, 64];

/** Twelve preset text colors for the swatch popover. */
const COLOR_SWATCHES = [
    '#111827',
    '#4b5563',
    '#9ca3af',
    '#f9fafb',
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
] as const;

const ALIGN_OPTIONS = [
    { id: 'left', label: 'Align left', icon: AlignLeft },
    { id: 'center', label: 'Align center', icon: AlignCenter },
    { id: 'right', label: 'Align right', icon: AlignRight },
] as const;

const iconButtonClass = 'rounded-lg p-1.5 text-viz-muted hover:bg-viz-surface hover:text-white';
const chipButtonClass = 'flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-viz-surface';

function fontLabel(value?: string): string {
    return FONT_FAMILIES.find((font) => font.value === value)?.label ?? 'Sans';
}

/**
 * Shared floating formatting toolbar for text and note nodes: color picker,
 * font family, size, bold, underline, align and a "more" menu (italic +
 * clear formatting). Styling mirrors NodeSelectionToolbar.
 */
export const TextFormattingToolbar: React.FC<TextFormattingToolbarProps> = ({ state, onChange }) => {
    const [colorOpen, setColorOpen] = useState(false);
    const colorPopoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!colorOpen) return;
        const handler = (event: MouseEvent) => {
            if (colorPopoverRef.current && !colorPopoverRef.current.contains(event.target as Node)) {
                setColorOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [colorOpen]);

    const bold = (state.fontWeight ?? 400) >= 700;
    const italic = state.fontStyle === 'italic';
    const underline = state.underline === true;
    const align = state.align ?? 'left';
    const AlignIcon = ALIGN_OPTIONS.find((option) => option.id === align)?.icon ?? AlignLeft;

    return (
        <div
            className="nodrag nopan pointer-events-auto absolute -top-11 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl2 border border-viz-border bg-viz-panel px-1.5 py-1 shadow-viz"
            onDoubleClick={(event) => event.stopPropagation()}
        >
            {/* Color picker */}
            <div ref={colorPopoverRef} className="relative">
                <button
                    type="button"
                    title="Color"
                    aria-label="Text color"
                    onClick={() => setColorOpen((open) => !open)}
                    className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-viz-border p-0.5 shadow-inner transition-transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: state.color }}
                >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent" />
                </button>
                {colorOpen && (
                    <div className="absolute bottom-full left-1/2 z-40 mb-2 w-max -translate-x-1/2 rounded-xl2 border border-viz-border bg-viz-panel p-2 shadow-viz">
                        <div className="grid grid-cols-6 gap-1.5">
                            {COLOR_SWATCHES.map((swatch) => (
                                <button
                                    key={swatch}
                                    type="button"
                                    title={swatch}
                                    aria-label={`Color ${swatch}`}
                                    onClick={() => {
                                        onChange({ color: swatch });
                                        setColorOpen(false);
                                    }}
                                    className={cn(
                                        'h-5 w-5 rounded-full border border-white/10 transition-transform hover:scale-110 active:scale-95',
                                        swatch.toLowerCase() === state.color.toLowerCase() && 'ring-2 ring-viz-accent ring-offset-1 ring-offset-viz-panel',
                                    )}
                                    style={{ backgroundColor: swatch }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Font family */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" title="Font" className={chipButtonClass}>
                        <Type size={14} className="text-viz-muted" />
                        {fontLabel(state.fontFamily)}
                        <ChevronDown size={12} className="text-viz-muted" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={8}>
                    {FONT_FAMILIES.map((font) => (
                        <DropdownMenuItem key={font.id} onClick={() => onChange({ fontFamily: font.value })}>
                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Size */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" title="Size" className={chipButtonClass}>
                        {state.fontSize}px
                        <ChevronDown size={12} className="text-viz-muted" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={8}>
                    {FONT_SIZES.map((size) => (
                        <DropdownMenuItem key={size} onClick={() => onChange({ fontSize: size })}>
                            {size}px
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-0.5 h-5 w-px bg-viz-border" />

            {/* Bold */}
            <button
                type="button"
                title="Bold"
                aria-pressed={bold}
                onClick={() => onChange({ fontWeight: bold ? 400 : 700 })}
                className={cn(iconButtonClass, bold && 'bg-viz-surface text-white')}
            >
                <Bold size={14} />
            </button>

            {/* Underline */}
            <button
                type="button"
                title="Underline"
                aria-pressed={underline}
                onClick={() => onChange({ underline: !underline })}
                className={cn(iconButtonClass, underline && 'bg-viz-surface text-white')}
            >
                <Underline size={14} />
            </button>

            {/* Align */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" title="Align" className={chipButtonClass}>
                        <AlignIcon size={14} className="text-viz-muted" />
                        <ChevronDown size={12} className="text-viz-muted" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={8}>
                    {ALIGN_OPTIONS.map((option) => (
                        <DropdownMenuItem key={option.id} onClick={() => onChange({ align: option.id })}>
                            <option.icon size={14} className="text-viz-muted" />
                            {option.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* More */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" title="More" className={iconButtonClass}>
                        <MoreHorizontal size={14} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={8}>
                    <DropdownMenuItem onClick={() => onChange({ fontStyle: italic ? 'normal' : 'italic' })}>
                        <Italic size={14} className="text-viz-muted" />
                        Italic
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() =>
                            onChange({
                                fontWeight: 400,
                                fontStyle: 'normal',
                                underline: false,
                                align: 'left',
                                fontFamily: undefined,
                            })
                        }
                    >
                        Clear formatting
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
