import type { AspectRatio } from '@/types';
import type { ExecutionTargetAdapter, ExecutionTargetKind } from '@/types/executionTarget.types';
import type { ProductModelFamily, ProductReferenceInput, ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { submitProductWorkflow, type ProductJobOptions, type SubmittedProductJob } from './generationJobService';
import { validateProductWorkflowRequest } from './workflowValidation';

export type ProductEditWorkflowId = 'product_edit' | 'material_study' | 'sketch_to_render' | 'product_background';

export interface ProductEditInput {
    projectId?: string;
    workflowId?: ProductEditWorkflowId;
    prompt: string;
    negativePrompt?: string;
    referenceAssetId: string;
    maskAssetId?: string;
    preservation: number;
    structureStrength?: number;
    aspectRatio: AspectRatio;
    width: number;
    height: number;
    batchSize?: number;
    modelFamily?: Extract<ProductModelFamily, 'qwen-image-edit-2511' | 'flux-kontext-dev'>;
    seed?: number;
}

type ProductDesignAspectRatio = Extract<AspectRatio, '1:1' | '4:3' | '3:4' | '16:9' | '9:16'>;

function supportedAspectRatio(ratio: AspectRatio): ProductDesignAspectRatio {
    return ratio === 'square' || ratio === 'landscape' || ratio === 'portrait' ? '1:1' : ratio;
}

export function createProductEditRequest(input: ProductEditInput): ProductWorkflowRequest {
    const workflowId = input.workflowId ?? 'product_edit';
    const references: ProductReferenceInput[] = [{ assetId: input.referenceAssetId, role: 'primary' }];
    const request: ProductWorkflowRequest = {
        workflowId,
        projectId: input.projectId,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        references,
        maskAssetId: input.maskAssetId,
        aspectRatio: supportedAspectRatio(input.aspectRatio),
        width: input.width,
        height: input.height,
        batchSize: input.batchSize ?? 1,
        modelFamily: input.modelFamily ?? 'qwen-image-edit-2511',
        seed: input.seed,
        parameters: {
            preservation: input.preservation,
            structureStrength: input.structureStrength ?? input.preservation,
            batchSize: input.batchSize ?? 1,
            aspectRatio: supportedAspectRatio(input.aspectRatio),
        },
    };
    const validation = validateProductWorkflowRequest(request);
    if (!validation.valid) {
        throw new Error(validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '));
    }
    return request;
}

export async function submitProductEdit(
    adapter: ExecutionTargetAdapter,
    input: ProductEditInput,
    targetKind: ExecutionTargetKind,
    targetId?: string,
    options?: ProductJobOptions,
): Promise<SubmittedProductJob> {
    return submitProductWorkflow(adapter, createProductEditRequest(input), targetKind, targetId, options);
}
