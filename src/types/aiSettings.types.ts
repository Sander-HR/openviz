import type { ComputeSettings, ExecutionTargetKind, ExecutionTargetProtocol } from './executionTarget.types';

export interface PersistedAISettings extends Omit<ComputeSettings, 'imageApiKey'> {
    hasImageApiKey: boolean;
    updatedAt: string;
}

export interface AISettingsUpdate extends Partial<Omit<ComputeSettings, 'imageApiKey'>> {
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