/**
 * Feature 012 — T024 extraction-asset persistence (FR-023).
 *
 * Completed extraction results are saved as a structured `ExtractionRecord`
 * plus one referenceable `ProjectAsset` (palette / material-notes / part-list)
 * so other tasks and nodes can reuse the harvested design data.
 */

import type { ExtractionOutput } from './ai/extractionService';
import type { ExtractionRecord, MaterialNotesAssetPayload, PartListAssetPayload, PaletteAssetPayload, ProjectAsset } from '@/types/renderTask.types';

export interface ExtractionAssetRepositoryLike {
    save: (record: ExtractionRecord, asset: ProjectAsset) => Promise<{ recordId: string; assetId: string }>;
    list: (projectId: string) => Promise<ProjectAsset[]>;
}

interface RecordMeta {
    taskId: string;
    sourceImageId: string;
    id: string;
    createdAt: number;
}

interface AssetMeta {
    id: string;
    projectId: string;
    extractionRecordId: string;
    createdAt: number;
}

/** Structured record of the full extraction (FR-018/FR-023 provenance). */
export function buildExtractionRecord(meta: RecordMeta, output: ExtractionOutput): ExtractionRecord {
    return {
        id: meta.id,
        taskId: meta.taskId,
        sourceImageId: meta.sourceImageId,
        kind: output.kind,
        sampleBy: output.sampleBy,
        components: output.components,
        confidence: output.confidence,
        createdAt: meta.createdAt,
    };
}

/** The reusable project asset derived from an extraction (FR-023). */
export function buildProjectAsset(meta: AssetMeta, output: ExtractionOutput): ProjectAsset {
    let kind: ProjectAsset['kind'];
    let payload: PaletteAssetPayload | MaterialNotesAssetPayload | PartListAssetPayload;
    if (output.kind === 'color') {
        kind = 'palette';
        payload = { swatches: output.components.map((component) => component.color?.hex).filter((hex): hex is string => Boolean(hex)) };
    } else if (output.kind === 'material') {
        kind = 'material-notes';
        payload = { components: output.components.filter((component) => component.material !== null && component.material !== undefined).map((component) => ({ name: component.name, material: component.material as NonNullable<typeof component.material> })) };
    } else {
        kind = 'part-list';
        payload = { components: output.components.map((component) => ({ name: component.name, ...(component.role ? { role: component.role } : {}) })) };
    }
    return { id: meta.id, projectId: meta.projectId, kind, extractionRecordId: meta.extractionRecordId, payload, createdAt: meta.createdAt };
}

const DEFAULT_BASE_URL = '/api/extraction-assets';

interface ApiErrorBody {
    error?: string;
}

export function createApiExtractionAssetRepository(baseUrl: string = DEFAULT_BASE_URL, fetcher: typeof fetch = fetch): ExtractionAssetRepositoryLike {
    async function save(record: ExtractionRecord, asset: ProjectAsset): Promise<{ recordId: string; assetId: string }> {
        const response = await fetcher(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ record, asset }),
        });
        if (!response.ok) {
            const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
            throw new Error(body?.error ?? `Extraction asset request failed with status ${response.status}.`);
        }
        const body = (await response.json().catch(() => ({}))) as { recordId?: string; assetId?: string };
        return { recordId: body.recordId ?? record.id, assetId: body.assetId ?? asset.id };
    }

    async function list(projectId: string): Promise<ProjectAsset[]> {
        const response = await fetcher(`${baseUrl}?projectId=${encodeURIComponent(projectId)}`);
        if (!response.ok) {
            const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
            throw new Error(body?.error ?? `Extraction asset list request failed with status ${response.status}.`);
        }
        return (await response.json()) as ProjectAsset[];
    }

    return { save, list };
}
