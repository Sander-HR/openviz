/**
 * Feature 012 — T007 render task service facade (FR-019, FR-020, R1).
 *
 * Thin composition over the pieces tasks.md built earlier: validate →
 * resolve (`renderTaskResolver`) → route by capability class through the
 * active protocol adapter → persist a machine-readable `TaskRecord`.
 * One active task per user comes from the injected coordinator (FR-022);
 * the FR-021 benchmark gate lives there too.
 *
 * Routing:
 * - `edit` / `reference` → OpenAI-compatible image target (native route).
 * - `video` → OpenAI-compatible video target (native route when capability
 *   probing reports it, else `/v1/videos`), with the ComfyUI wan-2.2
 *   animation workflow as fallback backend; a capability error surfaces only
 *   when no active protocol serves video (R1).
 * - `extract` → structured vision pipeline (`extractionService`).
 *
 * Protocol execution lives in `renderTaskRunners.ts` (Constitution V split).
 */

import type { ComputeSettings } from '@/types/executionTarget.types';
import type {
    BenchmarkStatus,
    RenderTaskKind,
    RenderTaskRequest,
    RenderTaskStatus,
    ResolvedRenderParameters,
    TaskRecord,
} from '@/types/renderTask.types';
import { generateUUID } from '@/utils/uuid';
import { resolveRenderTask } from './ai/renderTaskResolver';
import { createRenderTaskCoordinator } from './ai/renderTaskCoordinator';
import { createApiTaskRecordRepository, type TaskRecordRepositoryLike } from './renderTaskRepository';
import { buildExtractionRecord, buildProjectAsset, createApiExtractionAssetRepository, type ExtractionAssetRepositoryLike } from './extractionAssetRepository';
import { createRenderTaskRunners, RenderTaskCapabilityError, type RenderTaskResult } from './renderTaskRunners';

export { RenderTaskCapabilityError } from './renderTaskRunners';
export type { RenderTaskOutputRef, RenderTaskResult } from './renderTaskRunners';

/** Facade-level submission handle: queue id + persisted record id + result promise. */
export interface RenderTaskSubmitResult {
    /** Coordinator task id (queue/cancel handle). */
    id: string;
    /** Persisted TaskRecord id (FR-019). */
    recordId: string;
    promise: Promise<RenderTaskResult>;
}

export interface RenderTaskServiceDeps {
    getSettings: () => ComputeSettings;
    /** Resolve a connected reference id to a data URL (node attachment). */
    resolveReferenceImage: (imageId: string) => Promise<string | undefined>;
    repository?: TaskRecordRepositoryLike;
    coordinator?: ReturnType<typeof createRenderTaskCoordinator>;
    /** FR-021 provenance of the defaults; default `'starting'` trips the gate. */
    benchmarkStatusFor?: (kind: RenderTaskKind) => BenchmarkStatus;
    /** Injected fetch for the protocol targets and probes (tests). */
    fetcher?: typeof fetch;
    /** Video polling cadence; default 1000 ms. */
    pollIntervalMs?: number;
    /** FR-023: persistence target for completed extraction records + project assets. */
    assetRepository?: ExtractionAssetRepositoryLike;
    /** Project scope for saved assets; defaults to `'default'`. */
    projectId?: string;
}

export interface RenderTaskService {
    submit(request: RenderTaskRequest): Promise<RenderTaskSubmitResult>;
    cancel(id: string): boolean;
    getStatus(id: string): RenderTaskStatus;
    getError(id: string): string | null;
    getQueuePosition(id: string): number | null;
}

export function createRenderTaskService(deps: RenderTaskServiceDeps): RenderTaskService {
    const repository = deps.repository ?? createApiTaskRecordRepository();
    const assetRepository = deps.assetRepository ?? createApiExtractionAssetRepository();
    // Getter (not a snapshot): the service is a session singleton, so the gate
    // must reflect live settings when a submission arrives, not at creation.
    const coordinator = deps.coordinator ?? createRenderTaskCoordinator({ benchmarkGateEnabled: () => deps.getSettings().benchmarkGateEnabled });
    const runners = createRenderTaskRunners({
        getSettings: deps.getSettings,
        resolveReferenceImage: deps.resolveReferenceImage,
        ...(deps.fetcher ? { fetcher: deps.fetcher } : {}),
        pollIntervalMs: deps.pollIntervalMs ?? 1000,
    });

    /** A task whose backend cannot exist must fail at submission, not in the queue (spec edge case). */
    function assertCapability(resolved: ResolvedRenderParameters): void {
        const settings = deps.getSettings();
        const hasImageEndpoint = Boolean(settings.imageApiEndpoint?.trim());
        if (resolved.workflow === 'video') {
            const hasComfyFallback = settings.protocol === 'comfyui' && Boolean(settings.localEndpoint?.trim());
            if (!hasImageEndpoint && !hasComfyFallback) throw new RenderTaskCapabilityError('video');
            return;
        }
        if (!hasImageEndpoint) throw new RenderTaskCapabilityError('image');
    }

    async function submit(request: RenderTaskRequest): Promise<RenderTaskSubmitResult> {
        // Validation, resolution and capability checks happen before anything is persisted or queued.
        const resolved = resolveRenderTask(request, { benchmarkStatus: deps.benchmarkStatusFor?.(request.kind) ?? 'starting' });
        assertCapability(resolved);
        const now = Date.now();
        const recordId = generateUUID();

        const captured: { current?: RenderTaskResult } = {};
        const handle = await coordinator.submit({ request, benchmarkStatus: resolved.benchmarkStatus }, runners.buildRunner(request, resolved, captured));

        const settings = deps.getSettings();
        const record: TaskRecord = {
            id: recordId,
            projectId: null,
            kind: request.kind,
            request,
            resolved,
            protocol: settings.imageApiEndpoint?.trim() ? 'openai-compatible' : 'comfyui',
            modelFamily: settings.imageApiModel || null,
            status: 'queued',
            queuePositionAtSubmit: coordinator.getQueuePosition(handle.id),
            error: null,
            outputIds: [],
            createdAt: now,
            updatedAt: now,
        };
        await repository.create(record);

        // Terminal persistence rides the handle promise: the coordinator is the
        // authoritative state machine (queued-cancel skips the runner entirely).
        const promise = handle.promise.then((outcome): RenderTaskResult => {
            const status = coordinator.getStatus(handle.id);
            void repository
                .update(recordId, { status, outputIds: outcome.outputIds, error: coordinator.getError(handle.id) ?? null })
                .catch(() => undefined); // persistence must never break the result

            // FR-023: completed extractions become reusable project assets.
            const extraction = captured.current?.extraction;
            if (request.kind === 'extract' && status === 'completed' && extraction) {
                const nowTs = Date.now();
                const record = buildExtractionRecord({ taskId: recordId, sourceImageId: request.referenceImageId ?? '', id: generateUUID(), createdAt: nowTs }, extraction);
                const asset = buildProjectAsset({ id: generateUUID(), projectId: deps.projectId ?? 'default', extractionRecordId: record.id, createdAt: nowTs }, extraction);
                void assetRepository.save(record, asset).catch(() => undefined);
            }

            return { ...outcome, outputs: captured.current?.outputs ?? [], ...(extraction ? { extraction } : {}) };
        });

        return { id: handle.id, recordId, promise };
    }

    return {
        submit,
        cancel: (id) => coordinator.cancel(id),
        getStatus: (id) => coordinator.getStatus(id),
        getError: (id) => coordinator.getError(id),
        getQueuePosition: (id) => coordinator.getQueuePosition(id),
    };
}
