import { RenderOperation, RenderService, GenerateRequest, GenerateResponse, AnimateRequest, NewViewRequest } from './types';
import { getWorkflow, mapStyleToId, WorkflowDefinition } from './ai/workflowRegistry';
import { composeNewViewPrompt, composeStylePrompt } from './ai/stylePromptRegistry';
import { client_id, fetchWithTimeout, getComfyUrl, uploadImage, waitForCompletion } from './comfyuiClient';
import { comfyConnectionManager } from './ai/comfyConnectionManager';

/**
 * Executes a ComfyUI workflow by:
 * 1. Deep cloning the template
 * 2. Injecting values (seed, images, prompts)
 * 3. Sending to API
 */
const executeWorkflow = async (
    workflow: WorkflowDefinition,
    injections: {
        prompt?: string,
        negative?: string,
        initImage?: string,
        endImage?: string,
        width?: number,
        height?: number,
        strength?: number,
        numImages?: number
    }
): Promise<string[]> => {

    // 1. Prepare Payload (structuredClone avoids the throwing JSON round-trip)
    const workflowPayload = structuredClone(workflow.template);
    const seed = Math.floor(Math.random() * 1_000_000_000_000);

    // 2. Inject Values
    const nodes = workflow.nodes;

    // Seed
    if (nodes.seed && workflowPayload[nodes.seed]) {
        workflowPayload[nodes.seed].inputs.seed = seed;
    }

    // Prompts
    if (nodes.prompt && workflowPayload[nodes.prompt] && injections.prompt) {
        const promptNode = workflowPayload[nodes.prompt];
        // Handle standard CLIPTextEncode
        if (promptNode.inputs.text !== undefined) {
            promptNode.inputs.text = injections.prompt;
        }
        // Handle StringConstantMultiline or similar
        else if (promptNode.inputs.string !== undefined) {
            promptNode.inputs.string = injections.prompt;
        }
        // Fallback for widgets_values if using Workflow format (though we converted to API format)
        else if (promptNode.widgets_values !== undefined) {
            promptNode.widgets_values[0] = injections.prompt;
        }
    }
    if (nodes.negative_prompt && workflowPayload[nodes.negative_prompt]) {
        // Use default negative if none provided
        const negText = injections.negative || workflow.defaults?.negative_prompt || "blurry, low quality, distortion, watermark";
        workflowPayload[nodes.negative_prompt].inputs.text = negText;
    }

    // Input Images
    if (nodes.image_input && workflowPayload[nodes.image_input] && injections.initImage) {
        workflowPayload[nodes.image_input].inputs.image = injections.initImage;
    }
    if (nodes.image_input_end && workflowPayload[nodes.image_input_end] && injections.endImage) {
        workflowPayload[nodes.image_input_end].inputs.image = injections.endImage;
    }

    // ControlNet Strength (if applicable)
    if (nodes.controlnet_strength && workflowPayload[nodes.controlnet_strength] && injections.strength !== undefined) {
        workflowPayload[nodes.controlnet_strength].inputs.strength = injections.strength;
    }

    // Dimensions / Batch Size (This usually depends on EmptyLatent or specific nodes)
    // Finding EmptyLatentImage or KSampler helps, but for now let's rely on specific node IDs if we had them or simple heuristics.
    // In our current templates, "33" is EmptySD3LatentImage, "12" is EmptyLatentImage.
    const emptyLatentNode = workflowPayload["33"] || workflowPayload["12"];
    if (emptyLatentNode) {
        if (injections.width) emptyLatentNode.inputs.width = injections.width;
        if (injections.height) emptyLatentNode.inputs.height = injections.height;
        if (injections.numImages) emptyLatentNode.inputs.batch_size = injections.numImages;
    }

    // 3. Queue Prompt
    console.log('🚀 Sending workflow to ComfyUI...', { workflowId: workflow.id, seed });
    const queueResponse = await fetchWithTimeout(`${getComfyUrl()}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: workflowPayload,
            client_id: client_id
        }),
        timeout: 10000
    });

    if (!queueResponse.ok) {
        const errorText = await queueResponse.text();
        throw new Error(`Queue failed (${queueResponse.status}): ${errorText || queueResponse.statusText}`);
    }

    const queueData = await queueResponse.json();
    const promptId = queueData.prompt_id;
    console.log('⏳ Queued with ID:', promptId);

    // 4. Wait
    const historyData = await waitForCompletion(promptId);

    // 5. Extract Outputs
    // Determine output node ID
    const outputNodeId = workflow.type === 'video' ? workflow.nodes.video_output : workflow.nodes.image_output;
    if (!outputNodeId || !historyData.outputs[outputNodeId]) {
        throw new Error(`Output node ${outputNodeId} not found in history`);
    }

    const outputs = historyData.outputs[outputNodeId];
    const files = outputs.images || outputs.videos || outputs.gifs || [];

    if (files.length === 0) {
        throw new Error('No output files returned');
    }

    return files.map((f) =>
        `${getComfyUrl()}/view?filename=${f.filename}&subfolder=${f.subfolder}&type=${f.type}`
    );
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error occurred';
}

export const comfyRenderService: RenderService = {
    generate: async (request: GenerateRequest): Promise<GenerateResponse> => {
        try {
            console.log('🎨 Starting Detailed Render Process...', request);

            // 1. Upload
            const uploadedFileName = await uploadImage(request.init_image, 'sketch');

            // 2. Resolve Workflow
            // If request.workflowId is provided use it, otherwise map stylePreset
            const workflowId = request.workflowId || mapStyleToId(request.stylePreset);
            const workflow = getWorkflow(workflowId);

            if (!workflow) {
                throw new Error(`Workflow not found for ID: ${workflowId} (Style: ${request.stylePreset})`);
            }

            // 3. Execute
            const imageUrls = await executeWorkflow(workflow, {
                prompt: composeStylePrompt(request.prompt, request.stylePreset),
                initImage: uploadedFileName,
                width: request.width,
                height: request.height,
                strength: request.drawingInfluence,
                numImages: request.numImages
            });

            console.log('✨ Generation Success:', imageUrls);

            return {
                success: true,
                images: imageUrls,
            };

        } catch (error) {
            console.error('❌ Generation Error:', error);
            return {
                success: false,
                images: [],
                error: errorMessage(error),
            };
        }
    },

    animate: async (request: AnimateRequest): Promise<GenerateResponse> => {
        try {
            console.log('🎬 Starting Animation Process...', request);

            // 1. Upload
            const uploadedFileName = await uploadImage(request.init_image, 'animate_source');
            let uploadedEndFileName = undefined;

            if (request.end_image) {
                uploadedEndFileName = await uploadImage(request.end_image, 'animate_end');
            }

            // 2. Resolve Workflow
            const workflowId = request.workflowId || 'video_standard'; // Default to standard video
            const workflow = getWorkflow(workflowId);

            if (!workflow) {
                throw new Error(`Workflow not found for ID: ${workflowId}`);
            }

            // 3. Execute
            const videoUrls = await executeWorkflow(workflow, {
                prompt: request.prompt || "animation",
                initImage: uploadedFileName,
                endImage: uploadedEndFileName,
                width: request.width,
                height: request.height,
                // Video specific params could be mapped here if workflow supported them (e.g. motion bucket id)
            });

            console.log('✨ Animation Success:', videoUrls);

            return {
                success: true,
                images: videoUrls
            };

        } catch (error) {
            console.error('❌ Animation Error:', error);
            return {
                success: false,
                images: [],
                error: errorMessage(error),
            };
        }
    },

    newView: async (request: NewViewRequest): Promise<GenerateResponse> => {
        try {
            const referenceImage = request.referenceImages[0];
            if (!referenceImage) {
                throw new Error('New view requires at least one reference image.');
            }

            console.log('🧊 Starting New View Process...', request);

            // 1. Upload the primary reference (ComfyUI workflows take a single init image).
            const uploadedFileName = await uploadImage(referenceImage, 'new_view_ref');

            // 2. Execute a product render workflow conditioned on the view prompt.
            const workflow = getWorkflow('product');
            if (!workflow) {
                throw new Error('Product workflow not found for new-view generation.');
            }

            const imageUrls = await executeWorkflow(workflow, {
                prompt: composeNewViewPrompt(request.view),
                initImage: uploadedFileName,
                width: request.width,
                height: request.height,
                numImages: 1,
            });

            console.log('✨ New View Success:', imageUrls);
            return { success: true, images: imageUrls };
        } catch (error) {
            console.error('❌ New View Error:', error);
            return { success: false, images: [], error: errorMessage(error) };
        }
    },

    capabilities(): RenderOperation[] {
        return ['generate', 'animate', 'new-view'];
    },

    checkConnection: async (): Promise<boolean> => {
        // Routed through the shared connection manager so this probe is
        // coalesced with (and gated by) every other ComfyUI status check.
        const state = await comfyConnectionManager.check(getComfyUrl());
        return state.status === 'ready';
    }
};
