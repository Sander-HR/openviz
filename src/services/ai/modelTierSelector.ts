import type { TargetCapabilities } from '@/types/executionTarget.types';
import type { ModelTier } from '@/types/productWorkflow.types';
import type { ModelTierDecision } from '@/types/generationJob.types';

export type ModelTierPreference = 'automatic' | 'low-memory' | 'balanced' | 'high-quality' | 'hosted';

export interface ModelTierSelectionInput {
    capabilities: TargetCapabilities;
    preference: ModelTierPreference;
    hostedAvailable?: boolean;
    minimumFreeVramMb?: number;
}

const BYTES_PER_MEGABYTE = 1024 * 1024;
const BYTES_PER_GIGABYTE = 1024 ** 3;

function freeVramMb(capabilities: TargetCapabilities): number {
    const freeBytes = capabilities.devices
        .map((device) => device.vramFreeBytes ?? device.torchVramFreeBytes ?? 0)
        .reduce((highest, current) => Math.max(highest, current), 0);
    return freeBytes / BYTES_PER_MEGABYTE;
}

function decision(tier: ModelTier, reason: string, warnings: string[] = []): ModelTierDecision {
    return { tier, reason, warnings };
}

export function selectModelTier(input: ModelTierSelectionInput): ModelTierDecision {
    const availableMb = freeVramMb(input.capabilities);
    const hasDevice = input.capabilities.devices.length > 0;
    const minimumMb = input.minimumFreeVramMb ?? 0;

    if (input.preference === 'hosted') {
        return decision('hosted-auto', 'Hosted execution was explicitly selected.');
    }

    if (!hasDevice && input.hostedAvailable) {
        return decision('hosted-auto', 'No local compute device was detected; hosted fallback is available.');
    }

    if (!hasDevice) {
        return decision('gguf', 'No device capability was detected; selecting the safest local tier.', [
            'Configure a hardware profile or hosted target for higher-quality tiers.',
        ]);
    }

    if (minimumMb > 0 && availableMb < minimumMb) {
        return decision(
            input.hostedAvailable ? 'hosted-auto' : 'gguf',
            input.hostedAvailable
                ? `The local target has ${Math.round(availableMb)} MB free VRAM, below the ${minimumMb} MB workflow requirement.`
                : `The local target has ${Math.round(availableMb)} MB free VRAM, below the ${minimumMb} MB workflow requirement.`,
            [input.hostedAvailable ? 'Hosted fallback selected.' : 'Use a quantized workflow or configure a hosted target.']
        );
    }

    if (input.preference === 'low-memory') {
        return decision('gguf', 'Low-memory preference selected.');
    }
    if (input.preference === 'balanced') {
        return decision('fp8', 'Balanced preference selected; FP8 provides quality with reduced memory use.');
    }
    if (input.preference === 'high-quality') {
        return availableMb >= 32000
            ? decision('bf16', 'High-quality preference selected and sufficient free VRAM is available.')
            : decision('fp8', 'High-quality preference requested, but available VRAM requires FP8.', ['BF16 was not selected.']);
    }

    if (availableMb < 10240) {
        return decision('gguf', `Automatic selection: ${Math.round(availableMb)} MB free VRAM is below 10 GB.`);
    }
    if (availableMb < 16384) {
        return decision('int8', `Automatic selection: ${Math.round(availableMb)} MB free VRAM supports a low-memory image tier.`);
    }
    if (availableMb < 32768) {
        return decision('fp8', `Automatic selection: ${Math.round(availableMb)} MB free VRAM supports FP8.`);
    }
    if (availableMb < 49152) {
        return decision('fp8', `Automatic selection: ${Math.round(availableMb)} MB free VRAM supports FP8 with headroom.`);
    }
    return decision('bf16', `Automatic selection: ${Math.round(availableMb)} MB free VRAM supports BF16.`);
}

export function formatVram(bytes: number | null): string {
    if (bytes === null || !Number.isFinite(bytes)) return 'Unknown';
    const gigabytes = bytes / BYTES_PER_GIGABYTE;
    return `${gigabytes.toFixed(gigabytes >= 10 ? 0 : 1)} GB`;
}
