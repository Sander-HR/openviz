import { describe, expect, it, vi } from 'vitest';
import { createApiExtractionAssetRepository, buildExtractionRecord, buildProjectAsset } from '@/services/extractionAssetRepository';
import type { ExtractionOutput } from '@/services/ai/extractionService';
import type { ProjectAsset } from '@/types/renderTask.types';

const COLOR_OUTPUT: ExtractionOutput = {
    kind: 'color',
    sampleBy: 'hierarchy',
    confidence: 0.9,
    components: [
        { name: 'Base', region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 }, color: { hex: '#111111', confidence: 0.8 } },
        { name: 'Stem', region: { x: 0.4, y: 0.3, w: 0.1, h: 0.4 }, color: { hex: '#b5892f', confidence: 0.7 } },
    ],
};

const MATERIAL_OUTPUT: ExtractionOutput = {
    kind: 'material',
    sampleBy: 'hierarchy',
    confidence: 0.8,
    components: [
        {
            name: 'Base',
            region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 },
            material: { observations: ['matte'], inferences: ['painted metal'] },
        },
    ],
};

const PARTS_OUTPUT: ExtractionOutput = {
    kind: 'parts',
    sampleBy: 'region',
    confidence: 0.85,
    components: [
        { name: 'Base', role: 'support', region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 } },
        { name: 'Shade', role: 'light housing', region: { x: 0.3, y: 0.1, w: 0.4, h: 0.3 } },
    ],
};

describe('buildExtractionRecord / buildProjectAsset (T024, FR-023)', () => {
    it('maps a color extraction to an ExtractionRecord + palette ProjectAsset', () => {
        const record = buildExtractionRecord({ taskId: 'task-1', sourceImageId: 'img-1', id: 'rec-1', createdAt: 1000 }, COLOR_OUTPUT);
        expect(record.kind).toBe('color');
        expect(record.sampleBy).toBe('hierarchy');
        expect(record.taskId).toBe('task-1');
        expect(record.components).toHaveLength(2);
        expect(record.confidence).toBe(0.9);

        const asset = buildProjectAsset({ id: 'asset-1', projectId: 'project-1', extractionRecordId: record.id, createdAt: 1000 }, COLOR_OUTPUT);
        expect(asset.kind).toBe('palette');
        expect(asset.extractionRecordId).toBe('rec-1');
        expect((asset.payload as { swatches: string[] }).swatches).toEqual(['#111111', '#b5892f']);
    });

    it('maps a material extraction to material-notes with per-component attributes', () => {
        const asset = buildProjectAsset({ id: 'asset-2', projectId: 'project-1', extractionRecordId: 'rec-2', createdAt: 1000 }, MATERIAL_OUTPUT);
        expect(asset.kind).toBe('material-notes');
        const payload = asset.payload as { components: Array<{ name: string }> };
        expect(payload.components.map((entry) => entry.name)).toEqual(['Base']);
    });

    it('maps a parts extraction to a part-list with names and roles', () => {
        const asset = buildProjectAsset({ id: 'asset-3', projectId: 'project-1', extractionRecordId: 'rec-3', createdAt: 1000 }, PARTS_OUTPUT);
        expect(asset.kind).toBe('part-list');
        const payload = asset.payload as { components: Array<{ name: string; role?: string }> };
        expect(payload.components).toEqual([
            { name: 'Base', role: 'support' },
            { name: 'Shade', role: 'light housing' },
        ]);
    });

    it('drops components without a usable color when building a palette', () => {
        const asset = buildProjectAsset({ id: 'asset-4', projectId: 'p', extractionRecordId: 'r', createdAt: 1 }, {
            ...COLOR_OUTPUT,
            components: [{ name: 'Base', region: { x: 0, y: 0, w: 0.1, h: 0.1 }, color: null }],
        });
        expect((asset.payload as { swatches: string[] }).swatches).toEqual([]);
    });
});

describe('createApiExtractionAssetRepository (T024, FR-023)', () => {
    it('POSTs the record + asset pair and returns the ids', async () => {
        const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ recordId: 'rec-1', assetId: 'asset-1' }), { status: 201 }));
        const repository = createApiExtractionAssetRepository('http://localhost/api/extraction-assets', fetcher as typeof fetch);

        const result = await repository.save(
            buildExtractionRecord({ taskId: 't', sourceImageId: 'i', id: 'rec-1', createdAt: 1 }, COLOR_OUTPUT),
            buildProjectAsset({ id: 'asset-1', projectId: 'p', extractionRecordId: 'rec-1', createdAt: 1 }, COLOR_OUTPUT),
        );

        expect(result).toEqual({ recordId: 'rec-1', assetId: 'asset-1' });
        const [url, init] = fetcher.mock.calls[0];
        expect(String(url)).toBe('http://localhost/api/extraction-assets');
        expect(init?.method).toBe('POST');
        const body = JSON.parse((init?.body as string) ?? '{}') as { record: unknown; asset: unknown };
        expect(body.record).toBeTruthy();
        expect(body.asset).toBeTruthy();
    });

    it('surfaces the server error message on failure', async () => {
        const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ error: 'assets are unavailable' }), { status: 500 }));
        const repository = createApiExtractionAssetRepository('http://localhost/api/extraction-assets', fetcher as typeof fetch);

        await expect(
            repository.save(
                buildExtractionRecord({ taskId: 't', sourceImageId: 'i', id: 'rec-1', createdAt: 1 }, COLOR_OUTPUT),
                buildProjectAsset({ id: 'asset-1', projectId: 'p', extractionRecordId: 'rec-1', createdAt: 1 }, COLOR_OUTPUT),
            ),
        ).rejects.toThrow('assets are unavailable');
    });

    it('lists a project\'s saved assets by project id', async () => {
        const rows: ProjectAsset[] = [buildProjectAsset({ id: 'asset-1', projectId: 'p', extractionRecordId: 'rec-1', createdAt: 1 }, COLOR_OUTPUT)];
        const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(rows), { status: 200 }));
        const repository = createApiExtractionAssetRepository('http://localhost/api/extraction-assets', fetcher as typeof fetch);

        const assets = await repository.list('p');
        expect(assets).toEqual(rows);
        expect(String(fetcher.mock.calls[0][0])).toBe('http://localhost/api/extraction-assets?projectId=p');
    });
});
