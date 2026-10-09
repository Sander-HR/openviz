/**
 * Feature 012 — T005 render task coordinator (FR-021, FR-022).
 *
 * One active task per user with visible 1-based FIFO queue position, queued
 * cancel (no provider request sent), running-task cancel via abort signal,
 * the full status state machine incl. `partial`/`interrupted`, and the
 * FR-021 benchmark launch gate. Composes on top of `createGenerationQueue`.
 */

import { describe, expect, it } from 'vitest';
import { createRenderTaskCoordinator } from './renderTaskCoordinator';
import type { RenderTaskOutcome, RenderTaskRequest } from '@/types/renderTask.types';

function request(overrides: Partial<RenderTaskRequest> = {}): RenderTaskRequest {
    return {
        kind: 'modify',
        prompt: 'Change the finish to matte black',
        referenceImageId: 'ref-1',
        ...overrides,
    };
}

function makeCoordinator(): ReturnType<typeof createRenderTaskCoordinator> {
    return createRenderTaskCoordinator({ benchmarkGateEnabled: false });
}

/** Manually-resolved gate promise; `resolve()` releases the awaiting runner. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
    let release: () => void = () => undefined;
    const promise = new Promise<void>((r) => {
        release = () => r();
    });
    return { promise, resolve: release };
}

describe('createRenderTaskCoordinator — FIFO queueing (FR-022)', () => {
    it('runs the first task immediately and queues the second at position 2', async () => {
        const coordinator = makeCoordinator();
        const gate = deferred();

        const first = await coordinator.submit({ request: request() }, async () => {
            await gate.promise;
            return { outputIds: ['out-1'], allOutputsSucceeded: true };
        });
        const second = await coordinator.submit({ request: request() }, async () => ({
            outputIds: ['out-2'],
            allOutputsSucceeded: true,
        }));

        expect(coordinator.getStatus(first.id)).toBe('active');
        expect(coordinator.getQueuePosition(second.id)).toBe(2);
        expect(second.promise).toBeDefined();

        gate.resolve();
        await first.promise;
        await second.promise;
        expect(coordinator.getStatus(first.id)).toBe('completed');
        expect(coordinator.getStatus(second.id)).toBe('completed');
    });

    it('keeps a single task active even when concurrency would allow more', async () => {
        const coordinator = makeCoordinator();
        const started: string[] = [];
        const gate = deferred();

        const handles = await Promise.all(
            [0, 1, 2].map((index) =>
                coordinator.submit({ request: request() }, async () => {
                    started.push(`task-${index}`);
                    if (index === 0) await gate.promise;
                    return { outputIds: [`out-${index}`], allOutputsSucceeded: true };
                }),
            ),
        );

        expect(started).toEqual(['task-0']);
        gate.resolve();
        await Promise.all(handles.map((handle) => handle.promise));
        expect(started).toEqual(['task-0', 'task-1', 'task-2']);
    });
});

describe('createRenderTaskCoordinator — cancellation (FR-022)', () => {
    it('cancels a queued task before the provider request is ever sent', async () => {
        const coordinator = makeCoordinator();
        let firstRelease: (() => void) | undefined;
        const firstGate = new Promise<void>((resolve) => {
            firstRelease = resolve;
        });
        await coordinator.submit({ request: request() }, async () => {
            await firstGate;
            return { outputIds: ['out-1'], allOutputsSucceeded: true };
        });

        let runnerCalled = false;
        const second = await coordinator.submit({ request: request() }, async () => {
            runnerCalled = true;
            return { outputIds: ['out-2'], allOutputsSucceeded: true };
        });

        expect(coordinator.cancel(second.id)).toBe(true);
        await second.promise.catch(() => undefined);
        firstRelease?.();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(runnerCalled).toBe(false);
        expect(coordinator.getStatus(second.id)).toBe('cancelled');
    });

    it('cancels a running task through its abort signal', async () => {
        const coordinator = makeCoordinator();
        let signal: AbortSignal | undefined;
        const handle = await coordinator.submit({ request: request() }, async (context) => {
            signal = context.signal;
            await new Promise<void>((resolve, reject) => {
                context.signal.addEventListener('abort', () => reject(new Error('aborted')));
                setTimeout(resolve, 50);
            }).catch(() => undefined);
            return { outputIds: [], allOutputsSucceeded: false };
        });

        expect(coordinator.cancel(handle.id)).toBe(true);
        await handle.promise;
        expect(signal?.aborted).toBe(true);
        expect(coordinator.getStatus(handle.id)).toBe('cancelled');
    });

    it('reports running-task cancel as unsupported and lets the task run to completion', async () => {
        const coordinator = createRenderTaskCoordinator({
            benchmarkGateEnabled: false,
            getSupportsCancel: () => false,
        });
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const handle = await coordinator.submit({ request: request() }, async () => {
            await gate;
            return { outputIds: ['out-1'], allOutputsSucceeded: true };
        });

        expect(coordinator.cancel(handle.id)).toBe(false); // no cancel route on the backend
        release?.();
        await handle.promise;
        expect(coordinator.getStatus(handle.id)).toBe('completed');
    });

    it('rejects cancel for terminal tasks', async () => {
        const coordinator = makeCoordinator();
        const handle = await coordinator.submit({ request: request() }, async () => ({
            outputIds: ['out-1'],
            allOutputsSucceeded: true,
        }));
        await handle.promise;
        expect(coordinator.cancel(handle.id)).toBe(false);
    });
});

describe('createRenderTaskCoordinator — terminal states (FR-022)', () => {
    it('marks a task partial when some outputs succeed', async () => {
        const coordinator = makeCoordinator();
        const handle = await coordinator.submit({ request: request({ variationCount: 4 }) }, async () => ({
            outputIds: ['out-1', 'out-2'],
            allOutputsSucceeded: false,
        }));
        await handle.promise;
        expect(coordinator.getStatus(handle.id)).toBe('partial');
    });

    it('marks a task failed when the runner rejects and nothing succeeded', async () => {
        const coordinator = makeCoordinator();
        const handle = await coordinator.submit({ request: request() }, async () => {
            throw new Error('endpoint 500');
        });
        await handle.promise;
        expect(coordinator.getStatus(handle.id)).toBe('failed');
    });

    it('treats an abort-rejected runner as cancelled, not failed', async () => {
        const coordinator = makeCoordinator();
        let captured: AbortSignal | undefined;
        const handle = await coordinator.submit({ request: request() }, async (context) => {
            captured = context.signal;
            if (context.signal.aborted) throw new Error('aborted');
            return new Promise<RenderTaskOutcome>(() => undefined);
        });
        // Give the runner a tick to capture its signal, then cancel mid-run.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(coordinator.cancel(handle.id)).toBe(true);
        await handle.promise;
        expect(captured?.aborted).toBe(true);
        expect(coordinator.getStatus(handle.id)).toBe('cancelled');
    });

    it('marks active tasks interrupted on reconcile; queued tasks are restored (data-model.md §4)', async () => {
        const coordinator = makeCoordinator();
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const running = await coordinator.submit({ request: request() }, async () => {
            await gate;
            return { outputIds: ['out-1'], allOutputsSucceeded: true };
        });
        const queued = await coordinator.submit({ request: request() }, async () => ({
            outputIds: ['out-2'],
            allOutputsSucceeded: true,
        }));

        expect(coordinator.reconcileInterrupted([running.id, queued.id])).toEqual([running.id]);
        expect(coordinator.getStatus(running.id)).toBe('interrupted');
        // Queued tasks survive a reload as restored queue entries.
        expect(coordinator.getStatus(queued.id)).toBe('queued');

        release?.();
        await running.promise;
        await queued.promise;
        const done = await coordinator.submit({ request: request() }, async () => ({
            outputIds: ['out-3'],
            allOutputsSucceeded: true,
        }));
        await done.promise;
        // Terminal tasks are left untouched.
        expect(coordinator.reconcileInterrupted([done.id])).toEqual([]);
    });
});
