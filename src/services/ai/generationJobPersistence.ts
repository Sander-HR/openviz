import type { GenerationJob } from '@/types/generationJob.types';

export interface PersistedGenerationJobRecord {
    id: string;
    projectId: string;
    status: GenerationJob['status'];
    progress: number;
    resultUrl?: string;
    error?: string;
    retryOf?: string;
    metadata: GenerationJob;
}

export interface GenerationJobRepository {
    insert: (record: PersistedGenerationJobRecord) => Promise<void>;
    update: (id: string, updates: Partial<PersistedGenerationJobRecord>) => Promise<void>;
    find: (id: string) => Promise<PersistedGenerationJobRecord | undefined>;
}

export interface GenerationJobPersistence {
    create: (job: GenerationJob) => Promise<void>;
    update: (id: string, updates: Partial<GenerationJob>) => Promise<void>;
    get: (id: string) => Promise<GenerationJob | undefined>;
}

export type DatabaseGenerationJobStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'cancelled' | 'failed';

export interface DatabaseGenerationJobValues {
    id: string;
    projectId: string;
    type: 'product';
    status: DatabaseGenerationJobStatus;
    progress: number;
    resultUrl?: string;
    error?: string;
    retryOf?: string;
    metadata: GenerationJob;
}

export function toDatabaseJobValues(job: GenerationJob): DatabaseGenerationJobValues {
    const record = toRecord(job);
    return {
        ...record,
        type: 'product',
        status: job.status === 'queued' ? 'pending' : job.status === 'running' ? 'processing' : job.status,
    };
}

export function isGenerationJob(value: unknown): value is GenerationJob {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.id === 'string'
        && typeof candidate.workflowId === 'string'
        && typeof candidate.workflowVersion === 'string'
        && typeof candidate.targetId === 'string'
        && typeof candidate.status === 'string'
        && typeof candidate.progress === 'number'
        && Array.isArray(candidate.references)
        && Array.isArray(candidate.outputs)
        && typeof candidate.parameters === 'object'
        && candidate.parameters !== null;
}

function toRecord(job: GenerationJob): PersistedGenerationJobRecord {
    if (!job.projectId) throw new Error('Generation job projectId is required for durable persistence.');
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

function fromRecord(record: PersistedGenerationJobRecord): GenerationJob {
    return {
        ...record.metadata,
        status: record.status,
        progress: record.progress,
        retryOf: record.retryOf ?? record.metadata.retryOf,
        error: record.error
            ? record.metadata.error ?? { code: 'persisted-job-error', message: record.error, retryable: true }
            : record.metadata.error,
        updatedAt: Date.now(),
    };
}

export function createGenerationJobPersistence(repository: GenerationJobRepository): GenerationJobPersistence {
    return {
        async create(job) {
            await repository.insert(toRecord(job));
        },
        async update(id, updates) {
            const current = await repository.find(id);
            if (!current) throw new Error(`Generation job ${id} was not found.`);
            const nextJob = { ...current.metadata, ...updates, updatedAt: Date.now() };
            await repository.update(id, toRecord(nextJob));
        },
        async get(id) {
            const record = await repository.find(id);
            return record ? fromRecord(record) : undefined;
        },
    };
}

export { fromRecord, toRecord };
