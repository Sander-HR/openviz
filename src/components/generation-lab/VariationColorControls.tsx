import { useState } from 'react';
import { Plus, RefreshCw, Shuffle, X } from 'lucide-react';
import { ColorPicker } from '@/components/studio/ColorPicker';
import { normalizeHex } from '@/utils/colorUtils';
import type { VariationConfiguration } from './generationNodeMockup.types';
import { COLOR_PRESETS, type ColorPreset } from './variationConstants';
import { SectionLabel } from './GenerationModeControls';
import { SavedPalettePicker, type SavedPalette } from './SavedPalettePicker';
import { VariationCountSelector } from './VariationFormControls';

const ICON_BUTTON_CLASS = 'nodrag flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';

interface VariationColorControlsProps {
    config: VariationConfiguration;
    savedPalettes: SavedPalette[];
    onSelectPalette: (palette: SavedPalette) => void;
    onUpdate: (config: VariationConfiguration) => void;
}

/**
 * Color-variation internals copied from the studio VariationPanel: editable hex
 * swatch strip (add/remove/shuffle/refresh), per-swatch color picker and the
 * named palette presets — plus the lab's saved-palette picker (T030).
 */
export function VariationColorControls({ config, savedPalettes, onSelectPalette, onUpdate }: VariationColorControlsProps) {
    const [selectedSwatchIndex, setSelectedSwatchIndex] = useState<number | null>(null);

    const activePresetName =
        COLOR_PRESETS.find((preset) => preset.colors.length === config.swatches.length && preset.colors.every((color, index) => color.toLowerCase() === (config.swatches[index] ?? '').toLowerCase()))?.name ?? null;

    const updateColor = (color: string) => {
        if (selectedSwatchIndex === null) return;
        const normalized = normalizeHex(color);
        if (!normalized) return;
        onUpdate({ ...config, swatches: config.swatches.map((value, index) => (index === selectedSwatchIndex ? normalized : value)) });
    };

    const applyColorPreset = (preset: ColorPreset) => {
        onUpdate({ ...config, swatches: [...preset.colors] });
        setSelectedSwatchIndex(null);
    };

    const shufflePalette = () => onUpdate({ ...config, swatches: [...config.swatches].sort(() => Math.random() - 0.5) });

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <SectionLabel>Color palette</SectionLabel>
                <div className="flex items-center gap-1">
                    <button type="button" aria-label="Shuffle palette" onClick={shufflePalette} className={ICON_BUTTON_CLASS}><Shuffle size={14} /></button>
                    <button type="button" aria-label="Refresh palette" onClick={() => applyColorPreset(COLOR_PRESETS[0])} className={ICON_BUTTON_CLASS}><RefreshCw size={14} /></button>
                </div>
            </div>
            <div className="rounded-lg border border-viz-border bg-viz-surface p-2">
                <div className="flex h-12 overflow-hidden rounded-md border border-viz-border">
                    {config.swatches.map((color, index) => (
                        <button key={`${color}-${index}`} type="button" aria-label={`Edit palette color ${index + 1}`} onClick={() => setSelectedSwatchIndex(index)} className={`relative min-w-0 flex-1 transition ${selectedSwatchIndex === index ? 'z-10 ring-2 ring-inset ring-white' : 'hover:brightness-110'}`} style={{ backgroundColor: color }}>
                            <span className="sr-only">{color}</span>
                        </button>
                    ))}
                    {config.swatches.length < 8 && (
                        <button type="button" aria-label="Add palette color" onClick={() => onUpdate({ ...config, swatches: [...config.swatches, '#ffffff'] })} className="nodrag flex w-10 shrink-0 items-center justify-center bg-white/10 text-white/70 transition-colors hover:bg-white/20"><Plus size={16} /></button>
                    )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-viz-muted">{config.swatches.length} colors</span>
                    <button
                        type="button"
                        aria-label="Remove selected palette color"
                        disabled={selectedSwatchIndex === null || config.swatches.length <= 1}
                        onClick={() => {
                            if (selectedSwatchIndex === null) return;
                            onUpdate({ ...config, swatches: config.swatches.filter((_, index) => index !== selectedSwatchIndex) });
                            setSelectedSwatchIndex(null);
                        }}
                        className="nodrag flex h-7 items-center gap-1 rounded-md px-2 text-[9px] text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"
                    >
                        <X size={12} /> Remove
                    </button>
                </div>
            </div>
            {selectedSwatchIndex !== null && (
                <div className="flex justify-center">
                    <ColorPicker color={config.swatches[selectedSwatchIndex]} onChange={updateColor} />
                </div>
            )}
            <div className="space-y-2">
                <SectionLabel>Presets</SectionLabel>
                <div className="space-y-1.5">
                    {COLOR_PRESETS.map((preset) => (
                        <button key={preset.name} type="button" onClick={() => applyColorPreset(preset)} className={`flex w-full items-center gap-2 rounded-lg p-1 text-left transition ${activePresetName === preset.name ? 'bg-viz-surface' : 'hover:bg-white/5'}`}>
                            <span className="flex h-6 flex-1 overflow-hidden rounded-md">{preset.colors.map((color) => <span key={color} className="min-w-0 flex-1" style={{ backgroundColor: color }} />)}</span>
                            <span className="w-24 truncate text-[9px] text-viz-muted">{preset.name}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-1">
                <SectionLabel>Saved palettes</SectionLabel>
                <SavedPalettePicker palettes={savedPalettes} onSelect={onSelectPalette} />
            </div>
            <VariationCountSelector id="color-count" label="Colorways" value={config.colorCount} onChange={(colorCount) => onUpdate({ ...config, colorCount })} />
        </div>
    );
}
