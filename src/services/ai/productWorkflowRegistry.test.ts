import { describe, expect, it } from 'vitest';
import type { ProductModelFamily, WorkflowDependency } from '@/types/productWorkflow.types';
import dependencyMetadata from './workflows/product-workflow-dependencies.json';
import { getProductWorkflow, listProductWorkflows } from './productWorkflowRegistry';

const OFFICIAL_NODE_CLASSES = new Set([
    'UNETLoader',
    'CLIPLoader',
    'DualCLIPLoader',
    'VAELoader',
    'CLIPTextEncode',
    'TextEncodeQwenImageEditPlus',
    'KSampler',
    'KSamplerAdvanced',
    'EmptySD3LatentImage',
    'LoadImage',
    'VAEDecode',
    'VAEEncode',
    'SaveImage',
    'SaveVideo',
    'CreateVideo',
    'ModelSamplingAuraFlow',
    'ModelSamplingSD3',
    'CFGNorm',
    'FluxGuidance',
    'ReferenceLatent',
    'FluxKontextImageScale',
    'FluxKontextMultiReferenceLatentMethod',
    'SetLatentNoiseMask',
    'WanImageToVideo',
    'ConditioningZeroOut',
]);

function assertTemplateIntegrity(workflowId: string, family: ProductModelFamily) {
    const workflow = getProductWorkflow(workflowId)!;
    const graph = workflow.templates[family];
    expect(graph, `${workflowId}/${family} should define an official graph`).toBeDefined();

    Object.entries(graph!.template).forEach(([nodeId, node]) => {
        expect(OFFICIAL_NODE_CLASSES.has(node.class_type), `${workflowId}/${family} node ${nodeId} uses non-official class ${node.class_type}`).toBe(true);
        Object.values(node.inputs).forEach((value) => {
            if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'number') {
                expect(graph!.template[value[0]], `${workflowId}/${family} node ${nodeId} links to missing node ${value[0]}`).toBeDefined();
            }
        });
    });

    Object.values(graph!.nodes).forEach((nodeId) => {
        if (nodeId) expect(graph!.template[nodeId], `${workflowId}/${family} role points at missing node ${nodeId}`).toBeDefined();
    });
}

describe('productWorkflowRegistry', () => {
    it('defines an official graph for every supported family of every workflow', () => {
        listProductWorkflows().forEach((workflow) => {
            workflow.supportedFamilies.forEach((family) => assertTemplateIntegrity(workflow.id, family));
        });
    });

    it('does not use synthetic OpenViz placeholder nodes anywhere', () => {
        listProductWorkflows().forEach((workflow) => {
            Object.entries(workflow.templates).forEach(([family, graph]) => {
                const classes = Object.values(graph.template).map((node) => node.class_type);
                expect(classes.filter((cls) => cls.startsWith('OpenViz')), `${workflow.id}/${family} still contains placeholder nodes`).toHaveLength(0);
            });
        });
    });

    it('uses the official Qwen Image 2.1 loaders for concept generation', () => {
        const graph = getProductWorkflow('product_concept')!.templates['qwen-image-2.1']!;
        const unet = Object.values(graph.template).find((node) => node.class_type === 'UNETLoader')!;
        const clip = Object.values(graph.template).find((node) => node.class_type === 'CLIPLoader')!;
        expect(String(unet.inputs.unet_name)).toContain('qwen_image_2.1');
        expect(clip.inputs.type).toBe('qwen_image');
    });

    it('uses the official Wan 2.2 two-stage sampler chain for animation', () => {
        const graph = getProductWorkflow('product_animation')!.templates['wan-2.2']!;
        const samplers = Object.values(graph.template).filter((node) => node.class_type === 'KSamplerAdvanced');
        expect(samplers).toHaveLength(2);
        const first = samplers[0].inputs;
        const second = samplers[1].inputs;
        expect(first.add_noise).toBe(true);
        expect(second.add_noise).toBe(false);
        expect(second.latent_image).toEqual([graph.nodes.seed!, 0]);
    });

    it('keeps registry dependencies in sync with the official dependency metadata', () => {
        const byName = (deps: WorkflowDependency[]) => deps.map((dep) => dep.name).sort();
        listProductWorkflows().forEach((workflow) => {
            const metadata = (dependencyMetadata as Record<string, { dependencies?: WorkflowDependency[] }>)[workflow.id];
            if (!metadata?.dependencies) return;
            expect(byName(workflow.dependencies), `registry deps for ${workflow.id}`).toEqual(byName(metadata.dependencies));
        });
    });
});
