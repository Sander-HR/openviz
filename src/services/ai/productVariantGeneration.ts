import type { AspectRatio } from '@/types';
import type { ExecutionTargetAdapter, ExecutionTargetKind } from '@/types/executionTarget.types';
import type { ProductVariantVariable, ProductWorkflowRequest } from '@/types';
import { normalizeHex } from '@/utils/colorUtils';
import { submitProductWorkflow, type ProductJobOptions, type SubmittedProductJob } from './generationJobService';
import { validateProductWorkflowRequest } from './workflowValidation';

export interface ProductVariantInput {
    projectId?: string;
    prompt: string;
    referenceAssetId: string;
    values: string[];
    variableType?: ProductVariantVariable;
    workflowId?: 'material_study' | 'product_background';
    aspectRatio?: Extract<AspectRatio, '1:1' | '4:3' | '3:4' | '16:9' | '9:16'>;
    width: number;
    height: number;
}

export function createProductVariantRequest(input: ProductVariantInput): ProductWorkflowRequest {
    const values = input.variableType === 'color'
        ? input.values.map((value) => normalizeHex(value)).filter((value): value is string => value !== null)
        : input.values.map((value) => value.trim()).filter(Boolean);
    if (values.length === 0 || values.length > 8) throw new Error('A variant set must contain between 1 and 8 values.');
    const aspectRatio = input.aspectRatio ?? '1:1';
    const request: ProductWorkflowRequest = {
        workflowId: input.workflowId ?? 'material_study', projectId: input.projectId, prompt: input.prompt,
        references: [{ assetId: input.referenceAssetId, role: 'primary' }], width: input.width, height: input.height,
        batchSize: values.length, aspectRatio, modelFamily: 'qwen-image-edit-2511', parameters: {
            values, variableType: input.variableType ?? 'material', batchSize: values.length, aspectRatio,
            ...(input.variableType === 'color' ? { palette: values } : {}),
        },
    };
    const result = validateProductWorkflowRequest(request);
    if (!result.valid) throw new Error(result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '));
    return request;
}

export function submitProductVariants(adapter: ExecutionTargetAdapter, input: ProductVariantInput, targetKind: ExecutionTargetKind, targetId?: string, options?: ProductJobOptions): Promise<SubmittedProductJob> {
    return submitProductWorkflow(adapter, createProductVariantRequest(input), targetKind, targetId, options);
}
