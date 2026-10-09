import type { AspectRatio } from '@/types';

export type ProductWorkflowCategory =
    | 'concept'
    | 'edit'
    | 'variant'
    | 'render'
    | 'background'
    | 'animation';

export type ProductModelFamily =
    | 'qwen-image-2.1'
    | 'qwen-image-edit-2511'
    | 'flux-kontext-dev'
    | 'wan-2.2';

export type ModelTier = 'bf16' | 'fp8' | 'int8' | 'gguf' | 'hosted-auto';
export type Precision = 'bf16' | 'fp16' | 'fp8' | 'int8' | 'fp4' | 'unknown';
export type WorkflowValue = string | number | boolean | null | WorkflowValue[] | { [key: string]: WorkflowValue };
export type ComfyPrompt = Record<string, ComfyPromptNode>;

export interface ComfyPromptNode {
    class_type: string;
    inputs: Record<string, WorkflowValue | string[]>;
}

export type WorkflowInputKind =
    | 'prompt'
    | 'negative-prompt'
    | 'reference'
    | 'mask'
    | 'aspect-ratio'
    | 'structure-strength'
    | 'preservation'
    | 'batch-size'
    | 'duration'
    | 'motion';

export interface WorkflowInputDefinition {
    id: string;
    kind: WorkflowInputKind;
    label: string;
    required: boolean;
    defaultValue?: WorkflowValue;
}

export type WorkflowDependencyKind =
    | 'checkpoint'
    | 'diffusion-model'
    | 'text-encoder'
    | 'vae'
    | 'lora'
    | 'controlnet'
    | 'custom-node';

export type DependencyStatus = 'present' | 'missing' | 'incompatible' | 'unknown';

export interface WorkflowDependency {
    kind: WorkflowDependencyKind;
    name: string;
    version?: string;
    locations: string[];
    required: boolean;
    licenseUrl?: string;
    status?: DependencyStatus;
}

export interface WorkflowCapabilities {
    supportsBatch: boolean;
    supportsMask: boolean;
    supportsVideo: boolean;
    supportsAspectRatios: AspectRatio[];
    minimumFreeVramMb?: number;
}

export interface ProductWorkflowNodeRoles {
    prompt?: string;
    negativePrompt?: string;
    seed?: string;
    reference?: string;
    mask?: string;
    width?: string;
    height?: string;
    batchSize?: string;
    imageOutput?: string;
    videoOutput?: string;
}

export interface ProductWorkflowGraph {
    /** Official ComfyUI API-format prompt graph for one model family. */
    template: ComfyPrompt;
    /** Role-to-node-id map for typed request injection. */
    nodes: ProductWorkflowNodeRoles;
    /** Optional mask path removed from the graph when the request has no mask asset. */
    maskOptional?: {
        removeNodes: string[];
        rewireInput: { nodeId: string; input: string; value: [string, number] };
    };
}

export interface ProductWorkflowDefinition {
    id: string;
    name: string;
    description: string;
    category: ProductWorkflowCategory;
    version: string;
    type: 'image' | 'video';
    supportedFamilies: ProductModelFamily[];
    inputs: WorkflowInputDefinition[];
    dependencies: WorkflowDependency[];
    /** One official graph per model family the workflow supports. */
    templates: Partial<Record<ProductModelFamily, ProductWorkflowGraph>>;
    capabilities: WorkflowCapabilities;
}

export interface ProductReferenceInput {
    assetId: string;
    role: 'primary' | 'material' | 'color' | 'style' | 'environment' | 'annotation' | 'mask';
    token?: string;
}

export type ProductReferenceRole = 'sketch' | 'cad' | 'render' | 'selected-concept' | 'hero' | 'mask';

export interface ProductReference {
    id: string;
    assetId: string;
    projectId?: string;
    sourceJobId?: string;
    width?: number;
    height?: number;
    contentType?: string;
    role: ProductReferenceRole;
    createdAt: number;
}

export type ProductVariantVariable = 'material' | 'color' | 'trim' | 'background' | 'camera';
export type ProductVariantSetStatus = 'pending' | 'partial' | 'complete' | 'failed';

export interface ProductVariantSet {
    id: string;
    referenceId: string;
    variableType: ProductVariantVariable;
    requestedValues: string[];
    jobIds: string[];
    status: ProductVariantSetStatus;
    createdAt: number;
    updatedAt: number;
}

export interface ProductWorkflowRequest {
    workflowId: string;
    projectId?: string;
    prompt: string;
    negativePrompt?: string;
    references: ProductReferenceInput[];
    maskAssetId?: string;
    aspectRatio?: AspectRatio;
    width: number;
    height: number;
    batchSize: number;
    modelFamily?: ProductModelFamily;
    modelTier?: ModelTier;
    seed?: number;
    /** Per-output seeds for batched generation (one per output); single seed when absent. */
    seeds?: number[];
    /** Edit-workflow denoise strength (0–1); lower stays closer to the source image. */
    strength?: number;
    parameters: Record<string, WorkflowValue>;
    /** Resolved data URL used by native Unsloth image-conditioned generation. */
    initImage?: string;
    /** Resolved data URL mask; white pixels are repainted by the backend. */
    maskImage?: string;
    /** Resolved source/reference images in graph connection order. */
    referenceImages?: string[];
    /** Explicit native diffusion workflow for image-conditioned generation. */
    imageWorkflow?: 'edit' | 'reference';
    /** Resolution used to encode native reference images. */
    referenceResolution?: 512 | 1024 | 2048;
    /** Video only: resolved data URL the clip ends on (optional end frame, FR-017). */
    endImage?: string;
    /** Video only: frame count resolved from the duration choice (R1). */
    numFrames?: number;
    /** Video only: playback frame rate (R1). */
    fps?: number;
}

export interface WorkflowValidationIssue {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface WorkflowValidationResult {
    valid: boolean;
    issues: WorkflowValidationIssue[];
}
