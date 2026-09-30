import { describe, expect, it } from 'vitest';
import { createProductConceptRequest } from './productConceptGeneration';

describe('createProductConceptRequest', () => {
    it('builds a typed concept request with batch and aspect-ratio parameters', () => {
        const request = createProductConceptRequest({
            projectId: 'project-1',
            prompt: 'A modular desk lamp',
            aspectRatio: '4:3',
            width: 1200,
            height: 900,
            batchSize: 4,
        });

        expect(request).toMatchObject({
            workflowId: 'product_concept',
            projectId: 'project-1',
            prompt: 'A modular desk lamp',
            aspectRatio: '4:3',
            batchSize: 4,
            parameters: { aspectRatio: '4:3', batchSize: 4 },
        });
    });

    it('rejects an empty concept prompt before submission', () => {
        expect(() => createProductConceptRequest({ prompt: ' ', aspectRatio: '1:1', width: 1024, height: 1024, batchSize: 1 }))
            .toThrow('prompt');
    });
});
