import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
});

/**
 * AI Generation Queue
 */
export const renderQueue = new Queue('render-jobs', { connection });

/**
 * Job Worker Implementation
 * NOTE: This will be run in a separate background process or an API route in development.
 */
export function createRenderWorker(handler: (job: Job) => Promise<void>) {
    return new Worker('render-jobs', handler, { connection });
}

/**
 * Helper to add a job to the queue
 */
export async function addRenderJob(projectId: string, payload: any) {
    return await renderQueue.add('generate', {
        projectId,
        payload,
    }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    });
}
