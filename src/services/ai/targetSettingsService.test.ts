import { describe, expect, it } from 'vitest';
import type { ExecutionTarget, ExecutionTargetAdapter } from '@/types/executionTarget.types';
import { createTargetSettingsService, type TargetSettingsRepository } from './targetSettingsService';

const target: ExecutionTarget = {
    id: 'local-1', kind: 'local', endpoint: '/comfy-api', status: 'unknown', authState: 'unknown', capabilities: null, displayName: 'Local ComfyUI',
};

const adapter: ExecutionTargetAdapter = {
    health: async () => ({ targetId: target.id, status: 'ready', capabilities: { checkedAt: 1, devices: [], customNodes: [], availableModels: [], availableNodeTypes: [], supportedPrecisions: ['unknown'], supportedWorkflows: [] } }),
    capabilities: async () => ({ checkedAt: 2, devices: [], customNodes: ['ExampleNode'], availableModels: [], availableNodeTypes: [], supportedPrecisions: ['unknown'], supportedWorkflows: [] }),
    preflight: async () => ({ ready: true, status: 'ready', issues: [] }), submit: async () => ({ jobId: 'job', targetId: target.id }), getStatus: async () => ({ jobId: 'job', status: 'queued', progress: 0 }), cancel: async () => undefined, getOutputs: async () => [],
};

describe('target settings service', () => {
    it('validates and stores redacted target metadata, then refreshes health', async () => {
        const records = new Map<string, ExecutionTarget>();
        const repository: TargetSettingsRepository = {
            list: async () => [...records.values()],
            get: async (id) => records.get(id),
            save: async (next) => { records.set(next.id, next); return next; },
            update: async (id, updates) => { const current = records.get(id); if (current) records.set(id, { ...current, ...updates }); },
        };
        const service = createTargetSettingsService({ repository, adapterFactory: () => adapter });
        await service.saveTarget({ ...target, endpoint: 'http://localhost:8188' });
        const refreshed = await service.testConnection(target.id);
        expect(refreshed).toMatchObject({ status: 'ready', authState: 'unknown' });
    });

    it('rejects arbitrary protocols and credentials in browser-facing metadata', async () => {
        const repository: TargetSettingsRepository = { list: async () => [], get: async () => undefined, save: async (value) => value, update: async () => undefined };
        const service = createTargetSettingsService({ repository, adapterFactory: () => adapter });
        await expect(service.saveTarget({ ...target, endpoint: 'file:///etc/passwd' })).rejects.toThrow('HTTP');
        await expect(service.saveTarget({ ...target, endpoint: 'https://user:secret@example.com' })).rejects.toThrow('credentials');
    });
});
