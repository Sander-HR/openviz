import { RenderService, GenerateRequest, GenerateResponse } from './types';
import { mockRenderService } from './mockRenderService';

// Using Vite proxy to avoid CORS issues
const COMFY_URL = '/comfy-api';
// We use the same protocol and host as the current page, but Vite will proxy /comfy-api to the backend
const WS_URL = `${window.location.protocol === 'http:' ? 'ws:' : 'ws:'}//${window.location.host}/comfy-api`;

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
            };
        };
    };
}

/**
 * Helper to perform a fetch with a specific timeout.
 */
async function fetchWithTimeout(resource: string | Request, options: RequestInit & { timeout?: number } = {}) {
    const { timeout = 5000 } = options;

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
const uploadImage = async (base64String: string): Promise<string> => {
    try {
        const fetchResponse = await fetch(base64String);
        const blob = await fetchResponse.blob();

        const formData = new FormData();
        const filename = `sketch_${Date.now()}.png`;

        // multipart/form-data fields expected by ComfyUI
        formData.append('image', blob, filename);
        formData.append('type', 'input');
        formData.append('overwrite', 'true');

        const response = await fetchWithTimeout(`${COMFY_URL}/upload/image`, {
            method: 'POST',
            body: formData,
            timeout: 5000 // 5 second timeout as requested
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
        const socket = new WebSocket(`${WS_URL}/ws?clientId=${client_id}`);

        const timeout = setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }
            reject(new Error('Timeout waiting for render generation.'));
        }, 120000); // 2 minute timeout for complex renders

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
    const response = await fetchWithTimeout(`${COMFY_URL}/history/${promptId}`, { timeout: 5000 });
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
        await new Promise(r => setTimeout(r, 1500));
    }
    throw new Error('Timeout polling for history.');
};

export const comfyRenderService: RenderService = {
    generate: async (request: GenerateRequest): Promise<GenerateResponse> => {
        try {
            console.log('🎨 Starting Detailed Render Process...');

            // 1. Upload the Sketch
            const uploadedFileName = await uploadImage(request.init_image);
            console.log('✅ Sketch uploaded as:', uploadedFileName);

            // 2. Prepare the Workflow Payload
            const seed = Math.floor(Math.random() * 1_000_000_000_000);

            const workflowPayload = {
                "3": {
                    "inputs": {
                        "seed": seed,
                        "steps": 25,
                        "cfg": 4.5,
                        "sampler_name": "euler",
                        "scheduler": "simple",
                        "denoise": 1,
                        "model": ["4", 0],
                        "positive": ["51", 0],
                        "negative": ["51", 1],
                        "latent_image": ["33", 0]
                    },
                    "class_type": "KSampler"
                },
                "4": {
                    "inputs": { "ckpt_name": "sd3.5_large_fp8_scaled.safetensors" },
                    "class_type": "CheckpointLoaderSimple"
                },
                "6": {
                    "inputs": {
                        "text": request.prompt,
                        "clip": ["4", 1]
                    },
                    "class_type": "CLIPTextEncode"
                },
                "8": {
                    "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
                    "class_type": "VAEDecode"
                },
                "9": {
                    "inputs": { "filename_prefix": "openviz_render", "images": ["8", 0] },
                    "class_type": "SaveImage"
                },
                "33": {
                    "inputs": { "width": 1024, "height": 1024, "batch_size": request.numImages || 1 },
                    "class_type": "EmptySD3LatentImage"
                },
                "45": {
                    "inputs": { "image": uploadedFileName },
                    "class_type": "LoadImage"
                },
                "46": {
                    "inputs": { "control_net_name": "sd3.5_large_controlnet_canny.safetensors" },
                    "class_type": "ControlNetLoader"
                },
                "47": {
                    "inputs": { "low_threshold": 0.3, "high_threshold": 0.6, "image": ["48", 0] },
                    "class_type": "Canny"
                },
                "48": {
                    "inputs": { "upscale_method": "bilinear", "width": 1024, "height": 1024, "crop": "center", "image": ["45", 0] },
                    "class_type": "ImageScale"
                },
                "50": {
                    "inputs": { "conditioning": ["6", 0] },
                    "class_type": "ConditioningZeroOut"
                },
                "51": {
                    "inputs": {
                        "strength": request.drawingInfluence ?? 0.65,
                        "start_percent": 0,
                        "end_percent": 1,
                        "positive": ["6", 0],
                        "negative": ["50", 0],
                        "control_net": ["46", 0],
                        "image": ["47", 0],
                        "vae": ["4", 2]
                    },
                    "class_type": "ControlNetApplyAdvanced"
                }
            };

            // 3. Queue the Prompt with client_id
            console.log('🚀 Sending workflow to ComfyUI...');
            const queueResponse = await fetchWithTimeout(`${COMFY_URL}/prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: workflowPayload,
                    client_id: client_id
                }),
                timeout: 5000
            });

            if (!queueResponse.ok) {
                const errorText = await queueResponse.text();
                throw new Error(`Queue failed (${queueResponse.status}): ${errorText || queueResponse.statusText}`);
            }

            const queueData = await queueResponse.json();
            const promptId = queueData.prompt_id;
            console.log('⏳ Queued with ID:', promptId, 'Client ID:', client_id);

            // 4. Wait for Completion
            const historyData = await waitForCompletion(promptId);

            // 5. Extract Output Images
            const outputImages = historyData.outputs["9"].images;
            if (!outputImages || outputImages.length === 0) {
                throw new Error('No images returned from ComfyUI');
            }

            const finalImageUrls = outputImages.map((img) =>
                `${COMFY_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`
            );

            console.log('✨ Generation Success:', finalImageUrls);

            return {
                success: true,
                images: finalImageUrls,
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
    checkConnection: async (): Promise<boolean> => {
        console.log('🔍 Checking ComfyUI connection via proxy...');
        try {
            const response = await fetchWithTimeout(`${COMFY_URL}/system_stats`, { timeout: 5000 });
            if (response.ok) {
                const stats = await response.json();
                console.log('✅ ComfyUI System Stats:', stats);
                return true;
            }
            console.error('❌ ComfyUI connection failed with status:', response.status);
            return false;
        } catch (e) {
            console.error('❌ Connection check failed:', e);
            return false;
        }
    }
};

// Toggle between real and mock service using environment variable
const useMock = import.meta.env.VITE_USE_MOCK_RENDER === 'true';

export const renderService: RenderService = useMock ? mockRenderService : comfyRenderService;
