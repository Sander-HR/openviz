import type { ExecutionTargetAdapter, NormalizedJobStatus, PreflightResult } from '@/types/executionTarget.types';
import type { GenerationJob, GenerationJobError, GenerationJobStatus } from '@/types/generationJob.types';
import type { ExecutionTargetKind } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { validateProductWorkflowRequest } from './workflowValidation';
import type { GenerationJobPersistence } from './generationJobPersistence';
import { generateUUID } from '@/utils/uuid';
import { getProductWorkflow } from './productWorkflowRegistry';

export interface SubmittedProductJob extends GenerationJob {
    remoteJobId?: string;
    preflight: PreflightResult;
}

export interface ProductJobOptions {
    persistence?: GenerationJobPersistence;
}

function makeError(preflight: PreflightResult): GenerationJobError {
    return {
        code: preflight.issues[0]?.code ?? 'preflight-failed',
        message: preflight.issues[0]?.message ?? 'Workflow preflight failed.',
        retryable: true,
    };
}

function makeSubmissionError(error: unknown): GenerationJobError {
    return {
        code: 'submission-failed',
        message: error instanceof Error ? error.message : 'The execution target rejected the workflow.',
        retryable: true,
    };
}

function terminalUpdates(job: GenerationJob): Partial<GenerationJob> {
    const updates: Partial<GenerationJob> = { status: job.status, progress: job.progress };
    if (job.error) updates.error = job.error;
    if (job.remoteJobId) updates.remoteJobId = job.remoteJobId;
    if (job.preflight) updates.preflight = job.preflight;
    if (job.outputs.length > 0) updates.outputs = job.outputs;
    return updates;
}

async function persistCreate(persistence: GenerationJobPersistence | undefined, job: GenerationJob): Promise<void> {
    if (!persistence || !job.projectId) return;
    try {
        await persistence.create(job);
    } catch (error) {
        console.error(`Failed to persist generation job ${job.id}.`, error);
    }
}

async function persistUpdate(persistence: GenerationJobPersistence | undefined, job: GenerationJob, updates: Partial<GenerationJob>): Promise<void> {
    if (!persistence || !job.projectId) return;
    try {
        await persistence.update(job.id, updates);
    } catch (error) {
        console.error(`Failed to persist generation job ${job.id}.`, error);
    }
}

function applyStatus(job: SubmittedProductJob, status: NormalizedJobStatus, outputs: GenerationJob['outputs']): SubmittedProductJob {
    return {
        ...job,
        status: status.status,
        progress: Math.max(0, Math.min(100, status.progress)),
        outputs,
        error: status.status === 'failed'
            ? { code: 'remote-job-failed', message: status.message ?? 'The execution target reported a failure.', retryable: true }
            : undefined,
        updatedAt: Date.now(),
    };
}

export async function submitProductWorkflow(
    adapter: ExecutionTargetAdapter,
    request: ProductWorkflowRequest,
    targetKind: ExecutionTargetKind,
    targetId = 'active-target',
    options?: ProductJobOptions
): Promise<SubmittedProductJob> {
    const workflow = getProductWorkflow(request.workflowId);
    if (!workflow) throw new Error(`Unknown product workflow: ${request.workflowId}`);

    const now = Date.now();
    const baseJob: GenerationJob = {
        retryInputs: {
            prompt: request.prompt,
            negativePrompt: request.negativePrompt,
            references: request.references,
            maskAssetId: request.maskAssetId,
            parameters: request.parameters,
            seed: request.seed,
        },

        id: generateUUID(),
        projectId: request.projectId,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        targetId,
        targetKind,
        modelFamily: request.modelFamily,
        modelTier: request.modelTier ?? 'hosted-auto',
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        references: request.references,
        maskAssetId: request.maskAssetId,
        parameters: request.parameters,
        seed: request.seed,
        status: 'queued',
        progress: 0,
        outputs: [],
        createdAt: now,
        updatedAt: now,
    };

    await persistCreate(options?.persistence, baseJob);

    const validation = validateProductWorkflowRequest(request);
    if (!validation.valid) {
        const preflight: PreflightResult = {
            ready: false,
            status: 'incompatible',
            issues: validation.issues.filter((issue) => issue.severity === 'error').map((issue) => ({
                code: `invalid-${issue.field}`,
                message: issue.message,
            })),
            explanation: 'Correct the highlighted workflow inputs before queueing.',
        };
        const failedJob = { ...baseJob, status: 'failed' as const, error: makeError(preflight), updatedAt: Date.now(), preflight };
        await persistUpdate(options?.persistence, failedJob, terminalUpdates(failedJob));
        return failedJob;
    }

    let preflight: PreflightResult;
    try {
        preflight = await adapter.preflight(request);
    } catch (error) {
        preflight = {
            ready: false,
            status: 'incompatible',
            issues: [{ code: 'preflight-unavailable', message: error instanceof Error ? error.message : 'Unable to complete workflow preflight.' }],
            explanation: 'The target could not be checked. Retry when it is available.',
        };
    }

    const preparedJob = { ...baseJob, modelTier: request.modelTier ?? preflight.selectedTier ?? 'hosted-auto', preflight };
    if (!preflight.ready) {
        const failedJob = { ...preparedJob, status: 'failed' as const, error: makeError(preflight), updatedAt: Date.now() };
        await persistUpdate(options?.persistence, failedJob, terminalUpdates(failedJob));
        return failedJob;
    }

    try {
        const submitted = await adapter.submit(request);
        const queuedJob = { ...preparedJob, remoteJobId: submitted.jobId };
        await persistUpdate(options?.persistence, queuedJob, { remoteJobId: submitted.jobId });
        return queuedJob;
    } catch (error) {
        const failedJob = { ...preparedJob, status: 'failed' as const, error: makeSubmissionError(error), updatedAt: Date.now() };
        await persistUpdate(options?.persistence, failedJob, terminalUpdates(failedJob));
        return failedJob;
    }
}

export async function pollProductWorkflow(
    adapter: ExecutionTargetAdapter,
    job: SubmittedProductJob,
    options?: ProductJobOptions,
): Promise<SubmittedProductJob> {
    if (!job.remoteJobId || isTerminalJobStatus(job.status)) return job;
    const status = await adapter.getStatus(job.remoteJobId);
    const outputs = status.status === 'completed' || status.status === 'partial'
        ? await adapter.getOutputs(job.remoteJobId)
        : job.outputs;
    const next = applyStatus(job, status, outputs.map((output) => ({
        url: output.url,
        index: output.index,
        assetId: output.assetId,
        width: output.width,
        height: output.height,
        contentType: output.contentType,
    })));
    if (next.status !== job.status && isTerminalJobStatus(next.status)) {
        await persistUpdate(options?.persistence, next, terminalUpdates(next));
    }
    return next;
}

export async function cancelProductWorkflow(
    adapter: ExecutionTargetAdapter,
    job: SubmittedProductJob,
    options?: ProductJobOptions,
): Promise<SubmittedProductJob> {
    if (job.remoteJobId && !isTerminalJobStatus(job.status)) await adapter.cancel(job.remoteJobId);
    const cancelled = { ...job, status: 'cancelled' as const, progress: job.progress, updatedAt: Date.now() };
    await persistUpdate(options?.persistence, cancelled, { status: 'cancelled' });
    return cancelled;
}

export function isTerminalJobStatus(status: GenerationJobStatus): boolean {
    return status === 'completed' || status === 'partial' || status === 'failed' || status === 'cancelled';
}
