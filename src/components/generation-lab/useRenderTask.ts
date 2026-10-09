'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { isImageBackendReady } from '@/services/ai/computeStatusService';
import { useStore } from '@/store/useStore';
import { imageApiProxyFetcher } from '@/services/ai/proxyFetcher';
import { createRenderTaskService, type RenderTaskService } from '@/services/renderTaskService';
import type { RenderTaskRequest } from '@/types/renderTask.types';

const POLL_INTERVAL_MS = 1000;

let sharedService: RenderTaskService | null = null;

/** One service per app session: the coordinator owns the one-active-task policy (FR-022). */
function getRenderTaskService(): RenderTaskService {
    if (!sharedService) {
        sharedService = createRenderTaskService({
            getSettings: () => useStore.getState().computeSettings,
            resolveReferenceImage: (imageId) => Promise.resolve(useStore.getState().renderReferences.find((reference) => reference.id === imageId)?.dataUrl),
            // OpenAI-compatible traffic is relayed through /api/ai/proxy so the
            // stored server-side key is used on every signed-in device.
            fetcher: imageApiProxyFetcher,
        });
    }
    return sharedService;
}

/**
 * The single fetch surface for render tasks (Constitution III). Mode components
 * build a `RenderTaskRequest` and call `submit`; all service interaction,
 * status polling and store updates live here.
 */
export interface GenerationTaskApi {
    /** Coordinator task id — set as soon as a task is created (queue/cancel handle). */
    taskId: string | null;
    status: ReturnType<typeof useStore.getState>['renderTaskStatus'];
    queuePosition: number | null;
    error: string | null;
    outputs: ReturnType<typeof useStore.getState>['renderTaskOutputs'];
    extraction: ReturnType<typeof useStore.getState>['renderTaskExtraction'];
    submit: (request: RenderTaskRequest) => void;
    cancel: () => void;
    retry: () => void;
    /** SC-008: re-run the last request locked to one output's seed. */
    regenerateWithSeed: (outputId: string) => void;
}

export function useRenderTask(service?: RenderTaskService): GenerationTaskApi {
    const activeService = service ?? getRenderTaskService();
    const status = useStore((state) => state.renderTaskStatus);
    const queuePosition = useStore((state) => state.renderTaskQueuePosition);
    const error = useStore((state) => state.renderTaskError);
    const outputs = useStore((state) => state.renderTaskOutputs);
    const extraction = useStore((state) => state.renderTaskExtraction);
    const taskId = useStore((state) => state.renderTaskId);

    // Poll coordinator status/queue position while a task is non-terminal.
    useEffect(() => {
        if (!taskId || (status !== 'queued' && status !== 'active')) return;
        const timer = setInterval(() => {
            const store = useStore.getState();
            const nextStatus = activeService.getStatus(taskId);
            const nextPosition = activeService.getQueuePosition(taskId);
            store.setRenderTaskProgress({
                status: nextStatus,
                queuePosition: nextPosition,
                ...(nextStatus === 'failed' ? { error: activeService.getError(taskId) ?? 'The render task failed.' } : {}),
            });
        }, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [taskId, status, activeService]);

    const submit = useCallback((request: RenderTaskRequest) => {
        const store = useStore.getState();
        store.setLastRenderRequest(request);
        // T031 (spec edge case): no image backend configured → fail fast with a
        // readiness error; the queued request above is preserved for retry.
        const readiness = isImageBackendReady(store.computeSettings);
        if (!readiness.ready) {
            store.setRenderTaskProgress({ status: 'failed', queuePosition: null, error: `AI not ready — ${readiness.reason ?? 'no image backend configured'}.` });
            return;
        }
        activeService
            .submit(request)
            .then(({ id, recordId, promise }) => {
                useStore.getState().setRenderTaskActive(id, recordId);
                void promise.then((result) => {
                    const finalStatus = activeService.getStatus(id);
                    useStore.getState().setRenderTaskProgress({
                        status: finalStatus,
                        queuePosition: null,
                        outputs: result.outputs,
                        extraction: result.extraction ?? null,
                        ...(finalStatus === 'failed' ? { error: activeService.getError(id) ?? 'The render task failed.' } : {}),
                    });
                });
            })
            .catch((error: unknown) => {
                useStore.getState().setRenderTaskProgress({
                    status: 'failed',
                    queuePosition: null,
                    error: error instanceof Error ? error.message : 'The render task could not be submitted.',
                });
            });
    }, [activeService]);

    const cancel = useCallback(() => {
        const store = useStore.getState();
        if (!store.renderTaskId) return;
        activeService.cancel(store.renderTaskId);
        store.setRenderTaskProgress({ status: activeService.getStatus(store.renderTaskId), queuePosition: null });
    }, [activeService]);

    const retry = useCallback(() => {
        const request = useStore.getState().lastRenderRequest;
        if (request) submit(request);
    }, [submit]);

    const regenerateWithSeed = useCallback((outputId: string) => {
        const store = useStore.getState();
        const request = store.lastRenderRequest;
        const output = store.renderTaskOutputs.find((entry) => entry.id === outputId);
        if (!request || output?.seed === undefined) return;
        submit({ ...request, seed: output.seed, variationCount: undefined });
    }, [submit]);

    // Memoized: consumers (e.g. the lab canvas) rely on a stable task identity to
    // keep React Flow node data references stable across renders.
    return useMemo(
        () => ({ taskId, status, queuePosition, error, outputs, extraction, submit, cancel, retry, regenerateWithSeed }),
        [taskId, status, queuePosition, error, outputs, extraction, submit, cancel, retry, regenerateWithSeed],
    );
}
