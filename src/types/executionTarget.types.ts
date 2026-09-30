import type { ModelTier, Precision, ProductWorkflowRequest } from './productWorkflow.types';

export type ExecutionTargetKind = 'local' | 'hosted' | 'hybrid';
export type ExecutionTargetProtocol = 'comfyui' | 'openai-image';
export type ComputePreference = 'automatic' | 'low-memory' | 'balanced' | 'high-quality' | 'hosted';
export type ExecutionTargetStatus = 'unknown' | 'checking' | 'ready' | 'degraded' | 'unavailable' | 'auth-required';
export type AuthState = 'unknown' | 'valid' | 'missing' | 'expired' | 'invalid';
export type HardwareBackend = 'cuda' | 'rocm' | 'mps' | 'cpu' | 'cloud' | 'unknown';

export interface ComfyDeviceCapability {
    name: string;
    type: HardwareBackend;
    index: number;
    vramTotalBytes: number | null;
    vramFreeBytes: number | null;
    torchVramTotalBytes: number | null;
    torchVramFreeBytes: number | null;
}

export interface TargetCapabilities {
    checkedAt: number;
    devices: ComfyDeviceCapability[];
    customNodes: string[];
    availableModels: string[];
    availableNodeTypes: string[];
    supportedPrecisions: Precision[];
    supportedWorkflows: string[];
}

export interface ComputeSettings {
    targetKind: ExecutionTargetKind;
    protocol: ExecutionTargetProtocol;
    preference: ComputePreference;
    localEndpoint: string;
    hostedEndpoint: string;
    imageApiEndpoint: string;
    imageApiKey: string;
    imageApiKeyless: boolean;
    imageApiModels: string[];
    imageApiModel: string;
    imageApiSize: string;
    endpointConcurrency: number;
}

export interface ExecutionTarget {
    id: string;
    kind: ExecutionTargetKind;
    endpoint: string;
    status: ExecutionTargetStatus;
    authState: AuthState;
    capabilities: TargetCapabilities | null;
    displayName: string;
}

export interface TargetHealth {
    targetId: string;
    status: ExecutionTargetStatus;
    message?: string;
    capabilities: TargetCapabilities | null;
}

export interface PreflightResult {
    ready: boolean;
    status: 'ready' | 'missing' | 'incompatible' | 'degraded';
    issues: Array<{
        code: string;
        message: string;
        dependency?: string;
        licenseUrl?: string;
    }>;
    selectedTier?: ModelTier;
    explanation?: string;
}

export interface SubmittedJob {
    jobId: string;
    targetId: string;
}

export interface NormalizedJobStatus {
    jobId: string;
    status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
    progress: number;
    message?: string;
}

export interface GenerationOutput {
    assetId?: string;
    url: string;
    index: number;
    width?: number;
    height?: number;
    contentType?: string;
}

export interface ExecutionTargetAdapter {
    health(): Promise<TargetHealth>;
    capabilities(): Promise<TargetCapabilities>;
    preflight(request: ProductWorkflowRequest): Promise<PreflightResult>;
    submit(request: ProductWorkflowRequest): Promise<SubmittedJob>;
    getStatus(jobId: string): Promise<NormalizedJobStatus>;
    cancel(jobId: string): Promise<void>;
    getOutputs(jobId: string): Promise<GenerationOutput[]>;
}
