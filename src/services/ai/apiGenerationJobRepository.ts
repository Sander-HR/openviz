import type { GenerationJob } from '@/types/generationJob.types';
import {
    createGenerationJobPersistence,
    isGenerationJob,
    type GenerationJobPersistence,
    type GenerationJobRepository,
    type PersistedGenerationJobRecord,
} from './generationJobPersistence';

const DEFAULT_BASE_URL = '/api/jobs';

interface ApiErrorBody {
    error?: string;
}

function toRecordFromApiJob(job: GenerationJob): PersistedGenerationJobRecord | undefined {
    if (!job.projectId) return undefined;
    return {
        id: job.id,
        projectId: job.projectId,
        status: job.status,
        progress: job.progress,
        resultUrl: job.outputs[0]?.url,
        error: job.error?.message,
        retryOf: job.retryOf,
        metadata: job,
    };
}

export function createApiGenerationJobRepository(baseUrl: string = DEFAULT_BASE_URL): GenerationJobRepository {
    async function send(path: string, init: RequestInit): Promise<Response> {
        const response = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers: { 'Content-Type': 'application/json', ...init.headers },
        });
        if (!response.ok) {
            const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
            throw new Error(body?.error ?? `Generation job request failed with status ${response.status}.`);
        }
        return response;
    }

    return {
        async insert(record) {
            await send(`/${record.id}`, { method: 'POST', body: JSON.stringify({ job: record.metadata }) });
        },
        async update(id, updates) {
            await send(`/${id}`, { method: 'PATCH', body: JSON.stringify({ job: updates.metadata }) });
        },
        async find(id) {
            const response = await fetch(`${baseUrl}/${id}`);
            if (response.status === 404) return undefined;
            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
                throw new Error(body?.error ?? `Generation job request failed with status ${response.status}.`);
            }
            const payload = (await response.json()) as unknown;
            if (!isGenerationJob(payload)) return undefined;
            return toRecordFromApiJob(payload);
        },
    };
}

export function createApiGenerationJobPersistence(baseUrl: string = DEFAULT_BASE_URL): GenerationJobPersistence {
    return createGenerationJobPersistence(createApiGenerationJobRepository(baseUrl));
}
