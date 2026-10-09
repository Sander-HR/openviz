import { describe, expect, it } from 'vitest';
import { createProductEditRequest } from './productEditGeneration';

describe('createProductEditRequest', () => {
    it('retains source, mask, preservation, and retry parameters', () => {
        const request = createProductEditRequest({
            projectId: 'project-1', prompt: 'Change the housing to brushed aluminum', referenceAssetId: 'asset-1', maskAssetId: 'mask-1',
            preservation: 0.82, aspectRatio: '1:1', batchSize: 2, width: 1024, height: 1024,
        });
        expect(request).toMatchObject({
            workflowId: 'product_edit',
            modelFamily: 'qwen-image-edit-2511',
            references: [{ assetId: 'asset-1', role: 'primary' }],
            maskAssetId: 'mask-1',
            parameters: { preservation: 0.82, batchSize: 2 },
        });
    });
});
