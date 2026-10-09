import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GenerationAnimateMode } from '@/components/generation-lab/GenerationAnimateMode';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState } from '@/components/generation-lab/generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';

const START_FRAME: RenderTaskReference = { id: 'frame-start', name: 'Start frame', dataUrl: 'data:image/png;base64,c3RhcnQ=' };
const END_FRAME: RenderTaskReference = { id: 'frame-end', name: 'End frame', dataUrl: 'data:image/png;base64,ZW5k' };

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'animate',
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

describe('GenerationAnimateMode — US5 behavior (T018)', () => {
    it('builds an animate request from start frame + prompt + duration (FR-024)', () => {
        const onGenerate = vi.fn();
        render(
            <GenerationAnimateMode
                state={{ ...INITIAL_STATE, prompt: 'the lamp swings gently into the scene' }}
                onUpdate={vi.fn()}
                references={[START_FRAME]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /^animate$/i }));

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const request = onGenerate.mock.calls[0][0] as RenderTaskRequest;
        expect(request.kind).toBe('animate');
        expect(request.prompt).toBe('the lamp swings gently into the scene');
        expect(request.referenceImageId).toBe('frame-start');
        expect(request.duration).toBe('4s');
    });

    it('attaches the second connected reference as the optional end frame (FR-024)', () => {
        const onGenerate = vi.fn();
        render(
            <GenerationAnimateMode
                state={{ ...INITIAL_STATE, prompt: 'morph from A to B' }}
                onUpdate={vi.fn()}
                references={[START_FRAME, END_FRAME]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /^animate$/i }));

        expect((onGenerate.mock.calls[0][0] as RenderTaskRequest).endFrameImageId).toBe('frame-end');
    });

    it('honors the chosen duration (2s/4s/8s) in the request (FR-024)', () => {
        const onGenerate = vi.fn();
        render(
            <GenerationAnimateMode
                state={{ ...INITIAL_STATE, prompt: 'slow reveal', animate: { styleId: 'standard_video', duration: '8s' } }}
                onUpdate={vi.fn()}
                references={[START_FRAME]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /^animate$/i }));

        expect((onGenerate.mock.calls[0][0] as RenderTaskRequest).duration).toBe('8s');
    });

    it('blocks generation without a start frame or motion description (spec edge case)', () => {
        const onGenerate = vi.fn();
        render(
            <GenerationAnimateMode
                state={{ ...INITIAL_STATE, prompt: '' }}
                onUpdate={vi.fn()}
                references={[]}
                task={makeTaskApi()}
                onGenerate={onGenerate}
                onBack={vi.fn()}
            />,
        );
        expect(screen.getByText(/connect an image/i)).toBeInTheDocument();
        const generate = screen.getByRole('button', { name: /^animate$/i });
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        expect(onGenerate).not.toHaveBeenCalled();
    });
});
