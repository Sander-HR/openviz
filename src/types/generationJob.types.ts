import type { ModelTier, ProductModelFamily, ProductReferenceInput, WorkflowValue } from './productWorkflow.types';
import type { ExecutionTargetKind, PreflightResult } from './executionTarget.types';

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface GenerationJobError {
    code: string;
    message: string;
    retryable: boolean;
}

export interface GenerationJobOutput {
    url: string;
    index: number;
    assetId?: string;
    width?: number;
    height?: number;
    contentType?: string;
}

export interface GenerationJob {
    id: string;
    projectId?: string;
    workflowId: string;
    workflowVersion: string;
    targetId: string;
    remoteJobId?: string;
    preflight?: PreflightResult;
    targetKind: ExecutionTargetKind;
    modelFamily?: ProductModelFamily;
    modelTier: ModelTier;
    prompt: string;
    negativePrompt?: string;
    references: ProductReferenceInput[];
    maskAssetId?: string;
    parameters: Record<string, WorkflowValue>;
    seed?: number;
    status: GenerationJobStatus;
    progress: number;
    outputs: GenerationJobOutput[];
    error?: GenerationJobError;
    retryInputs?: {
        prompt: string;
        negativePrompt?: string;
        references: ProductReferenceInput[];
        maskAssetId?: string;
        parameters: Record<string, WorkflowValue>;
        seed?: number;
    };
    retryOf?: string;
    createdAt: number;
    updatedAt: number;
}

export interface ModelTierDecision {
    tier: ModelTier;
    reason: string;
    warnings: string[];
}
