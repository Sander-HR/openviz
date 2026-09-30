import { describe, expect, it } from 'vitest';
import { normalizeComfyCapabilities } from './comfyCapabilitiesService';

const cudaStats = {
    system: { os: 'posix' },
    devices: [{
        name: 'RTX 4090',
        type: 'cuda',
        index: 0,
        vram_total: 24000000000,
        vram_free: 18000000000,
        torch_vram_total: 24000000000,
        torch_vram_free: 17000000000,
    }],
};

describe('normalizeComfyCapabilities', () => {
    it('normalizes device and VRAM data from system_stats', () => {
        const result = normalizeComfyCapabilities(cudaStats, {
            CheckpointLoaderSimple: {
                input: { required: { ckpt_name: [['qwen_image_2.1_fp8.safetensors']] } },
            },
        });

        expect(result.devices[0]).toMatchObject({
            name: 'RTX 4090',
            type: 'cuda',
            index: 0,
            vramTotalBytes: 24000000000,
            vramFreeBytes: 18000000000,
        });
        expect(result.availableModels).toContain('qwen_image_2.1_fp8.safetensors');
    });

    it('supports CPU and incomplete responses without throwing', () => {
        const result = normalizeComfyCapabilities({ devices: [] }, {});
        expect(result.devices).toEqual([]);
        expect(result.supportedPrecisions).toContain('unknown');
    });
});
