import type { ExecutionTargetAdapter, ExecutionTargetKind } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { submitProductWorkflow, type ProductJobOptions, type SubmittedProductJob } from './generationJobService';
import { validateProductWorkflowRequest } from './workflowValidation';

export interface SketchToRenderInput {
    projectId?: string;
    prompt: string;
    referenceAssetId: string;
    structureStrength: number;
    width: number;
    height: number;
    seed?: number;
}

export function createSketchToRenderRequest(input: SketchToRenderInput): ProductWorkflowRequest {
    if (input.structureStrength < 0 || input.structureStrength > 1) throw new Error('Structure strength must be between 0 and 1.');
    const request: ProductWorkflowRequest = {
        workflowId: 'sketch_to_render', projectId: input.projectId, prompt: input.prompt,
        references: [{ assetId: input.referenceAssetId, role: 'primary' }], width: input.width, height: input.height,
        batchSize: 1, aspectRatio: '1:1', modelFamily: 'qwen-image-edit-2511', seed: input.seed,
        parameters: { structureStrength: input.structureStrength },
    };
    const result = validateProductWorkflowRequest(request);
    if (!result.valid) throw new Error(result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '));
    return request;
}

export function submitSketchToRender(adapter: ExecutionTargetAdapter, input: SketchToRenderInput, targetKind: ExecutionTargetKind, targetId?: string, options?: ProductJobOptions): Promise<SubmittedProductJob> {
    return submitProductWorkflow(adapter, createSketchToRenderRequest(input), targetKind, targetId, options);
}
