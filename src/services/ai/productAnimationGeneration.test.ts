import { describe, expect, it } from 'vitest';
import { createProductAnimationRequest } from './productAnimationGeneration';

describe('createProductAnimationRequest', () => {
    it('retains hero lineage and motion parameters', () => {
        const request = createProductAnimationRequest({ prompt: 'Slow turntable', referenceAssetId: 'hero-1', duration: '4s', width: 832, height: 480, motionStrength: 0.35 });
        expect(request).toMatchObject({ workflowId: 'product_animation', references: [{ assetId: 'hero-1', role: 'primary' }], parameters: { duration: '4s', motionStrength: 0.35 } });
    });
});
