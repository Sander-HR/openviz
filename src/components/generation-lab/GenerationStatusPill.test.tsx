import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GenerationStatusPill } from '@/components/generation-lab/GenerationStatusPill';
import type { GenerationTaskApi } from '@/components/generation-lab/useRenderTask';
import { useStore } from '@/store/useStore';

function makeTaskApi(overrides: Partial<GenerationTaskApi> = {}): GenerationTaskApi {
    return {
        taskId: null,
        status: 'idle',
        queuePosition: null,
        error: null,
        outputs: [],
        extraction: null,
        submit: vi.fn(),
        cancel: vi.fn(),
        retry: vi.fn(),
        regenerateWithSeed: vi.fn(),
        ...overrides,
    };
}

describe('GenerationStatusPill — top-right status messages (issues, queue, jobs)', () => {
    it('shows the readiness state while idle', () => {
        render(<GenerationStatusPill task={makeTaskApi()} />);
        expect(screen.getByText('AI ready')).toBeInTheDocument();
    });

    it('surfaces the readiness issue when no image backend is configured (T031, spec edge case)', () => {
        const previousSettings = useStore.getState().computeSettings;
        useStore.setState((state) => ({ computeSettings: { ...state.computeSettings, protocol: 'openai-image', imageApiEndpoint: '' } }));
        try {
            render(<GenerationStatusPill task={makeTaskApi()} />);
            expect(screen.getByText('AI not ready')).toBeInTheDocument();
        } finally {
            useStore.setState({ computeSettings: previousSettings });
        }
    });

    it('shows queue position while the task is queued (FR-022 visibility) with a cancel action', () => {
        const task = makeTaskApi({ taskId: 'task-1', status: 'queued', queuePosition: 2 });
        render(<GenerationStatusPill task={task} />);
        expect(screen.getByText(/queued · position 2/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(task.cancel).toHaveBeenCalled();
    });

    it('shows the active job with a cancel action', () => {
        const task = makeTaskApi({ taskId: 'task-1', status: 'active' });
        render(<GenerationStatusPill task={task} />);
        expect(screen.getByText(/generating…/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(task.cancel).toHaveBeenCalled();
    });

    it('surfaces a task-level issue with a retry action (spec edge case)', () => {
        const task = makeTaskApi({ taskId: 'task-1', status: 'failed', error: 'The image backend returned no outputs.' });
        render(<GenerationStatusPill task={task} />);
        expect(screen.getByRole('alert')).toHaveTextContent(/the image backend returned no outputs/i);

        fireEvent.click(screen.getByRole('button', { name: /retry/i }));
        expect(task.retry).toHaveBeenCalled();
    });

    it('shows a done summary with the output count after completion', () => {
        render(<GenerationStatusPill task={makeTaskApi({ taskId: 'task-1', status: 'completed', outputs: [{ id: 'o1' }, { id: 'o2' }] })} />);
        expect(screen.getByText(/done · 2 outputs/i)).toBeInTheDocument();
    });

    it('flags partial results and cancelled tasks', () => {
        const { unmount } = render(<GenerationStatusPill task={makeTaskApi({ taskId: 'task-1', status: 'partial' })} />);
        expect(screen.getByText(/partial — some outputs failed/i)).toBeInTheDocument();

        unmount();
        render(<GenerationStatusPill task={makeTaskApi({ taskId: 'task-1', status: 'cancelled' })} />);
        expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    });

    it('opens the queue/status/jobs panel when the pill is clicked and closes it again', () => {
        const task = makeTaskApi({ taskId: 'task-1', status: 'queued', queuePosition: 2 });
        render(<GenerationStatusPill task={task} />);

        const pill = screen.getByRole('button', { name: /queued · position 2/i });
        expect(pill).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('region', { name: /render task details/i })).not.toBeInTheDocument();

        fireEvent.click(pill);
        const panel = screen.getByRole('region', { name: /render task details/i });
        expect(panel).toHaveTextContent(/queue/i);
        expect(panel).toHaveTextContent(/position 2 in queue/i);
        expect(panel).toHaveTextContent(/status/i);
        expect(panel).toHaveTextContent(/queued/i);
        expect(panel).toHaveTextContent(/jobs/i);

        // Toggling the pill closes the panel.
        fireEvent.click(pill);
        expect(screen.queryByRole('region', { name: /render task details/i })).not.toBeInTheDocument();
    });

    it('shows the job request and outputs in the panel for a completed task', () => {
        useStore.setState({ lastRenderRequest: { kind: 'instant-render', prompt: 'a warm studio scene', referenceImageId: 'ref-1', aspectRatio: '16:9' } });
        try {
            const task = makeTaskApi({ taskId: 'task-1', status: 'completed', outputs: [{ id: 'o1', url: 'data:image/png;base64,eA==', seed: 7 }, { id: 'o2' }] });
            render(<GenerationStatusPill task={task} />);

            fireEvent.click(screen.getByRole('button', { name: /done · 2 outputs/i }));
            const panel = screen.getByRole('region', { name: /render task details/i });
            expect(panel).toHaveTextContent(/instant-render · 16:9/i);
            expect(panel).toHaveTextContent('a warm studio scene');
            expect(within(panel).getByText('Output 1')).toBeInTheDocument();
            expect(within(panel).getByText('seed 7')).toBeInTheDocument();
            expect(within(panel).getByText('Output 2')).toBeInTheDocument();
        } finally {
            useStore.setState({ lastRenderRequest: null });
        }
    });

    it('reports an empty queue and no jobs while idle', () => {
        render(<GenerationStatusPill task={makeTaskApi()} />);
        fireEvent.click(screen.getByRole('button', { name: /ai ready/i }));

        const panel = screen.getByRole('region', { name: /render task details/i });
        expect(panel).toHaveTextContent(/empty/i);
        expect(panel).toHaveTextContent(/no jobs yet/i);
    });

    it('closes the panel on Escape and on outside mousedown', () => {
        render(<GenerationStatusPill task={makeTaskApi()} />);
        fireEvent.click(screen.getByRole('button', { name: /ai ready/i }));
        expect(screen.getByRole('region', { name: /render task details/i })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('region', { name: /render task details/i })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /ai ready/i }));
        expect(screen.getByRole('region', { name: /render task details/i })).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('region', { name: /render task details/i })).not.toBeInTheDocument();
    });
});
