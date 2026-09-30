import type {
    ExecutionTargetAdapter,
    GenerationOutput,
    NormalizedJobStatus,
    PreflightResult,
    SubmittedJob,
    TargetCapabilities,
    TargetHealth,
} from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

export function createHybridTarget(local: ExecutionTargetAdapter, hosted: ExecutionTargetAdapter): ExecutionTargetAdapter {
    let active: ExecutionTargetAdapter = local;

    async function chooseTarget(): Promise<ExecutionTargetAdapter> {
        const localHealth = await local.health();
        if (localHealth.status === 'ready' || localHealth.status === 'degraded') {
            active = local;
            return local;
        }
        const hostedHealth = await hosted.health();
        if (hostedHealth.status === 'ready' || hostedHealth.status === 'degraded') {
            active = hosted;
            return hosted;
        }
        throw new Error('Neither local nor hosted ComfyUI targets are available.');
    }

    return {
        async health(): Promise<TargetHealth> {
            try {
                const target = await chooseTarget();
                return target.health();
            } catch (error) {
                return {
                    targetId: 'hybrid',
                    status: 'unavailable',
                    message: error instanceof Error ? error.message : 'No execution target is available.',
                    capabilities: null,
                };
            }
        },
        async capabilities(): Promise<TargetCapabilities> {
            const target = await chooseTarget();
            return target.capabilities();
        },
        async preflight(request: ProductWorkflowRequest): Promise<PreflightResult> {
            const target = await chooseTarget();
            return target.preflight(request);
        },
        async submit(request: ProductWorkflowRequest): Promise<SubmittedJob> {
            const target = await chooseTarget();
            return target.submit(request);
        },
        async getStatus(jobId: string): Promise<NormalizedJobStatus> {
            return active.getStatus(jobId);
        },
        async cancel(jobId: string): Promise<void> {
            return active.cancel(jobId);
        },
        async getOutputs(jobId: string): Promise<GenerationOutput[]> {
            return active.getOutputs(jobId);
        },
    };
}
