'use client';

import { Palette } from 'lucide-react';

export interface SavedPalette {
    id: string;
    name?: string;
    swatches: string[];
}

interface SavedPalettePickerProps {
    palettes: SavedPalette[];
    onSelect: (palette: SavedPalette) => void;
}

/**
 * Feature 012 — T030 (FR-023): explicit-selection surface for saved project
 * assets. Color Variate loads a saved palette by selection (auto-apply to
 * other products remains out of scope per the spec).
 */
export function SavedPalettePicker({ palettes, onSelect }: SavedPalettePickerProps) {
    if (palettes.length === 0) {
        return (
            <p role="note" className="rounded-lg border border-dashed border-viz-border bg-viz-panel px-2.5 py-2 text-[10px] text-viz-muted">
                No saved palettes yet — run Extract (color) to save one.
            </p>
        );
    }

    return (
        <div className="space-y-1" role="group" aria-label="Saved palettes">
            {palettes.map((palette) => {
                const label = palette.name ?? 'Saved palette';
                return (
                    <button
                        key={palette.id}
                        type="button"
                        onClick={() => onSelect(palette)}
                        aria-label={`Load palette "${label}"`}
                        className="nodrag flex w-full items-center gap-2 rounded-lg border border-viz-border bg-viz-surface px-2 py-1.5 text-left transition-colors hover:border-viz-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                    >
                        <Palette size={12} className="shrink-0 text-viz-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-white">{label}</span>
                        <span className="flex shrink-0 items-center gap-0.5">
                            {palette.swatches.slice(0, 6).map((hex, index) => (
                                <span key={`${palette.id}-${index}`} className="h-3 w-3 rounded-full border border-viz-border" style={{ backgroundColor: hex }} />
                            ))}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
