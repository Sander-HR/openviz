import { generateUUID } from '@/utils/uuid';

export interface GenerationQueueSnapshot {
    endpoint: string;
    active: number;
    queued: number;
    concurrency: number;
}

export interface GenerationQueueTaskContext {
    signal: AbortSignal;
}

export interface GenerationQueueHandle<T> {
    id: string;
    promise: Promise<T>;
}

export class GenerationQueueCancelledError extends Error {
    readonly code = 'cancelled';

    constructor() {
        super('The generation was cancelled before it started.');
        this.name = 'GenerationQueueCancelledError';
    }
}

type QueueTask<T> = (context: GenerationQueueTaskContext) => Promise<T>;

interface QueueEntry<T> {
    id: string;
    task: QueueTask<T>;
    controller: AbortController;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
    state: 'queued' | 'running';
}

interface EndpointQueue {
    active: number;
    entries: Array<QueueEntry<unknown>>;
}

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 3;

function clampConcurrency(value: number): number {
    if (!Number.isFinite(value)) return 2;
    return Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, Math.floor(value)));
}

export function createGenerationQueue(initialConcurrency = 2) {
    let concurrency = clampConcurrency(initialConcurrency);
    const queues = new Map<string, EndpointQueue>();
    const listeners = new Set<(snapshot: GenerationQueueSnapshot) => void>();

    function getEndpointQueue(endpoint: string): EndpointQueue {
        const existing = queues.get(endpoint);
        if (existing) return existing;
        const created: EndpointQueue = { active: 0, entries: [] };
        queues.set(endpoint, created);
        return created;
    }

    function snapshot(endpoint: string): GenerationQueueSnapshot {
        const queue = getEndpointQueue(endpoint);
        return {
            endpoint,
            active: queue.active,
            queued: queue.entries.filter((entry) => entry.state === 'queued').length,
            concurrency,
        };
    }

    function notify(endpoint: string): void {
        const current = snapshot(endpoint);
        listeners.forEach((listener) => listener(current));
    }

    function drain(endpoint: string): void {
        const queue = getEndpointQueue(endpoint);
        while (queue.active < concurrency) {
            const entry = queue.entries.find((candidate) => candidate.state === 'queued');
            if (!entry) break;
            entry.state = 'running';
            queue.active += 1;
            notify(endpoint);

            void entry.task({ signal: entry.controller.signal })
                .then(entry.resolve, entry.reject)
                .finally(() => {
                    queue.active -= 1;
                    const index = queue.entries.indexOf(entry);
                    if (index >= 0) queue.entries.splice(index, 1);
                    notify(endpoint);
                    drain(endpoint);
                });
        }
    }

    function enqueue<T>(endpoint: string, task: QueueTask<T>): GenerationQueueHandle<T> {
        const queue = getEndpointQueue(endpoint);
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
        });
        const entry: QueueEntry<T> = {
            id: generateUUID(),
            task,
            controller: new AbortController(),
            resolve,
            reject,
            state: 'queued',
        };
        queue.entries.push(entry as QueueEntry<unknown>);
        notify(endpoint);
        drain(endpoint);
        return { id: entry.id, promise };
    }

    function cancel(id: string): boolean {
        for (const [endpoint, queue] of queues) {
            const index = queue.entries.findIndex((entry) => entry.id === id);
            if (index < 0) continue;
            const entry = queue.entries[index];
            if (entry.state !== 'queued') return false;
            queue.entries.splice(index, 1);
            entry.controller.abort();
            entry.reject(new GenerationQueueCancelledError());
            notify(endpoint);
            return true;
        }
        return false;
    }

    return {
        enqueue,
        cancel,
        getSnapshot: snapshot,
        setConcurrency(value: number): void {
            concurrency = clampConcurrency(value);
            queues.forEach((_queue, endpoint) => {
                notify(endpoint);
                drain(endpoint);
            });
        },
        subscribe(listener: (snapshot: GenerationQueueSnapshot) => void): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
