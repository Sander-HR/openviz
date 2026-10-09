import { describe, expect, it } from 'vitest';
import { createSketchToRenderRequest } from './sketchToRender';

describe('createSketchToRenderRequest', () => {
    it('preserves source and structure-strength parameters', () => {
        const request = createSketchToRenderRequest({ prompt: 'Studio product render', referenceAssetId: 'sketch-1', structureStrength: 0.88, width: 1024, height: 1024 });
        expect(request).toMatchObject({ workflowId: 'sketch_to_render', references: [{ assetId: 'sketch-1', role: 'primary' }], parameters: { structureStrength: 0.88 } });
    });

    it('rejects structure strengths outside the normalized range', () => {
        expect(() => createSketchToRenderRequest({ prompt: 'Render', referenceAssetId: 'sketch-1', structureStrength: 2, width: 1024, height: 1024 })).toThrow(/structure/i);
    });
});
