/**
 * Feature 012 — render task coordinator: launch gate, batch semantics and
 * lifecycle (T029 split of the FR-022 queue tests).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BenchmarkGateError, createRenderTaskCoordinator } from './renderTaskCoordinator';
import type { RenderTaskRequest } from '@/types/renderTask.types';

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

describe('createRenderTaskCoordinator — FR-021 benchmark launch gate', () => {
    it('rejects submissions whose resolved defaults are still starting when the gate is enabled', async () => {
        const coordinator = createRenderTaskCoordinator({ benchmarkGateEnabled: true });
        await expect(
            coordinator.submit({ request: request({ kind: 'animate' }) }, async () => ({
                outputIds: ['out-1'],
                allOutputsSucceeded: true,
            })),
        ).rejects.toThrow(/animate/);
    });

    it('accepts submissions once the task kind is validated', async () => {
        const coordinator = createRenderTaskCoordinator();
        const handle = await coordinator.submit(
            { request: request(), benchmarkStatus: 'validated' },
            async () => ({ outputIds: ['out-1'], allOutputsSucceeded: true }),
        );
        await handle.promise;
        expect(coordinator.getStatus(handle.id)).toBe('completed');
    });

    it('accepts starting defaults when the gate is disabled', async () => {
        const coordinator = createRenderTaskCoordinator({ benchmarkGateEnabled: false });
        const handle = await coordinator.submit({ request: request() }, async () => ({
            outputIds: ['out-1'],
            allOutputsSucceeded: true,
        }));
        await handle.promise;
        expect(coordinator.getStatus(handle.id)).toBe('completed');
    });

    it('re-reads a getter gate at submit time, so live settings changes take effect without recreating the coordinator', async () => {
        let gateEnabled = true;
        const coordinator = createRenderTaskCoordinator({ benchmarkGateEnabled: () => gateEnabled });

        await expect(
            coordinator.submit({ request: request() }, async () => ({ outputIds: ['out-1'], allOutputsSucceeded: true })),
        ).rejects.toThrow(BenchmarkGateError);

        gateEnabled = false;
        const handle = await coordinator.submit(
            { request: request() },
            async () => ({ outputIds: ['out-1'], allOutputsSucceeded: true }),
        );
        await handle.promise;
        expect(coordinator.getStatus(handle.id)).toBe('completed');

        gateEnabled = true;
        await expect(
            coordinator.submit({ request: request() }, async () => ({ outputIds: ['out-2'], allOutputsSucceeded: true })),
        ).rejects.toThrow(BenchmarkGateError);
    });

    it('names the unvalidated task kind in the gate error', async () => {
        const coordinator = createRenderTaskCoordinator({ benchmarkGateEnabled: true });
        await expect(
            coordinator.submit({ request: request({ kind: 'new-view' }) }, async () => ({
                outputIds: ['out-1'],
                allOutputsSucceeded: true,
            })),
        ).rejects.toThrow(/new-view/);
    });
});

describe('createRenderTaskCoordinator — batch semantics (FR-022)', () => {
    it('treats a variation batch of N as one task with N outputs', async () => {
        const coordinator = makeCoordinator();
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const batch = await coordinator.submit(
            { request: request({ kind: 'color-variate', variationCount: 4 }), benchmarkStatus: 'validated' },
            async () => {
                await gate;
                return { outputIds: ['a', 'b', 'c', 'd'], allOutputsSucceeded: true };
            },
        );

        const second = await coordinator.submit(
            { request: request({ kind: 'color-variate', variationCount: 2 }), benchmarkStatus: 'validated' },
            async () => ({ outputIds: ['e', 'f'], allOutputsSucceeded: true }),
        );
        expect(coordinator.getQueuePosition(batch.id)).toBe(1);
        expect(coordinator.getQueuePosition(second.id)).toBe(2);

        release?.();
        await batch.promise;
        await second.promise;
        expect(coordinator.getStatus(batch.id)).toBe('completed');
    });
});

describe('createRenderTaskCoordinator — lifecycle', () => {
    let coordinator: ReturnType<typeof createRenderTaskCoordinator>;

    beforeEach(() => {
        coordinator = makeCoordinator();
    });

    afterEach(() => {
        coordinator.dispose();
    });

    it('dispose() cancels remaining queued work without throwing', async () => {
        // Gate stays pending forever so the first task remains `active` until dispose aborts it.
        const gate = new Promise<void>(() => undefined);
        await coordinator.submit({ request: request(), benchmarkStatus: 'validated' }, async () => {
            await gate;
            return { outputIds: ['out-1'], allOutputsSucceeded: true };
        });
        const queued = await coordinator.submit(
            { request: request(), benchmarkStatus: 'validated' },
            async () => ({ outputIds: ['out-2'], allOutputsSucceeded: true }),
        );
        coordinator.dispose();
        expect(coordinator.getStatus(queued.id)).toBe('cancelled');
    });
});
