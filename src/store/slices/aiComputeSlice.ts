import type { StateCreator } from 'zustand';
import type { AppState } from '../storeTypes';
import type { ComputePreference, ComputeSettings, ExecutionTargetKind, ExecutionTargetProtocol } from '@/types/executionTarget.types';

export interface AIComputeSlice {
    computeSettings: ComputeSettings;
    setComputePreference: (preference: ComputePreference) => void;
    setLocalComfyEndpoint: (endpoint: string) => void;
    setHostedComfyEndpoint: (endpoint: string) => void;
    setExecutionTargetKind: (kind: ExecutionTargetKind) => void;
    setExecutionTargetProtocol: (protocol: ExecutionTargetProtocol) => void;
    setImageApiEndpoint: (endpoint: string) => void;
    setImageApiKey: (key: string) => void;
    setImageApiKeyless: (keyless: boolean) => void;
    setImageApiModels: (models: string[]) => void;
    setImageApiModel: (model: string) => void;
    setImageApiSize: (size: string) => void;
    setEndpointConcurrency: (concurrency: number) => void;
    setBenchmarkGateEnabled: (enabled: boolean) => void;
    applyComputeSettings: (settings: Partial<ComputeSettings>) => void;
}

export const createAIComputeSlice: StateCreator<AppState, [], [], AIComputeSlice> = (set) => ({
    computeSettings: {
        targetKind: 'local',
        protocol: 'comfyui',
        preference: 'automatic',
        localEndpoint: '/comfy-api',
        hostedEndpoint: '',
        imageApiEndpoint: '',
        imageApiKey: '',
        imageApiKeyless: false,
        imageApiModels: [],
        imageApiModel: '',
        imageApiSize: '1024x1024',
        endpointConcurrency: 2,
        benchmarkGateEnabled: false,
    },
    setComputePreference: (preference) => set((state) => ({ computeSettings: { ...state.computeSettings, preference } })),
    setLocalComfyEndpoint: (localEndpoint) => set((state) => ({ computeSettings: { ...state.computeSettings, localEndpoint } })),
    setHostedComfyEndpoint: (hostedEndpoint) => set((state) => ({ computeSettings: { ...state.computeSettings, hostedEndpoint } })),
    setExecutionTargetKind: (targetKind) => set((state) => ({ computeSettings: { ...state.computeSettings, targetKind } })),
    setExecutionTargetProtocol: (protocol) => set((state) => ({ computeSettings: { ...state.computeSettings, protocol } })),
    setImageApiEndpoint: (imageApiEndpoint) => set((state) => ({ computeSettings: { ...state.computeSettings, imageApiEndpoint } })),
    setImageApiKey: (imageApiKey) => set((state) => ({ computeSettings: { ...state.computeSettings, imageApiKey } })),
    setImageApiKeyless: (imageApiKeyless) => set((state) => ({ computeSettings: { ...state.computeSettings, imageApiKeyless } })),
    setImageApiModels: (imageApiModels) => set((state) => ({ computeSettings: { ...state.computeSettings, imageApiModels } })),
    setImageApiModel: (imageApiModel) => set((state) => ({ computeSettings: { ...state.computeSettings, imageApiModel } })),
    setImageApiSize: (imageApiSize) => set((state) => ({ computeSettings: { ...state.computeSettings, imageApiSize } })),
    setEndpointConcurrency: (endpointConcurrency) => set((state) => ({ computeSettings: { ...state.computeSettings, endpointConcurrency: Math.max(1, Math.min(3, Math.floor(endpointConcurrency))) } })),
    setBenchmarkGateEnabled: (benchmarkGateEnabled) => set((state) => ({ computeSettings: { ...state.computeSettings, benchmarkGateEnabled } })),
        applyComputeSettings: (settings) => set((state) => ({ computeSettings: { ...state.computeSettings, ...settings, endpointConcurrency: Math.max(1, Math.min(3, Math.floor(settings.endpointConcurrency ?? state.computeSettings.endpointConcurrency))) } })),
});
