import { describe, expect, it } from 'vitest';
import type { ComfyPrompt, ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { getProductWorkflow } from './productWorkflowRegistry';
import { validateProductWorkflowRequest, buildProductPrompt } from './workflowValidation';

const baseRequest: ProductWorkflowRequest = {
    workflowId: 'product_edit',
    modelFamily: 'qwen-image-edit-2511',
    prompt: 'Replace the plastic housing with brushed aluminum.',
    references: [{ assetId: 'asset-1', role: 'primary' }],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

function nodesWithClass(prompt: ComfyPrompt, classType: string) {
    return Object.entries(prompt).filter(([, node]) => node.class_type === classType);
}

describe('validateProductWorkflowRequest', () => {
    it('requires a prompt for prompt-driven workflows', () => {
        const result = validateProductWorkflowRequest({ ...baseRequest, prompt: '' });
        expect(result.valid).toBe(false);
        expect(result.issues).toContainEqual(expect.objectContaining({ field: 'prompt' }));
    });

    it('requires a primary reference for product edits', () => {
        const result = validateProductWorkflowRequest({ ...baseRequest, references: [] });
        expect(result.valid).toBe(false);
        expect(result.issues).toContainEqual(expect.objectContaining({ field: 'references' }));
    });

    it('rejects invalid dimensions and batch sizes', () => {
        const result = validateProductWorkflowRequest({ ...baseRequest, width: 0, height: -1, batchSize: 0 });
        expect(result.valid).toBe(false);
        expect(result.issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['width', 'height', 'batchSize']));
    });
});

describe('buildProductPrompt', () => {
    it('injects concept requests into the official Qwen Image graph', () => {
        const request: ProductWorkflowRequest = {
            workflowId: 'product_concept',
            modelFamily: 'qwen-image-2.1',
            prompt: 'A modular speaker',
            references: [],
            width: 1328,
            height: 896,
            batchSize: 4,
            seed: 42,
            parameters: {},
        };
        const { prompt } = buildProductPrompt(request);
        const graph = getProductWorkflow('product_concept')!.templates['qwen-image-2.1']!;

        expect(prompt[graph.nodes.prompt!].inputs.text).toBe(request.prompt);
        expect(prompt[graph.nodes.seed!]).toMatchObject({ class_type: 'KSampler', inputs: { seed: 42 } });
        expect(prompt[graph.nodes.width!]).toMatchObject({ class_type: 'EmptySD3LatentImage', inputs: { width: 1328, height: 896, batch_size: 4 } });
        expect(nodesWithClass(prompt, 'UNETLoader')).toHaveLength(1);
        expect(nodesWithClass(prompt, 'SaveImage')).toHaveLength(1);
    });

    it('keeps the official negative prompt unless the request provides one', () => {
        const request: ProductWorkflowRequest = {
            workflowId: 'product_concept',
            modelFamily: 'qwen-image-2.1',
            prompt: 'A modular speaker',
            references: [],
            width: 1024,
            height: 1024,
            batchSize: 1,
            parameters: {},
        };
        const graph = getProductWorkflow('product_concept')!.templates['qwen-image-2.1']!;
        const officialNegative = String(graph.template[graph.nodes.negativePrompt!].inputs.text);
        expect(officialNegative.length).toBeGreaterThan(0);

        const kept = buildProductPrompt(request).prompt;
        expect(kept[graph.nodes.negativePrompt!].inputs.text).toBe(officialNegative);

        const overridden = buildProductPrompt({ ...request, negativePrompt: 'text, watermark' }).prompt;
        expect(overridden[graph.nodes.negativePrompt!].inputs.text).toBe('text, watermark');
    });

    it('injects Qwen edit references and keeps the official mask path when a mask is provided', () => {
        const request: ProductWorkflowRequest = { ...baseRequest, maskAssetId: 'mask.png' };
        const { prompt } = buildProductPrompt(request);
        const graph = getProductWorkflow('product_edit')!.templates['qwen-image-edit-2511']!;

        expect(prompt[graph.nodes.reference!]).toMatchObject({ class_type: 'LoadImage', inputs: { image: 'asset-1' } });
        expect(prompt[graph.nodes.mask!]).toMatchObject({ class_type: 'LoadImage', inputs: { image: 'mask.png' } });
        expect(nodesWithClass(prompt, 'SetLatentNoiseMask')).toHaveLength(1);
        expect(prompt[graph.nodes.seed!].inputs.latent_image).toEqual(['mask', 0]);
    });

    it('removes the mask path from Qwen edit graphs when no mask is provided', () => {
        const { prompt } = buildProductPrompt(baseRequest);
        expect(nodesWithClass(prompt, 'SetLatentNoiseMask')).toHaveLength(0);
        const sampler = nodesWithClass(prompt, 'KSampler')[0]?.[1];
        expect(sampler?.inputs.latent_image).toEqual(['encode', 0]);
    });

    it('injects FLUX Kontext edits through the official graph and ignores negative prompts', () => {
        const request: ProductWorkflowRequest = { ...baseRequest, modelFamily: 'flux-kontext-dev', negativePrompt: 'should be ignored' };
        const { prompt } = buildProductPrompt(request);
        const graph = getProductWorkflow('product_edit')!.templates['flux-kontext-dev']!;

        expect(nodesWithClass(prompt, 'DualCLIPLoader')).toHaveLength(1);
        expect(prompt[graph.nodes.prompt!].inputs.text).toBe(request.prompt);
        expect(prompt[graph.nodes.reference!]).toMatchObject({ class_type: 'LoadImage', inputs: { image: 'asset-1' } });
        const negative = prompt[graph.nodes.negativePrompt ?? '__none__'];
        expect(negative).toBeUndefined();
    });

    it('injects Wan 2.2 animation requests into the official two-stage graph', () => {
        const request: ProductWorkflowRequest = {
            workflowId: 'product_animation',
            modelFamily: 'wan-2.2',
            prompt: 'Slow turntable reveal',
            references: [{ assetId: 'hero-1', role: 'primary' }],
            width: 640,
            height: 640,
            batchSize: 1,
            seed: 7,
            parameters: { duration: '4s' },
        };
        const { prompt } = buildProductPrompt(request);
        const graph = getProductWorkflow('product_animation')!.templates['wan-2.2']!;

        expect(prompt[graph.nodes.prompt!].inputs.text).toBe(request.prompt);
        expect(prompt[graph.nodes.reference!]).toMatchObject({ class_type: 'LoadImage', inputs: { image: 'hero-1' } });
        const videoNode = prompt[graph.nodes.width!];
        expect(videoNode).toMatchObject({ class_type: 'WanImageToVideo', inputs: { width: 640, height: 640 } });
        expect(videoNode.inputs.start_image).toEqual(['reference', 0]);
        expect(prompt[graph.nodes.seed!]).toMatchObject({ class_type: 'KSamplerAdvanced', inputs: { noise_seed: 7 } });
        expect(nodesWithClass(prompt, 'KSamplerAdvanced')).toHaveLength(2);
        expect(nodesWithClass(prompt, 'SaveVideo')).toHaveLength(1);
    });

    it('selects the default family when the request does not name one', () => {
        const { prompt } = buildProductPrompt({ ...baseRequest, modelFamily: undefined });
        expect(nodesWithClass(prompt, 'TextEncodeQwenImageEditPlus')).toHaveLength(2);
    });

    it('rejects a model family the workflow does not support', () => {
        expect(() => buildProductPrompt({ ...baseRequest, modelFamily: 'wan-2.2' })).toThrow(/does not support/);
    });
});
