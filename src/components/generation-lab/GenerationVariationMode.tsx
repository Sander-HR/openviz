import { CopyPlus } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { PaletteAssetPayload, ProjectAsset, RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { GenerationTaskApi } from './useRenderTask';
import { ModeHeader, NODE_BUTTON_CLASS } from './GenerationModeControls';
import { useExtractionAssets } from './useExtractionAssets';
import type { SavedPalette } from './SavedPalettePicker';
import { PRESET_TO_DIRECTION } from './variationConstants';
import { VariationFormControls } from './VariationFormControls';
import { VariationColorControls } from './VariationColorControls';

interface GenerationVariationModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

function toSavedPalette(asset: ProjectAsset): SavedPalette | null {
    if (asset.kind !== 'palette') return null;
    const payload = asset.payload as PaletteAssetPayload;
    return { id: asset.id, name: payload.name, swatches: payload.swatches };
}

/**
 * Variation mode of the shared generation node. The form/color internals are
 * copied from the studio variate panel (VariationPanel): continuous direction
 * slider with editable axis labels, seven direction templates, and the hex
 * palette editor with named presets.
 */
export function GenerationVariationMode({ state, onUpdate, references, task, onGenerate, onBack }: GenerationVariationModeProps) {
    const config = state.variation;
    const count = config.kind === 'form' ? config.formCount : config.colorCount;
    const hasReference = references.length > 0;
    const canGenerate = hasReference && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');
    // T030 (FR-023): saved palettes are only needed by the color sub-mode.
    const { assets } = useExtractionAssets({ enabled: config.kind === 'color' });
    const savedPalettes = assets.map(toSavedPalette).filter((palette): palette is SavedPalette => palette !== null);

    const generate = () => {
        if (!canGenerate) return;
        const base = {
            referenceImageId: references[0]?.id,
            variationCount: count,
            advanced: { steps: state.advanced.steps, guidance: state.advanced.guidance, referenceResolution: state.advanced.referenceResolution },
        };
        if (config.kind === 'form') {
            onGenerate({
                ...base,
                kind: 'form-variate',
                formDirection: { preset: PRESET_TO_DIRECTION[config.preset], magnitude: config.magnitude, axisLabels: config.axisLabels },
            });
        } else {
            onGenerate({
                ...base,
                kind: 'color-variate',
                palette: { name: config.paletteName || undefined, swatches: config.swatches },
            });
        }
    };

    return (
        <>
            <ModeHeader mode="variation" title="Variation" icon={CopyPlus} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                {!hasReference && (
                    <p role="note" className="rounded-lg border border-dashed border-viz-border bg-viz-panel px-2.5 py-2 text-[10px] text-viz-muted">Connect an image before exploring variations.</p>
                )}
                <div className="grid grid-cols-2 rounded-lg border border-viz-border bg-viz-bg p-0.5" role="group" aria-label="Variation type">
                    {(['form', 'color'] as const).map((kind) => (
                        <button key={kind} type="button" aria-label={kind === 'form' ? 'Form' : 'Color'} aria-pressed={config.kind === kind} onClick={() => onUpdate({ variation: { ...config, kind } })} className={`nodrag h-7 rounded-md text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent ${config.kind === kind ? 'bg-viz-selected text-white' : 'text-viz-muted hover:bg-viz-surface hover:text-white'}`}>
                            {kind}
                        </button>
                    ))}
                </div>
                {config.kind === 'form'
                    ? <VariationFormControls config={config} onUpdate={(variation) => onUpdate({ variation })} />
                    : <VariationColorControls config={config} savedPalettes={savedPalettes} onSelectPalette={(palette) => onUpdate({ variation: { ...config, swatches: [...palette.swatches], paletteName: palette.name ?? 'Saved palette' } })} onUpdate={(variation) => onUpdate({ variation })} />}
                <button type="button" disabled={!canGenerate} onClick={generate} className={`${NODE_BUTTON_CLASS} w-full`}>
                    Generate {count} variations
                </button>
            </div>
        </>
    );
}
