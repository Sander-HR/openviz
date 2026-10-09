import { describe, expect, it, vi } from 'vitest';
import { createGenerationQueue } from './generationQueue';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('generation queue', () => {
    it('runs at most the configured number of jobs per endpoint in FIFO order', async () => {
        const queue = createGenerationQueue(2);
        const first = deferred<string>();
        const second = deferred<string>();
        const third = deferred<string>();
        const started: string[] = [];

        const a = queue.enqueue('endpoint-a', async () => {
            started.push('a');
            return first.promise;
        });
        const b = queue.enqueue('endpoint-a', async () => {
            started.push('b');
            return second.promise;
        });
        const c = queue.enqueue('endpoint-a', async () => {
            started.push('c');
            return third.promise;
        });

        await vi.waitFor(() => expect(started).toEqual(['a', 'b']));
        expect(queue.getSnapshot('endpoint-a')).toMatchObject({ active: 2, queued: 1, concurrency: 2 });

        first.resolve('first');
        await expect(a.promise).resolves.toBe('first');
        await vi.waitFor(() => expect(started).toEqual(['a', 'b', 'c']));

        second.resolve('second');
        third.resolve('third');
        await expect(Promise.all([b.promise, c.promise])).resolves.toEqual(['second', 'third']);
        expect(queue.getSnapshot('endpoint-a')).toMatchObject({ active: 0, queued: 0 });
    });

    it('isolates concurrency between endpoints', async () => {
        const queue = createGenerationQueue(1);
        const endpointA = deferred<void>();
        const endpointB = deferred<void>();
        const started: string[] = [];

        const a = queue.enqueue('a', async () => {
            started.push('a');
            return endpointA.promise;
        });
        const b = queue.enqueue('b', async () => {
            started.push('b');
            return endpointB.promise;
        });

        await vi.waitFor(() => expect(started).toEqual(['a', 'b']));
        endpointA.resolve();
        endpointB.resolve();
        await Promise.all([a.promise, b.promise]);
    });

    it('cancels queued jobs without starting them', async () => {
        const queue = createGenerationQueue(1);
        const active = deferred<void>();
        const task = vi.fn(async () => undefined);
        const first = queue.enqueue('endpoint', () => active.promise);
        const second = queue.enqueue('endpoint', task);

        expect(queue.cancel(second.id)).toBe(true);
        await expect(second.promise).rejects.toMatchObject({ code: 'cancelled' });
        expect(task).not.toHaveBeenCalled();

        active.resolve();
        await first.promise;
    });

    it('clamps concurrency settings to one through three', () => {
        const queue = createGenerationQueue(99);
        expect(queue.getSnapshot('endpoint').concurrency).toBe(3);
        queue.setConcurrency(0);
        expect(queue.getSnapshot('endpoint').concurrency).toBe(1);
        queue.setConcurrency(2);
        expect(queue.getSnapshot('endpoint').concurrency).toBe(2);
    });
});
