import type { ExecutionTargetAdapter, ExecutionTargetKind } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { submitProductWorkflow, type ProductJobOptions, type SubmittedProductJob } from './generationJobService';
import { validateProductWorkflowRequest } from './workflowValidation';

export interface ProductAnimationInput {
    projectId?: string;
    prompt?: string;
    referenceAssetId: string;
    startAssetId?: string;
    endAssetId?: string;
    duration: '2s' | '4s' | '6s';
    motionStrength: number;
    width: number;
    height: number;
    seed?: number;
}

export function createProductAnimationRequest(input: ProductAnimationInput): ProductWorkflowRequest {
    if (input.motionStrength < 0 || input.motionStrength > 1) throw new Error('Motion strength must be between 0 and 1.');
    const request: ProductWorkflowRequest = {
        workflowId: 'product_animation', projectId: input.projectId, prompt: input.prompt ?? '',
        references: [{ assetId: input.referenceAssetId, role: 'primary' }], width: input.width, height: input.height,
        batchSize: 1, aspectRatio: '16:9', modelFamily: 'wan-2.2', seed: input.seed,
        parameters: { duration: input.duration, motionStrength: input.motionStrength, startAssetId: input.startAssetId ?? input.referenceAssetId, endAssetId: input.endAssetId ?? null },
    };
    const result = validateProductWorkflowRequest(request);
    if (!result.valid) throw new Error(result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '));
    return request;
}

export function submitProductAnimation(adapter: ExecutionTargetAdapter, input: ProductAnimationInput, targetKind: ExecutionTargetKind, targetId?: string, options?: ProductJobOptions): Promise<SubmittedProductJob> {
    return submitProductWorkflow(adapter, createProductAnimationRequest(input), targetKind, targetId, options);
}
