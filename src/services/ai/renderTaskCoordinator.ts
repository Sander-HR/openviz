/**
 * Feature 012 — T005 render task coordinator (FR-021, FR-022).
 *
 * Enforces one active generation task per user on top of the existing
 * `createGenerationQueue` (concurrency pinned to 1): submissions run in
 * submission order with a visible 1-based FIFO queue position. Queued tasks
 * cancel before any provider request is sent; running tasks cancel through
 * their abort signal and end as `cancelled`. The FR-021 benchmark launch gate
 * rejects submissions whose resolved defaults are still `'starting'` for that
 * task kind unless the gate is disabled.
 *
 * `handle.promise` always settles with a `RenderTaskOutcome` (empty on
 * cancel/failure); the authoritative result is the task status, which follows
 * the data-model.md §4 state machine and never leaves a terminal state.
 */

import { createGenerationQueue } from './generationQueue';
import {
    isRenderTaskStatusTerminal,
    RENDER_TASK_STATUS_TRANSITIONS,
    type BenchmarkStatus,
    type RenderTaskOutcome,
    type RenderTaskRequest,
    type RenderTaskStatus,
} from '@/types/renderTask.types';

export interface RenderTaskSubmission {
    request: RenderTaskRequest;
    /** Resolved defaults provenance (FR-021); `'starting'` trips the gate. */
    benchmarkStatus?: BenchmarkStatus;
}

export interface RenderTaskHandle {
    id: string;
    promise: Promise<RenderTaskOutcome>;
}

export interface RenderTaskCoordinatorOptions {
    /**
     * FR-021 launch gate; default `false` (disabled by default, R8). Accepts a
     * getter so live settings changes take effect without recreating the
     * coordinator.
     */
    benchmarkGateEnabled?: boolean | (() => boolean);
    /**
     * Cancel capability probe (FR-022, R3): returns whether the active backend
     * exposes a cancel route for a running task. Injected from capability
     * probing (`openApiDiscovery.ts`); default `() => true`. When it reports
     * `false`, running-task cancel is reported as unsupported and the task
     * runs to completion.
     */
    getSupportsCancel?: () => boolean;
}

/** Provider runner context: abort signal for running-task cancel. */
export type RenderTaskRunner = (context: { signal: AbortSignal }) => Promise<RenderTaskOutcome>;

export class BenchmarkGateError extends Error {
    constructor(kind: string) {
        super(
            `Benchmark gate: task kind "${kind}" is not validated yet (defaults are starting values). ` +
                'Complete the benchmark set for this task kind or disable the benchmark gate in settings.',
        );
        this.name = 'BenchmarkGateError';
    }
}

export class RenderTaskCancelledError extends Error {
    constructor() {
        super('The render task was cancelled.');
        this.name = 'RenderTaskCancelledError';
    }
}

interface CoordinatorTask {
    id: string;
    status: RenderTaskStatus;
    controller: AbortController;
    settle: (outcome: RenderTaskOutcome) => void;
    outcome?: RenderTaskOutcome;
    error?: string | null;
}

const EMPTY_OUTCOME: RenderTaskOutcome = { outputIds: [], allOutputsSucceeded: false };

export function createRenderTaskCoordinator(options: RenderTaskCoordinatorOptions = {}) {
    const isBenchmarkGateEnabled = (): boolean => {
        const gate = options.benchmarkGateEnabled ?? false;
        return typeof gate === 'function' ? gate() : gate;
    };
    const getSupportsCancel = options.getSupportsCancel ?? (() => true);
    // One active task per user (FR-022): the queue is the FIFO scheduler.
    const queue = createGenerationQueue(1);
    const tasks = new Map<string, CoordinatorTask>();
    let nextId = 0;

    function transition(task: CoordinatorTask, next: RenderTaskStatus): void {
        if (isRenderTaskStatusTerminal(task.status)) return;
        if (!RENDER_TASK_STATUS_TRANSITIONS[task.status].includes(next)) return;
        task.status = next;
    }

    function submit(submission: RenderTaskSubmission, runner: RenderTaskRunner): Promise<RenderTaskHandle> {
        if (isBenchmarkGateEnabled() && submission.benchmarkStatus !== 'validated') {
            return Promise.reject(new BenchmarkGateError(submission.request.kind));
        }

        const id = `render-task-${++nextId}`;
        let settle!: (outcome: RenderTaskOutcome) => void;
        const outcomePromise = new Promise<RenderTaskOutcome>((resolve) => {
            settle = resolve;
        });
        const task: CoordinatorTask = { id, status: 'queued', controller: new AbortController(), settle };
        tasks.set(id, task);

        queue.enqueue('render-task', async (context) => {
            if (isRenderTaskStatusTerminal(task.status)) return EMPTY_OUTCOME; // cancelled/interrupted pre-run
            transition(task, 'active');
            const signal = anySignal(context.signal, task.controller.signal);
            try {
                const outcome = await raceAbort(runner({ signal }), signal);
                if (signal.aborted) {
                    transition(task, 'cancelled');
                    settle(EMPTY_OUTCOME);
                    return EMPTY_OUTCOME;
                }
                task.outcome = outcome;
                transition(task, outcome.allOutputsSucceeded ? 'completed' : 'partial');
                settle(outcome);
                return outcome;
            } catch (error) {
                if (signal.aborted || error instanceof RenderTaskCancelledError) {
                    transition(task, 'cancelled');
                } else {
                    transition(task, 'failed');
                    task.error = error instanceof Error ? error.message : String(error);
                }
                settle(EMPTY_OUTCOME);
                return EMPTY_OUTCOME;
            }
        });

        return Promise.resolve({ id, promise: outcomePromise });
    }

    function cancel(id: string): boolean {
        const task = tasks.get(id);
        if (!task || isRenderTaskStatusTerminal(task.status)) return false;
        if (task.status === 'queued') {
            transition(task, 'cancelled');
            task.settle(EMPTY_OUTCOME);
            queue.cancel(id); // removes the entry; the runner is never invoked
            return true;
        }
        // Capability probe (R3): only delegate mid-run cancel when the backend supports it.
        if (!getSupportsCancel()) return false;
        task.controller.abort(); // wrapper observes the abort and settles as cancelled
        return true;
    }

    function getStatus(id: string): RenderTaskStatus {
        return tasks.get(id)?.status ?? 'interrupted';
    }

    function getError(id: string): string | null {
        const task = tasks.get(id);
        if (!task) return null;
        return task.error ?? null;
    }

    /** 1-based FIFO position incl. the active task; `null` once terminal. */
    function getQueuePosition(id: string): number | null {
        const task = tasks.get(id);
        if (!task || (task.status !== 'queued' && task.status !== 'active')) return null;
        let position = 0;
        for (const candidate of tasks.values()) {
            if (candidate.status !== 'queued' && candidate.status !== 'active') continue;
            position += 1;
            if (candidate.id === id) return position;
        }
        return null;
    }

    /**
     * Reload recovery: any non-terminal task without a live promise becomes
     * `interrupted` (data-model.md §4). Returns the affected ids in order.
     */
    function reconcileInterrupted(ids: string[]): string[] {
        const affected: string[] = [];
        for (const id of ids) {
            const task = tasks.get(id);
            if (!task || isRenderTaskStatusTerminal(task.status)) continue;
            transition(task, 'interrupted');
            if (task.status === 'interrupted') affected.push(id);
        }
        return affected;
    }

    function dispose(): void {
        for (const task of tasks.values()) {
            if (task.status === 'queued') {
                transition(task, 'cancelled');
                task.settle(EMPTY_OUTCOME);
                queue.cancel(task.id);
            } else if (task.status === 'active') {
                task.controller.abort();
            }
        }
    }

    return { submit, cancel, getStatus, getError, getQueuePosition, reconcileInterrupted, dispose };
}

/** Aborts when either signal aborts; safe to call after one already aborted. */
function anySignal(a: AbortSignal, b: AbortSignal): AbortSignal {
    const controller = new AbortController();
    if (a.aborted || b.aborted) {
        controller.abort();
        return controller.signal;
    }
    a.addEventListener('abort', () => controller.abort(), { once: true });
    b.addEventListener('abort', () => controller.abort(), { once: true });
    return controller.signal;
}

/** Resolves with `work`'s value, or rejects early when `signal` aborts. */
function raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(new RenderTaskCancelledError());
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new RenderTaskCancelledError());
        signal.addEventListener('abort', onAbort, { once: true });
        work.then(
            (value) => {
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            },
        );
    });
}
