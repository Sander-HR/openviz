import { describe, expect, it } from 'vitest';
import type { TargetCapabilities } from '@/types/executionTarget.types';
import { selectModelTier } from './modelTierSelector';

function capabilities(freeVramBytes: number): TargetCapabilities {
    return {
        checkedAt: Date.now(),
        devices: [{
            name: 'Test GPU',
            type: 'cuda',
            index: 0,
            vramTotalBytes: freeVramBytes,
            vramFreeBytes: freeVramBytes,
            torchVramTotalBytes: freeVramBytes,
            torchVramFreeBytes: freeVramBytes,
        }],
        customNodes: [],
        availableModels: [],
        availableNodeTypes: [],
        supportedPrecisions: ['bf16', 'fp8', 'int8'],
        supportedWorkflows: [],
    };
}

describe('selectModelTier', () => {
    it('selects GGUF for low-memory automatic execution', () => {
        const decision = selectModelTier({ capabilities: capabilities(8 * 1024 ** 3), preference: 'automatic' });
        expect(decision.tier).toBe('gguf');
    });

    it('selects FP8 for a balanced 24 GB target', () => {
        const decision = selectModelTier({ capabilities: capabilities(20 * 1024 ** 3), preference: 'automatic' });
        expect(decision.tier).toBe('fp8');
    });

    it('selects BF16 for a high-memory target', () => {
        const decision = selectModelTier({ capabilities: capabilities(50 * 1024 ** 3), preference: 'automatic' });
        expect(decision.tier).toBe('bf16');
    });

    it('uses hosted-auto when no local device is available and hosted is enabled', () => {
        const decision = selectModelTier({ capabilities: { ...capabilities(0), devices: [] }, preference: 'automatic', hostedAvailable: true });
        expect(decision.tier).toBe('hosted-auto');
    });
});
