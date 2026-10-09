/**
 * Feature 012 — T007 task-record repository (FR-019).
 *
 * Client-side fetch wrapper over the `/api/render-tasks` routes, mirroring
 * `apiGenerationJobRepository`. The server side persists to Drizzle's
 * `task_records` table (T004 migration).
 */

import type { TaskRecord } from '@/types/renderTask.types';

export interface TaskRecordPatch {
    status?: TaskRecord['status'];
    error?: string | null;
    outputIds?: string[];
}

export interface TaskRecordRepositoryLike {
    create: (record: TaskRecord) => Promise<void>;
    update: (id: string, patch: TaskRecordPatch) => Promise<void>;
}

const DEFAULT_BASE_URL = '/api/render-tasks';

interface ApiErrorBody {
    error?: string;
}

export function createApiTaskRecordRepository(
    baseUrl: string = DEFAULT_BASE_URL,
    fetcher: typeof fetch = fetch,
): TaskRecordRepositoryLike {
    async function send(path: string, init: RequestInit): Promise<void> {
        const response = await fetcher(`${baseUrl}${path}`, {
            ...init,
            headers: { 'Content-Type': 'application/json', ...init.headers },
        });
        if (!response.ok) {
            const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
            throw new Error(body?.error ?? `Task record request failed with status ${response.status}.`);
        }
    }

    return {
        create: (record) => send('', { method: 'POST', body: JSON.stringify({ record }) }),
        update: (id, patch) => send(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    };
}
