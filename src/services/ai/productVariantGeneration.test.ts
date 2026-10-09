import { describe, expect, it } from 'vitest';
import { createProductVariantRequest } from './productVariantGeneration';

describe('createProductVariantRequest', () => {
    it('groups requested values and preserves the source reference', () => {
        const request = createProductVariantRequest({ prompt: 'Explore finishes', referenceAssetId: 'hero-1', values: ['brushed aluminum', 'matte black'], width: 1024, height: 1024 });
        expect(request).toMatchObject({ workflowId: 'material_study', batchSize: 2, references: [{ assetId: 'hero-1', role: 'primary' }], parameters: { values: ['brushed aluminum', 'matte black'] } });
    });

    it('normalizes color values and stores the palette in typed parameters', () => {
        const request = createProductVariantRequest({ prompt: 'Explore colorways', referenceAssetId: 'hero-1', values: [' #AABBCC ', '#112233'], variableType: 'color', width: 1024, height: 1024 });
        expect(request).toMatchObject({ batchSize: 2, parameters: { variableType: 'color', values: ['#aabbcc', '#112233'], palette: ['#aabbcc', '#112233'] } });
    });

    it('rejects invalid color values instead of silently submitting them', () => {
        expect(() => createProductVariantRequest({ prompt: 'Explore colorways', referenceAssetId: 'hero-1', values: ['not-a-color'], variableType: 'color', width: 1024, height: 1024 })).toThrow('between 1 and 8 values');
    });
});
