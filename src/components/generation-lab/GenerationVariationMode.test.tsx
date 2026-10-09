import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationVariationMode } from '@/components/generation-lab/GenerationVariationMode';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';

const REFERENCE: RenderTaskReference = { id: 'ref-1', name: 'Arc Lamp', dataUrl: 'data:image/png;base64,aW1nMQ==' };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'variation',
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

/** react-query wrapper — the mode queries saved assets (T030) on mount. */
function makeWrapper() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children?: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return Wrapper;
}

const harnessClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

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

function renderVariation(props: { references?: RenderTaskReference[] } = {}) {
    const onGenerate = vi.fn();
    render(
        <GenerationVariationMode
            state={INITIAL_STATE}
            onUpdate={vi.fn()}
            references={props.references ?? [REFERENCE]}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />,
        { wrapper: makeWrapper() },
    );
    return { onGenerate };
}

/** Stateful harness for interacting with the form controls. */
function Harness({ onGenerate }: { onGenerate: (request: RenderTaskRequest) => void }) {
    const [state, setState] = useState(INITIAL_STATE);
    return (
        <QueryClientProvider client={harnessClient}>
            <GenerationVariationMode
                state={state}
                onUpdate={(patch) => setState((current) => ({ ...current, ...patch }))}
                references={[REFERENCE]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />
        </QueryClientProvider>
    );
}

describe('GenerationVariationMode — US3 behavior (T014)', () => {
    it('submits a form batch with preset, magnitude and count (US3/AC1)', () => {
        const { onGenerate } = renderVariation();
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('form-variate');
        expect(request.referenceImageId).toBe('ref-1');
        expect(request.variationCount).toBe(4);
        expect(request.formDirection?.preset).toBe('expression');
        expect(request.formDirection?.magnitude).toBe(0.5);
    });

    it('submits a color batch with hex palette swatches and colorway count (US3/AC2, FR-008)', () => {
        const onGenerate = vi.fn();
        render(
            <GenerationVariationMode
                state={{ ...INITIAL_STATE, variation: { ...INITIAL_STATE.variation, kind: 'color' } }}
                onUpdate={vi.fn()}
                references={[REFERENCE]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />,
            { wrapper: makeWrapper() },
        );
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));

        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('color-variate');
        expect(request.variationCount).toBe(4);
        expect(request.palette?.swatches).toHaveLength(4);
        for (const swatch of request.palette?.swatches ?? []) {
            expect(swatch).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    it('maps the magnitude slider monotonically into formDirection.magnitude (US3/AC4, FR-015)', () => {
        const onGenerate = vi.fn();
        render(<Harness onGenerate={onGenerate} />);

        const slider = screen.getByRole('slider', { name: /form magnitude/i }) as HTMLInputElement;
        expect(Number(slider.value)).toBe(50);

        fireEvent.change(slider, { target: { value: '100' } });
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));
        expect((onGenerate.mock.calls[0][0] as RenderTaskRequest).formDirection?.magnitude).toBe(1);

        fireEvent.change(slider, { target: { value: '0' } });
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));
        expect((onGenerate.mock.calls[1][0] as RenderTaskRequest).formDirection?.magnitude).toBe(0);
    });

    it('disables Generate and shows a connect-an-image state without a reference (spec edge case)', () => {
        const { onGenerate } = renderVariation({ references: [] });
        expect(screen.getByText(/connect an image/i)).toBeInTheDocument();
        const generate = screen.getByRole('button', { name: /generate/i });
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        expect(onGenerate).not.toHaveBeenCalled();
    });
});

/** Stateful color-mode harness for interacting with the palette editor. */
function ColorStateHarness({ onGenerate }: { onGenerate: (request: RenderTaskRequest) => void }) {
    const [state, setState] = useState<GenerationPlaygroundState>({ ...INITIAL_STATE, variation: { ...INITIAL_STATE.variation, kind: 'color' } });
    return (
        <QueryClientProvider client={harnessClient}>
            <GenerationVariationMode
                state={state}
                onUpdate={(patch) => setState((current) => ({ ...current, ...patch }))}
                references={[REFERENCE]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />
        </QueryClientProvider>
    );
}

describe('GenerationVariationMode — studio variate panel internals (parity)', () => {
    it('offers exactly 1/2/3/4 outputs (no silent remap)', () => {
        renderVariation();
        const select = screen.getByLabelText('Outputs');
        expect(Array.from(select.querySelectorAll('option')).map((option) => Number(option.value))).toEqual([1, 2, 3, 4]);
    });

    it("lists the studio panel's seven direction presets", () => {
        renderVariation();
        const options = Array.from(screen.getByLabelText('Preset').querySelectorAll('option')).map((option) => option.textContent);
        expect(options).toEqual(['Expression', 'Proportion', 'Massing', 'Edge Quality', 'Symmetry & Balance', 'Flow / Continuity', 'Custom']);
    });

    it('editing an axis label switches the preset to Custom and sends the new label', () => {
        const onGenerate = vi.fn();
        render(<Harness onGenerate={onGenerate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Complex' }));
        const input = screen.getByDisplayValue('Complex');
        fireEvent.change(input, { target: { value: 'Bold' } });
        fireEvent.blur(input);
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));

        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.formDirection?.preset).toBe('custom');
        expect(request.formDirection?.axisLabels?.top).toBe('Bold');
    });

    it('adds and removes palette swatches in color mode', () => {
        render(<ColorStateHarness onGenerate={vi.fn()} />);
        expect(screen.getByText('4 colors')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add palette color' }));
        expect(screen.getByText('5 colors')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Edit palette color 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove selected palette color' }));
        expect(screen.getByText('4 colors')).toBeInTheDocument();
    });

    it('applies a named color preset to the swatches for generation', () => {
        const onGenerate = vi.fn();
        render(<ColorStateHarness onGenerate={onGenerate} />);

        fireEvent.click(screen.getByRole('button', { name: 'Soft Pink' }));
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));

        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.palette?.swatches).toEqual(['#f9e6eb', '#f7bac9', '#f29ab4', '#ef668c']);
    });
});

describe('GenerationVariationMode — saved project assets (T030, FR-023)', () => {
    const SAVED_PALETTE_ASSET = {
        id: 'asset-1',
        projectId: 'default',
        kind: 'palette',
        extractionRecordId: 'rec-1',
        payload: { name: 'Lamp palette', swatches: ['#a1a1aa', '#047857'] },
        createdAt: 1_700_000_000_000,
    };

    const COLOR_STATE: GenerationPlaygroundState = { ...INITIAL_STATE, variation: { ...INITIAL_STATE.variation, kind: 'color' } };

    function ColorHarness({ onGenerate }: { onGenerate: (request: RenderTaskRequest) => void }) {
        const [state, setState] = useState(COLOR_STATE);
        return (
            <GenerationVariationMode
                state={state}
                onUpdate={(patch) => setState((current) => ({ ...current, ...patch }))}
                references={[REFERENCE]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />
        );
    }

    function renderColorMode() {
        const onGenerate = vi.fn();
        render(<ColorHarness onGenerate={onGenerate} />, { wrapper: makeWrapper() });
        return { onGenerate };
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('lists saved palettes and loads one into the swatches for generation', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([SAVED_PALETTE_ASSET]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        const { onGenerate } = renderColorMode();
        const loadButton = await screen.findByRole('button', { name: /load palette "lamp palette"/i });
        fireEvent.click(loadButton);

        // The saved palette is now the active swatch set: generate and assert its hexes flow through.
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('color-variate');
        expect(request.palette?.swatches).toEqual(['#a1a1aa', '#047857']);
    });

    it('passes raw hex swatches through to the request unchanged (saved-palette support)', () => {
        const onGenerate = vi.fn();
        render(
            <GenerationVariationMode
                state={{ ...INITIAL_STATE, variation: { ...INITIAL_STATE.variation, kind: 'color', swatches: ['#ff0000', '#00ff00'] } }}
                onUpdate={vi.fn()}
                references={[REFERENCE]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />,
            { wrapper: makeWrapper() },
        );
        fireEvent.click(screen.getByRole('button', { name: /generate 4 variations/i }));

        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.palette?.swatches).toEqual(['#ff0000', '#00ff00']);
    });
});
