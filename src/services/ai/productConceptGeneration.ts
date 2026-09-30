import type { ExecutionTargetAdapter, ExecutionTargetKind } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import type { AspectRatio } from '@/types';
import { submitProductWorkflow, type ProductJobOptions, type SubmittedProductJob } from './generationJobService';
import { validateProductWorkflowRequest } from './workflowValidation';

export interface ProductConceptInput {
    projectId?: string;
    prompt: string;
    negativePrompt?: string;
    aspectRatio: AspectRatio;
    width: number;
    height: number;
    batchSize: number;
    seed?: number;
}

export function createProductConceptRequest(input: ProductConceptInput): ProductWorkflowRequest {
    const request: ProductWorkflowRequest = {
        workflowId: 'product_concept',
        projectId: input.projectId,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        references: [],
        aspectRatio: input.aspectRatio,
        width: input.width,
        height: input.height,
        batchSize: input.batchSize,
        modelFamily: 'qwen-image-2.1',
        seed: input.seed,
        parameters: {
            aspectRatio: input.aspectRatio,
            batchSize: input.batchSize,
        },
    };
    const validation = validateProductWorkflowRequest(request);
    if (!validation.valid) {
        throw new Error(validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '));
    }
    return request;
}

export async function submitProductConcept(
    adapter: ExecutionTargetAdapter,
    input: ProductConceptInput,
    targetKind: ExecutionTargetKind,
    targetId?: string,
    options?: ProductJobOptions,
): Promise<SubmittedProductJob> {
    return submitProductWorkflow(adapter, createProductConceptRequest(input), targetKind, targetId, options);
}
