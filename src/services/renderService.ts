import { RenderService, GenerateRequest, GenerateResponse, AnimateRequest } from './types';
import { mockRenderService } from './mockRenderService';
import { getWorkflow, mapStyleToId, WorkflowDefinition } from './ai/workflowRegistry';

// Using Vite proxy to avoid CORS issues
let comfyUrl = '/comfy-api';
// We use the same protocol and host as the current page, but Vite will proxy /comfy-api to the backend
let wsUrl = `${window.location.protocol === 'http:' ? 'ws:' : 'wss:'}//${window.location.host}/comfy-api`;

// Generate a persistent client ID for this session
const client_id = crypto.randomUUID();

// Helper types for ComfyUI API responses
interface ComfyUploadResponse {
    name: string;
    subfolder: string;
    type: string;
}

interface ComfyHistoryResponse {
    [prompt_id: string]: {
        status: { status_str: 'success' | 'failed' };
        outputs: {
            [node_id: string]: {
                images: Array<{ filename: string; subfolder: string; type: string }>;
                videos?: Array<{ filename: string; subfolder: string; type: string }>;
                gifs?: Array<{ filename: string; subfolder: string; type: string }>;
            };
        };
    };
}

/**
 * Helper to perform a fetch with a specific timeout.
 */
async function fetchWithTimeout(resource: string | Request, options: RequestInit & { timeout?: number } = {}) {
    const { timeout = 120000 } = options; // Increased default timeout

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);
    return response;
}

/**
 * Uploads a base64 image to the ComfyUI server using production-ready form data.
 */
const uploadImage = async (base64String: string, prefix = 'sketch'): Promise<string> => {
    try {
        const fetchResponse = await fetch(base64String);
        const blob = await fetchResponse.blob();

        const formData = new FormData();
        const filename = `${prefix}_${Date.now()}.png`;

        // multipart/form-data fields expected by ComfyUI
        formData.append('image', blob, filename);
        formData.append('type', 'input');
        formData.append('overwrite', 'true');

        const response = await fetchWithTimeout(`${comfyUrl}/upload/image`, {
            method: 'POST',
            body: formData,
            timeout: 10000 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed (${response.status}): ${errorText || response.statusText}`);
        }

        const data: ComfyUploadResponse = await response.json();
        return data.name;
    } catch (error) {
        console.error('❌ Upload Error:', error);
        throw error;
    }
};

/**
 * Waits for generation completion via WebSocket or polls history as a fallback.
 */
const waitForCompletion = async (promptId: string): Promise<ComfyHistoryResponse[string]> => {
    return new Promise((resolve, reject) => {
        // Use the proxied WS URL
        const socket = new WebSocket(`${wsUrl}/ws?clientId=${client_id}`);

        const timeout = setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
            reject(new Error('Timeout waiting for render generation.'));
        }, 180000); // 3 minute timeout for complex renders/videos

        socket.onopen = () => {
            console.log('🔌 Connected to ComfyUI WebSocket');
        };

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'progress') {
                    console.log(`⏳ Progress: ${message.data.value}/${message.data.max}`);
                }

                // Some versions of ComfyUI send "executing" with null when done
                if (message.type === 'executing' && message.data.node === null && message.data.prompt_id === promptId) {
                    console.log('✅ Generation finished (executing: null)');
                    socket.close();
                    clearTimeout(timeout);
                    fetchHistory(promptId).then(resolve).catch(reject);
                }

                // The standard way is "executed"
                if (message.type === 'executed' && message.data.prompt_id === promptId) {
                    console.log('✅ Generation completed (executed message)');
                    socket.close();
                    clearTimeout(timeout);
                    fetchHistory(promptId).then(resolve).catch(reject);
                }
            } catch (e) {
                console.warn('Error parsing WS message:', e);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            socket.close();
            clearTimeout(timeout);
            // Fallback to polling if WS fails
            console.log('🔄 Falling back to history polling...');
            pollHistory(promptId).then(resolve).catch(reject);
        };

        socket.onclose = (event) => {
            if (!event.wasClean && socket.readyState !== WebSocket.CLOSED) {
                console.warn('WebSocket closed unexpectedly');
                // Could fallback to polling here too
            }
        };
    });
};

const fetchHistory = async (promptId: string): Promise<ComfyHistoryResponse[string]> => {
    const response = await fetchWithTimeout(`${comfyUrl}/history/${promptId}`, { timeout: 5000 });
    if (!response.ok) throw new Error('Failed to fetch history');
    const history: ComfyHistoryResponse = await response.json();
    return history[promptId];
};

const pollHistory = async (promptId: string): Promise<ComfyHistoryResponse[string]> => {
    let attempts = 0;
    while (attempts < 60) {
        try {
            const history = await fetchHistory(promptId);
            if (history) return history;
        } catch (e) {
            // Silently retry
        }
        attempts++;
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Timeout polling for history.');
};

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
        width?: number,
        height?: number,
        strength?: number,
        numImages?: number
    }
): Promise<string[]> => {
    
    // 1. Prepare Payload
    const workflowPayload = JSON.parse(JSON.stringify(workflow.template));
    const seed = Math.floor(Math.random() * 1_000_000_000_000);

    // 2. Inject Values
    const nodes = workflow.nodes;

    // Seed
    if (nodes.seed && workflowPayload[nodes.seed]) {
        workflowPayload[nodes.seed].inputs.seed = seed;
    }

    // Prompts
    if (nodes.prompt && workflowPayload[nodes.prompt] && injections.prompt) {
        workflowPayload[nodes.prompt].inputs.text = injections.prompt;
    }
    if (nodes.negative_prompt && workflowPayload[nodes.negative_prompt]) {
        // Use default negative if none provided
        const negText = injections.negative || workflow.defaults?.negative_prompt || "blurry, low quality, distortion, watermark";
        workflowPayload[nodes.negative_prompt].inputs.text = negText;
    }

    // Input Image
    if (nodes.image_input && workflowPayload[nodes.image_input] && injections.initImage) {
        workflowPayload[nodes.image_input].inputs.image = injections.initImage;
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
    const queueResponse = await fetchWithTimeout(`${comfyUrl}/prompt`, {
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
        `${comfyUrl}/view?filename=${f.filename}&subfolder=${f.subfolder}&type=${f.type}`
    );
};


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
                prompt: request.prompt,
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

        } catch (error: any) {
            console.error('❌ Generation Error:', error);
            return {
                success: false,
                images: [],
                error: error.message || 'Unknown error occurred',
            };
        }
    },

    animate: async (request: AnimateRequest): Promise<GenerateResponse> => {
        try {
            console.log('🎬 Starting Animation Process...', request);

            // 1. Upload
            const uploadedFileName = await uploadImage(request.init_image, 'animate_source');

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
                width: request.width,
                height: request.height,
                // Video specific params could be mapped here if workflow supported them (e.g. motion bucket id)
            });

             console.log('✨ Animation Success:', videoUrls);

            return {
                success: true,
                images: videoUrls 
            };

        } catch (error: any) {
            console.error('❌ Animation Error:', error);
            return {
                success: false,
                images: [],
                error: error.message || 'Unknown error occurred',
            };
        }
    },

    checkConnection: async (): Promise<boolean> => {
        console.log(`🔍 Checking ComfyUI connection via proxy (${comfyUrl})...`);
        try {
            const response = await fetchWithTimeout(`${comfyUrl}/system_stats`, { timeout: 2000 });
            if (response.ok) {
                const stats = await response.json();
                console.log('✅ ComfyUI System Stats:', stats);
                return true;
            }
        } catch (e) {
            console.warn(`⚠️ Connection to ${comfyUrl} failed, trying secondary proxy...`);
        }

        // Try secondary proxy
        const secondaryUrl = '/comfy-api-secondary';
        try {
            const response = await fetchWithTimeout(`${secondaryUrl}/system_stats`, { timeout: 2000 });
            if (response.ok) {
                const stats = await response.json();
                console.log('✅ ComfyUI System Stats (Secondary):', stats);
                
                // Update global URLs to use secondary proxy
                comfyUrl = secondaryUrl;
                wsUrl = `${window.location.protocol === 'http:' ? 'ws:' : 'wss:'}//${window.location.host}${secondaryUrl}`;
                console.log('🔄 Switched to secondary proxy:', comfyUrl);
                
                return true;
            }
        } catch (e) {
             console.error('❌ Secondary connection check failed:', e);
        }

        return false;
    }
};

// Toggle between real and mock service using environment variable
const useMock = import.meta.env.VITE_USE_MOCK_RENDER === 'true';

export const renderService: RenderService = useMock ? mockRenderService : comfyRenderService;
