import { useState } from 'react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { GenerationModifyMode } from '@/components/generation-lab/GenerationModifyMode';
import type { RenderTaskReference, RenderTaskUiStatus } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';

const REFERENCES: RenderTaskReference[] = [
    { id: 'ref-1', name: 'Arc Lamp', dataUrl: 'data:image/png;base64,aW1nMQ==' },
    { id: 'ref-2', name: 'Desk Chair', dataUrl: 'data:image/png;base64,aW1uMg==' },
];

const ADVANCED = { open: false, steps: 30, guidance: 4, referenceResolution: 1024 as const };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'modify',
    prompt: '',
    instantRatio: '1:1',
    advanced: ADVANCED,
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

interface TaskApiShape {
    taskId: string | null;
    status: RenderTaskUiStatus;
    queuePosition: number | null;
    error: string | null;
    outputs: Array<{ id: string; url?: string; seed?: number }>;
    extraction: null;
    submit: Mock<(request: RenderTaskRequest) => void>;
    cancel: Mock<() => void>;
    retry: Mock<() => void>;
    regenerateWithSeed: Mock<(outputId: string) => void>;
}

function makeTaskApi(overrides: Partial<Pick<TaskApiShape, 'status' | 'queuePosition' | 'error'>> = {}): TaskApiShape {
    return {
        taskId: null,
        status: overrides.status ?? 'idle',
        queuePosition: overrides.queuePosition ?? null,
        error: overrides.error ?? null,
        outputs: [],
        extraction: null,
        submit: vi.fn(),
        cancel: vi.fn(),
        retry: vi.fn(),
        regenerateWithSeed: vi.fn(),
    };
}

function renderModify(props: { prompt?: string; task?: TaskApiShape; references?: RenderTaskReference[] } = {}) {
    const task = props.task ?? makeTaskApi();
    const onGenerate = vi.fn();
    render(
        <GenerationModifyMode
            state={{ ...INITIAL_STATE, prompt: props.prompt ?? '' }}
            onUpdate={vi.fn()}
            references={props.references ?? REFERENCES}
            task={task}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />,
    );
    return { task, onGenerate };
}

/** Parent harness with live playground state (mirrors the node component). */
function Harness({ initialFidelity = 0.9, onGenerate }: { initialFidelity?: number; onGenerate: (request: RenderTaskRequest) => void }) {
    const [state, setState] = useState<GenerationPlaygroundState>({ ...INITIAL_STATE, advanced: ADVANCED, modify: { aspectRatio: '1:1', fidelity: initialFidelity } });
    return (
        <GenerationModifyMode
            state={state}
            onUpdate={(patch) => setState((current) => ({ ...current, ...patch }))}
            references={REFERENCES}
            task={makeTaskApi()}
            onGenerate={onGenerate}
            onBack={vi.fn()}
        />
    );
}

describe('GenerationModifyMode — US1 behavior (T008)', () => {
    it('blocks generation with an inline indication when the prompt is empty (US1/AC4)', () => {
        const { onGenerate } = renderModify({ prompt: '   ' });
        const generate = screen.getByRole('button', { name: /generate/i });
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        expect(onGenerate).not.toHaveBeenCalled();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    });

    it('submits a modify request with the connected reference and default preservation fidelity (US1/AC1)', () => {
        const { onGenerate } = renderModify({ prompt: 'make the base matte black' });
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('modify');
        expect(request.prompt).toBe('make the base matte black');
        expect(request.referenceImageId).toBe('ref-1');
        // FR-012 default favors strong source preservation.
        expect(request.referenceFidelity).toBe(0.9);
    });

    it('maps the reference-fidelity control monotonically into the request (US1/AC2, FR-012)', () => {
        const onGenerate = vi.fn();
        render(<Harness initialFidelity={0.5} onGenerate={onGenerate} />);
        const editor = screen.getByPlaceholderText(/describe your changes/i) as HTMLTextAreaElement;
        fireEvent.change(editor, { target: { value: 'make the base matte black' } });

        const slider = screen.getByRole('slider', { name: /reference fidelity/i }) as HTMLInputElement;
        expect(Number(slider.value)).toBe(50);

        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        expect((onGenerate.mock.calls[0][0] as RenderTaskRequest).referenceFidelity).toBe(0.5);

        fireEvent.change(slider, { target: { value: '95' } });
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        expect((onGenerate.mock.calls[1][0] as RenderTaskRequest).referenceFidelity).toBe(0.95);
    });

    it('offers @-mentions from the connected references only (US1/AC3)', () => {
        render(<Harness onGenerate={vi.fn()} />);
        const editor = screen.getByPlaceholderText(/describe your changes/i) as HTMLTextAreaElement;
        fireEvent.change(editor, { target: { value: 'repaint @' } });

        const options = screen.getAllByRole('option');
        const labels = options.map((option) => option.textContent);
        expect(labels.join(' ')).toContain('Arc Lamp');
        expect(labels.join(' ')).toContain('Desk Chair');

        fireEvent.click(screen.getByRole('option', { name: /desk chair/i }));
        expect(editor.value).toBe('repaint @2 ');
    });

    it('shows a square reference thumbnail with a numbered badge per attached image, without name text', () => {
        renderModify({ prompt: 'x' });
        const chip1 = screen.getByLabelText('Reference image 1');
        const chip2 = screen.getByLabelText('Reference image 2');
        expect(within(chip1).getByText('1')).toBeInTheDocument();
        expect(within(chip2).getByText('2')).toBeInTheDocument();
        // The badge morphs into the remove x on hover/focus.
        expect(within(chip1).getByRole('button', { name: /remove reference image/i })).toBeInTheDocument();
        // No image title text next to the thumbnail.
        expect(screen.queryByText('Arc Lamp')).not.toBeInTheDocument();
        expect(screen.queryByText('Desk Chair')).not.toBeInTheDocument();
    });

    it('disables Generate until a reference image is connected (spec edge case)', () => {
        const { onGenerate } = renderModify({ prompt: 'make the base matte black', references: [] });
        expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /generate/i }));
        expect(onGenerate).not.toHaveBeenCalled();
    });

    // Task status (queue position, issues, retry) moved to the top-right
    // GenerationStatusPill — covered in GenerationStatusPill.test.tsx.
});
