import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExecutionTargetAdapter, ExecutionTargetKind } from '@/types/executionTarget.types';
import type { GenerationJob } from '@/types/generationJob.types';
import { useStore } from '@/store/useStore';
import { cancelProductWorkflow, isTerminalJobStatus, pollProductWorkflow, type SubmittedProductJob } from '@/services/ai/generationJobService';
import { createApiGenerationJobPersistence } from '@/services/ai/apiGenerationJobRepository';
import { createProductConceptRequest, submitProductConcept, type ProductConceptInput } from '@/services/ai/productConceptGeneration';
import { submitProductVariants, type ProductVariantInput } from '@/services/ai/productVariantGeneration';

interface UseProductGenerationOptions {
    adapter: ExecutionTargetAdapter | null;
    targetKind: ExecutionTargetKind;
    targetId?: string;
    projectId?: string;
}

export function useProductGeneration({ adapter, targetKind, targetId, projectId }: UseProductGenerationOptions) {
    const jobs = useStore((state) => state.productJobs);
    const upsertProductJob = useStore((state) => state.upsertProductJob);
    const updateProductJob = useStore((state) => state.updateProductJob);
    const [error, setError] = useState<string | null>(null);
    const submittedJobs = useRef(new Map<string, SubmittedProductJob>());
    const persistence = useMemo(() => createApiGenerationJobPersistence(), []);

    const generateConcept = useCallback(async (input: Omit<ProductConceptInput, 'projectId'>) => {
        if (!adapter) {
            const message = 'Connect an execution target before generating concepts.';
            setError(message);
            throw new Error(message);
        }
        setError(null);
        const submitted = await submitProductConcept(adapter, { ...input, projectId }, targetKind, targetId, { persistence });
        submittedJobs.current.set(submitted.id, submitted);
        upsertProductJob(submitted);
        return submitted;
    }, [adapter, persistence, projectId, targetId, targetKind, upsertProductJob]);

    const generateVariants = useCallback(async (input: Omit<ProductVariantInput, 'projectId'>) => {
        if (!adapter) {
            const message = 'Connect an execution target before generating variants.';
            setError(message);
            throw new Error(message);
        }
        setError(null);
        const submitted = await submitProductVariants(adapter, { ...input, projectId }, targetKind, targetId, { persistence });
        submittedJobs.current.set(submitted.id, submitted);
        upsertProductJob(submitted);
        return submitted;
    }, [adapter, persistence, projectId, targetId, targetKind, upsertProductJob]);

    useEffect(() => {
        if (!adapter) return undefined;
        const pendingJobs = Object.values(jobs).filter((job) => job.remoteJobId && !isTerminalJobStatus(job.status));
        if (pendingJobs.length === 0) return undefined;
        const timer = window.setInterval(() => {
            pendingJobs.forEach((job) => {
                void refreshJob(job.id).catch((pollError: unknown) => {
                    updateProductJob(job.id, {
                        status: 'failed',
                        error: { code: 'status-poll-failed', message: pollError instanceof Error ? pollError.message : 'Unable to read job status.', retryable: true },
                    });
                });
            });
        }, 1500);
        return () => window.clearInterval(timer);
    }, [adapter, jobs, updateProductJob]);

    const refreshJob = useCallback(async (jobId: string) => {
        const submitted = submittedJobs.current.get(jobId);
        if (!adapter || !submitted) return jobs[jobId];
        const refreshed = await pollProductWorkflow(adapter, submitted, { persistence });
        submittedJobs.current.set(jobId, refreshed);
        upsertProductJob(refreshed);
        return refreshed;
    }, [adapter, jobs, persistence, upsertProductJob]);

    const cancelJob = useCallback(async (jobId: string) => {
        const submitted = submittedJobs.current.get(jobId);
        if (!adapter || !submitted) return;
        const cancelled = await cancelProductWorkflow(adapter, submitted, { persistence });
        submittedJobs.current.set(jobId, cancelled);
        upsertProductJob(cancelled);
    }, [adapter, persistence, upsertProductJob]);

    const isGenerating = useMemo(() => Object.values(jobs).some((job) => job.status === 'queued' || job.status === 'running'), [jobs]);

    return {
        jobs,
        error,
        isGenerating,
        generateConcept,
        generateVariants,
        refreshJob,
        cancelJob,
        clearError: () => setError(null),
        updateJob: (jobId: string, updates: Partial<GenerationJob>) => updateProductJob(jobId, updates),
        createConceptRequest: createProductConceptRequest,
    };
}
