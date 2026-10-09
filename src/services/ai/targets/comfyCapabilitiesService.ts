import type { ComfyDeviceCapability, TargetCapabilities, HardwareBackend } from '@/types/executionTarget.types';
import type { Precision } from '@/types/productWorkflow.types';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeBackend(value: unknown): HardwareBackend {
    const type = asString(value)?.toLowerCase();
    if (type === 'cuda' || type === 'rocm' || type === 'mps' || type === 'cpu' || type === 'cloud') return type;
    return 'unknown';
}

function normalizeDevice(value: unknown, fallbackIndex: number): ComfyDeviceCapability {
    const device = asRecord(value);
    return {
        name: asString(device.name) ?? `Device ${fallbackIndex}`,
        type: normalizeBackend(device.type),
        index: asNumber(device.index) ?? fallbackIndex,
        vramTotalBytes: asNumber(device.vram_total),
        vramFreeBytes: asNumber(device.vram_free),
        torchVramTotalBytes: asNumber(device.torch_vram_total),
        torchVramFreeBytes: asNumber(device.torch_vram_free),
    };
}

function collectStrings(value: unknown, output: Set<string>): void {
    if (typeof value === 'string') {
        output.add(value);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => collectStrings(item, output));
        return;
    }
    if (typeof value === 'object' && value !== null) {
        Object.values(value as JsonRecord).forEach((item) => collectStrings(item, output));
    }
}

function getPrecisions(devices: ComfyDeviceCapability[]): Precision[] {
    if (devices.length === 0) return ['unknown'];
    const hasCudaLike = devices.some((device) => device.type === 'cuda' || device.type === 'rocm');
    if (hasCudaLike) return ['bf16', 'fp16', 'fp8', 'int8', 'fp4'];
    if (devices.some((device) => device.type === 'mps')) return ['fp16', 'int8'];
    return ['int8'];
}

export function normalizeComfyCapabilities(
    systemStats: unknown,
    objectInfo: unknown,
    checkedAt = Date.now()
): TargetCapabilities {
    const stats = asRecord(systemStats);
    const rawDevices = Array.isArray(stats.devices) ? stats.devices : [];
    const devices = rawDevices.map((device, index) => normalizeDevice(device, index));
    const info = asRecord(objectInfo);
    const availableModels = new Set<string>();

    Object.values(info).forEach((nodeInfo) => {
        const node = asRecord(nodeInfo);
        collectStrings(node.input, availableModels);
    });

    return {
        checkedAt,
        devices,
        customNodes: Object.keys(info),
        availableModels: [...availableModels].sort(),
        availableNodeTypes: Object.keys(info).sort(),
        supportedPrecisions: getPrecisions(devices),
        supportedWorkflows: [],
    };
}
