import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationExtractMode } from '@/components/generation-lab/GenerationExtractMode';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import type { ExtractionOutput } from '@/services/ai/extractionService';

const REFERENCE: RenderTaskReference = { id: 'ref-1', name: 'Arc Lamp', dataUrl: 'data:image/png;base64,aW1nMQ==' };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'extract',
    prompt: '',
    instantRatio: '1:1',
    advanced: { open: false, steps: 30, guidance: 4, referenceResolution: 1024 },
    modify: { aspectRatio: '1:1', fidelity: 0.9 },
    animate: { styleId: 'standard_video', duration: '4s' },
    variation: {
        kind: 'form',
        preset: 'Expression',
        axisLabels: { top: 'Complex', bottom: 'Simple', left: 'Geometric', right: 'Organic' },
        position: { x: 50, y: 50 },
        magnitude: 0.5,
        paletteName: '',
        swatches: ['#111111', '#52627b', '#9fa8d0', '#313236'],
        colorCount: 4,
        formCount: 4,
    },
    selectedView: '',
    extractKind: 'color',
    sampleBy: 'Hierarchy',
    extractAttached: false,
};

const COLOR_EXTRACTION: ExtractionOutput = {
    kind: 'color',
    sampleBy: 'hierarchy',
    confidence: 0.9,
    components: [
        { name: 'Base', region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 }, color: { hex: '#111111', confidence: 0.8 } },
        { name: 'Stem', region: { x: 0.4, y: 0.3, w: 0.1, h: 0.4 }, color: { hex: '#b5892f', confidence: 0.7 } },
    ],
};

function makeTaskApi(overrides: Partial<ReturnType<typeof baseTaskApi>> = {}) {
    return { ...baseTaskApi(), ...overrides };
}

function baseTaskApi() {
    return {
        taskId: null,
        status: 'idle' as const,
        queuePosition: null,
        error: null,
        outputs: [] as Array<{ id: string; url?: string; seed?: number }>,
        extraction: null as ExtractionOutput | null,
        submit: vi.fn(),
        cancel: vi.fn(),
        retry: vi.fn(),
        regenerateWithSeed: vi.fn(),
    };
}

function renderExtract(props: { references?: RenderTaskReference[]; extraction?: ExtractionOutput | null } = {}) {
    const onGenerate = vi.fn();
    render(
        <GenerationExtractMode
            state={INITIAL_STATE}
            onUpdate={vi.fn()}
            references={props.references ?? [REFERENCE]}
            task={makeTaskApi({ extraction: props.extraction ?? null })}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />,
    );
    return { onGenerate };
}

describe('GenerationExtractMode — US6 behavior (T024)', () => {
    it('submits an extract request with kind, sampling mode and reference (FR-018/FR-019)', () => {
        const { onGenerate } = renderExtract();
        fireEvent.click(screen.getByRole('button', { name: /update colors/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('extract');
        expect(request.extractKind).toBe('color');
        expect(request.sampleBy).toBe('hierarchy');
        expect(request.referenceImageId).toBe('ref-1');
    });

    it('disables extraction without a connected reference', () => {
        const { onGenerate } = renderExtract({ references: [] });
        expect(screen.getByText(/connect an image/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update colors/i })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /update colors/i }));
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('displays structured results and the saved-asset note (FR-023)', () => {
        renderExtract({ extraction: COLOR_EXTRACTION });
        expect(screen.getByText(/base/i)).toBeInTheDocument();
        expect(screen.getByText('#111111')).toBeInTheDocument();
        expect(screen.getByText('#b5892f')).toBeInTheDocument();
        expect(screen.getByText(/reusable project asset/i)).toBeInTheDocument();
    });

});
