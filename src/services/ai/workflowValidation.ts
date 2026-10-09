import type {
    ComfyPrompt,
    ProductWorkflowRequest,
    WorkflowValidationIssue,
    WorkflowValidationResult,
} from '@/types/productWorkflow.types';
import { getProductWorkflow } from './productWorkflowRegistry';

const MAX_BATCH_SIZE = 8;

function clonePrompt(template: ComfyPrompt): ComfyPrompt {
    return Object.fromEntries(
        Object.entries(template).map(([nodeId, node]) => [nodeId, {
            class_type: node.class_type,
            inputs: { ...node.inputs },
        }])
    );
}

function setNodeInput(prompt: ComfyPrompt, nodeId: string | undefined, keys: string[], value: string | number): void {
    if (!nodeId || !prompt[nodeId]) return;
    const inputs = prompt[nodeId].inputs;
    const existingKey = keys.find((key) => key in inputs) ?? keys[0];
    inputs[existingKey] = value;
}

export function validateProductWorkflowRequest(
    request: ProductWorkflowRequest
): WorkflowValidationResult {
    const issues: WorkflowValidationIssue[] = [];
    const workflow = getProductWorkflow(request.workflowId);

    if (!workflow) {
        issues.push({ field: 'workflowId', message: 'Unknown product workflow.', severity: 'error' });
        return { valid: false, issues };
    }

    if (!request.prompt.trim() && workflow.inputs.some((input) => input.kind === 'prompt' && input.required)) {
        issues.push({ field: 'prompt', message: 'A prompt is required for this workflow.', severity: 'error' });
    }

    if (workflow.inputs.some((input) => input.kind === 'reference' && input.required)) {
        const hasPrimaryReference = request.references.some((reference) => reference.role === 'primary');
        if (!hasPrimaryReference) {
            issues.push({ field: 'references', message: 'A primary reference image is required.', severity: 'error' });
        }
    }

    if (!Number.isInteger(request.width) || request.width <= 0) {
        issues.push({ field: 'width', message: 'Width must be a positive integer.', severity: 'error' });
    }

    if (!Number.isInteger(request.height) || request.height <= 0) {
        issues.push({ field: 'height', message: 'Height must be a positive integer.', severity: 'error' });
    }

    if (!Number.isInteger(request.batchSize) || request.batchSize < 1 || request.batchSize > MAX_BATCH_SIZE) {
        issues.push({ field: 'batchSize', message: `Batch size must be between 1 and ${MAX_BATCH_SIZE}.`, severity: 'error' });
    }

    if (request.maskAssetId && !workflow.capabilities.supportsMask) {
        issues.push({ field: 'maskAssetId', message: 'This workflow does not support masks.', severity: 'error' });
    }

    if (request.aspectRatio && !workflow.capabilities.supportsAspectRatios.includes(request.aspectRatio)) {
        issues.push({ field: 'aspectRatio', message: 'This aspect ratio is not supported by the selected workflow.', severity: 'error' });
    }

    return { valid: issues.every((issue) => issue.severity !== 'error'), issues };
}

export function buildProductPrompt(request: ProductWorkflowRequest): { prompt: ComfyPrompt; workflowVersion: string } {
    const workflow = getProductWorkflow(request.workflowId);
    if (!workflow) throw new Error(`Unknown product workflow: ${request.workflowId}`);

    const family = request.modelFamily ?? workflow.supportedFamilies[0];
    const graph = workflow.templates[family];
    if (!graph) {
        throw new Error(`Workflow ${workflow.id} does not support model family ${family}.`);
    }

    const validation = validateProductWorkflowRequest(request);
    if (!validation.valid) {
        throw new Error(validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join(' '));
    }

    const prompt = clonePrompt(graph.template);
    const nodes = graph.nodes;
    const primaryReference = request.references.find((reference) => reference.role === 'primary')?.assetId;

    setNodeInput(prompt, nodes.prompt, ['text', 'string'], request.prompt);
    // Only override the official negative prompt when the user provides one.
    if (request.negativePrompt) {
        setNodeInput(prompt, nodes.negativePrompt, ['text', 'string'], request.negativePrompt);
    }
    if (request.seed !== undefined) setNodeInput(prompt, nodes.seed, ['seed', 'noise_seed'], request.seed);
    if (primaryReference) setNodeInput(prompt, nodes.reference, ['image', 'image_name', 'filename'], primaryReference);
    if (request.maskAssetId && nodes.mask) {
        setNodeInput(prompt, nodes.mask, ['image', 'mask', 'mask_name', 'filename'], request.maskAssetId);
    } else if (graph.maskOptional) {
        // Keep the submitted graph valid when no mask asset is provided.
        graph.maskOptional.removeNodes.forEach((nodeId) => delete prompt[nodeId]);
        const rewire = graph.maskOptional.rewireInput;
        const target = prompt[rewire.nodeId];
        if (target) {
            target.inputs[rewire.input] = rewire.value;
        }
    }
    setNodeInput(prompt, nodes.width, ['width', 'value'], request.width);
    setNodeInput(prompt, nodes.height, ['height', 'value'], request.height);
    setNodeInput(prompt, nodes.batchSize, ['batch_size', 'value'], request.batchSize);

    const outputNode = nodes.imageOutput ?? nodes.videoOutput;
    if (outputNode) {
        setNodeInput(prompt, outputNode, ['filename_prefix'], workflow.id);
    }

    return { prompt, workflowVersion: workflow.version };
}
