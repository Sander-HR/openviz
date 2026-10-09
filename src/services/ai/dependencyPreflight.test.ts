import { describe, expect, it } from 'vitest';
import type { TargetCapabilities } from '@/types/executionTarget.types';
import { runDependencyPreflight } from './dependencyPreflight';

const capabilities: TargetCapabilities = {
    checkedAt: Date.now(),
    devices: [],
    customNodes: ['CheckpointLoaderSimple', 'VAELoader'],
    availableModels: ['qwen_image_2.1_fp8.safetensors', 'qwen_image_vae.safetensors'],
    availableNodeTypes: ['CheckpointLoaderSimple', 'VAELoader'],
    supportedPrecisions: ['unknown'],
    supportedWorkflows: [],
};

describe('runDependencyPreflight', () => {
    it('reports missing required dependencies before queueing', () => {
        const result = runDependencyPreflight('product_concept', capabilities);
        expect(result.ready).toBe(false);
        expect(result.status).toBe('missing');
        expect(result.issues.some((issue) => issue.code === 'missing-dependency')).toBe(true);
    });

    it('reports a ready workflow when dependencies are present', () => {
        const result = runDependencyPreflight('product_concept', {
            ...capabilities,
            availableModels: [
                'qwen_image_2.1',
                'qwen_2.5_vl_7b',
                'qwen_image_vae',
            ],
        });
        expect(result.ready).toBe(true);
        expect(result.status).toBe('ready');
    });
});
