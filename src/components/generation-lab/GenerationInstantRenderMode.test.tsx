import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationInstantRenderMode } from '@/components/generation-lab/GenerationInstantRenderMode';
import { useStore } from '@/store/useStore';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest, RenderTaskAspectRatio } from '@/types/renderTask.types';

const REFERENCE: RenderTaskReference = { id: 'ref-1', name: 'Arc Lamp', dataUrl: 'data:image/png;base64,aW1nMQ==' };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'instant-render',
    prompt: '',
    instantStyle: 'cinematic',
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

function makeTaskApi() {
    return {
        taskId: null,
        status: 'idle' as const,
        queuePosition: null,
        error: null,
        outputs: [] as Array<{ id: string; url?: string; seed?: number }>,
        extraction: null,
        submit: vi.fn(),
        cancel: vi.fn(),
        retry: vi.fn(),
        regenerateWithSeed: vi.fn(),
    };
}

/** Harness with real local state so control changes (style, ratio) land before Generate. */
function InstantRenderHarness({ references, ratio, style, onGenerate }: {
    references?: RenderTaskReference[];
    ratio?: RenderTaskAspectRatio;
    style?: string;
    onGenerate: (request: RenderTaskRequest) => void;
}) {
    const [state, setState] = useState<GenerationPlaygroundState>({
        ...INITIAL_STATE,
        instantRatio: ratio ?? '1:1',
        ...(style !== undefined ? { instantStyle: style } : {}),
    });
    return (
        <GenerationInstantRenderMode
            state={state}
            onUpdate={(patch) => setState((current) => ({ ...current, ...patch }))}
            references={references ?? [REFERENCE]}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />
    );
}

function renderInstantRender(props: { references?: RenderTaskReference[]; ratio?: RenderTaskAspectRatio; style?: string } = {}) {
    const onGenerate = vi.fn();
    render(<InstantRenderHarness {...props} onGenerate={onGenerate} />);
    return { onGenerate };
}

describe('GenerationInstantRenderMode — US2 behavior (T012)', () => {
    let originalRemove: (id: string) => void;

    beforeEach(() => {
        originalRemove = useStore.getState().removeRenderReference;
        useStore.setState({ removeRenderReference: vi.fn() });
    });

    afterEach(() => {
        useStore.setState({ removeRenderReference: originalRemove });
    });

    it('shows the connected reference as an image without its title', () => {
        renderInstantRender();
        const row = screen.getByRole('button', { name: /remove reference image/i }).parentElement!;
        expect(row.querySelector('img')).toHaveAttribute('src', REFERENCE.dataUrl);
        // The image name (title) is no longer displayed next to the thumbnail.
        expect(screen.queryByText(REFERENCE.name)).not.toBeInTheDocument();
    });

    it('shows the numbered ref badge that morphs into the remove x on hover/selected', () => {
        renderInstantRender();
        const badge = screen.getByRole('button', { name: /remove reference image/i });

        // Numbered badge at rest (1-based position of the shown reference).
        expect(badge).toHaveTextContent('1');
        const row = badge.parentElement!;
        expect(row.querySelector('img')).toHaveAttribute('src', REFERENCE.dataUrl);

        // The x is hidden until the thumbnail is hovered or the badge is focused (selected), then it morphs in.
        const icon = badge.querySelector('svg')!;
        expect(icon).toHaveClass('opacity-0', 'scale-50', 'group-hover/thumb:opacity-100', 'group-focus-visible/thumb:opacity-100');

        fireEvent.click(badge);
        expect(useStore.getState().removeRenderReference).toHaveBeenCalledWith('ref-1');
    });

    it('offers the Cinematic, Ultra Realistic and Sketch styles from the legacy renderer registry', () => {
        renderInstantRender();
        const select = screen.getByRole('combobox', { name: /style/i }) as HTMLSelectElement;
        expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['Cinematic', 'Ultra Realistic', 'Sketch']);
        expect(select.value).toBe('cinematic');
    });

    it('submits the selected style composed through the legacy renderer with the reference and ratio (US2/AC1, FR-013)', () => {
        const { onGenerate } = renderInstantRender({ ratio: '16:9' });
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('instant-render');
        expect(request.referenceImageId).toBe('ref-1');
        expect(request.aspectRatio).toBe('16:9');
        // The prompt field is replaced by the style selector: the cinematic layer comes from the registry.
        expect(request.prompt).toContain('Style direction: A cinematic render');
    });

    it('switches the composed prompt when another style is selected', () => {
        const { onGenerate } = renderInstantRender();
        fireEvent.change(screen.getByRole('combobox', { name: /style/i }), { target: { value: 'sketch' } });
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.prompt).toContain('Style direction: A refined hand-drawn concept sketch');
    });

    it('offers all seven documented aspect-ratio presets (FR-013)', () => {
        renderInstantRender();
        const select = screen.getByRole('combobox', { name: /aspect ratio/i });
        const options = Array.from(select.querySelectorAll('option')).map((option) => option.value);
        expect(options).toEqual(expect.arrayContaining(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3']));
    });

    it('shows a connect-an-image state and disables Generate with no reference (US2/AC3)', () => {
        const { onGenerate } = renderInstantRender({ references: [] });
        expect(screen.getByText(/connect an image/i)).toBeInTheDocument();
        const generate = screen.getByRole('button', { name: /generate/i });
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('generates without a typed prompt once a reference is connected (style replaces the prompt field)', () => {
        const { onGenerate } = renderInstantRender();
        const generate = screen.getByRole('button', { name: /generate/i });
        expect(generate).toBeEnabled();
        fireEvent.click(generate);
        expect(onGenerate).toHaveBeenCalledTimes(1);
    });
});
