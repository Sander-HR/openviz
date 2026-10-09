import type { ComputeSettings, ExecutionTargetKind, ExecutionTargetProtocol } from './executionTarget.types';

// `benchmarkGateEnabled` is client-side only (feature 012 FR-021) and never persisted.
export interface PersistedAISettings extends Omit<ComputeSettings, 'imageApiKey' | 'benchmarkGateEnabled'> {
    hasImageApiKey: boolean;
    updatedAt: string;
}

export interface AISettingsUpdate extends Partial<Omit<ComputeSettings, 'imageApiKey' | 'benchmarkGateEnabled'>> {
    imageApiKey?: string | null;
}

export interface AIEndpointProfile {
    id: string;
    name: string;
    kind: ExecutionTargetKind;
    protocol: ExecutionTargetProtocol;
    endpoint: string;
    model: string;
    imageSize: string;
    keyless: boolean;
    hasApiKey: boolean;
    createdAt: string;
    updatedAt: string;
}