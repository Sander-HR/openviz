import { describe, expect, it, vi } from 'vitest';
import { createRenderTaskService } from '@/services/renderTaskService';
import type { ComputeSettings } from '@/types/executionTarget.types';
import type { ExtractionRecord, ProjectAsset, TaskRecord } from '@/types/renderTask.types';

type Fetcher = typeof fetch;

interface FetchMockLike {
    mock: { calls: Array<[RequestInfo | URL, RequestInit?]> };
}

const SETTINGS: ComputeSettings = {
    targetKind: 'hosted',
    protocol: 'openai-image',
    preference: 'balanced',
    localEndpoint: '',
    hostedEndpoint: '',
    imageApiEndpoint: 'http://localhost:8001/v1',
    imageApiKey: 'secret',
    imageApiKeyless: false,
    imageApiModels: ['vision-model'],
    imageApiModel: 'vision-model',
    imageApiSize: '1024x1024',
    endpointConcurrency: 2,
    benchmarkGateEnabled: true,
};

const VISION_OUTPUT = {
    kind: 'color',
    sampleBy: 'hierarchy',
    confidence: 0.9,
    components: [
        { name: 'Base', region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 }, color: { hex: '#111111', confidence: 0.8 } },
        { name: 'Stem', region: { x: 0.4, y: 0.3, w: 0.1, h: 0.4 }, color: { hex: '#b5892f', confidence: 0.7 } },
    ],
};

function makeFetcher(): Fetcher & FetchMockLike {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/v1/chat/completions') && init?.method === 'POST') {
            return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(VISION_OUTPUT) } }] }), { status: 200 });
        }
        throw new Error(`Unexpected fetch in extract-asset test: ${init?.method ?? 'GET'} ${url}`);
    }) as Fetcher & FetchMockLike;
}

function makeAssetRepo() {
    const saved: Array<{ record: ExtractionRecord; asset: ProjectAsset }> = [];
    return {
        saved,
        save: vi.fn(async (record: ExtractionRecord, asset: ProjectAsset) => {
            saved.push({ record, asset });
            return { recordId: record.id, assetId: asset.id };
        }),
        list: vi.fn(async () => [] as ProjectAsset[]),
    };
}

function makeService(assetRepo?: ReturnType<typeof makeAssetRepo>) {
    const taskRepo = { create: vi.fn(async (_record: TaskRecord) => undefined), update: vi.fn(async (_id: string, _patch: unknown) => undefined) };
    const service = createRenderTaskService({
        getSettings: () => SETTINGS,
        resolveReferenceImage: async () => 'data:image/png;base64,aW1n',
        repository: taskRepo,
        fetcher: makeFetcher(),
        pollIntervalMs: 1,
        benchmarkStatusFor: () => 'validated',
        ...(assetRepo ? { assetRepository: assetRepo } : {}),
    });
    return { service, taskRepo };
}

describe('renderTaskService — extraction assets (T024, FR-023)', () => {
    it('saves the completed extraction as a record + palette project asset', async () => {
        const assetRepo = makeAssetRepo();
        const { service } = makeService(assetRepo);

        const submitted = await service.submit({ kind: 'extract', referenceImageId: 'img-1', extractKind: 'color', sampleBy: 'hierarchy' });
        const outcome = await submitted.promise;

        expect(outcome.allOutputsSucceeded).toBe(true);
        expect(assetRepo.save).toHaveBeenCalledTimes(1);

        const { record, asset } = assetRepo.saved[0];
        expect(record.taskId).toBe(submitted.recordId);
        expect(record.kind).toBe('color');
        expect(record.sampleBy).toBe('hierarchy');
        expect(record.components).toHaveLength(2);
        expect(asset.extractionRecordId).toBe(record.id);
        expect(asset.kind).toBe('palette');
        expect((asset.payload as { swatches: string[] }).swatches).toEqual(['#111111', '#b5892f']);
    });

    it('does not save an asset when the extraction fails', async () => {
        const assetRepo = makeAssetRepo();
        const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith('/v1/chat/completions') && init?.method === 'POST') {
                return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'not json' } }] }), { status: 200 });
            }
            throw new Error('unexpected fetch');
        }) as Fetcher & FetchMockLike;
        const service = createRenderTaskService({
            getSettings: () => SETTINGS,
            resolveReferenceImage: async () => 'data:image/png;base64,aW1n',
            repository: { create: vi.fn(async () => undefined), update: vi.fn(async () => undefined) },
            fetcher,
            pollIntervalMs: 1,
            benchmarkStatusFor: () => 'validated',
            assetRepository: assetRepo,
        });

        const submitted = await service.submit({ kind: 'extract', referenceImageId: 'img-1', extractKind: 'color', sampleBy: 'hierarchy' });
        await submitted.promise;

        expect(assetRepo.save).not.toHaveBeenCalled();
    });

    it('works without an asset repository (backwards compatible)', async () => {
        const { service } = makeService();
        const submitted = await service.submit({ kind: 'extract', referenceImageId: 'img-1', extractKind: 'color', sampleBy: 'hierarchy' });
        const outcome = await submitted.promise;
        expect(outcome.allOutputsSucceeded).toBe(true);
    });
});
