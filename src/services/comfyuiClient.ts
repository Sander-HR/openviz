import { generateUUID } from '@/utils/uuid';

// Using Vite proxy to avoid CORS issues
let comfyUrl = '/comfy-api';
// We use the same protocol and host as the current page, but Vite will proxy /comfy-api to the backend
const browserWindow = typeof window !== 'undefined' ? window : null;
let wsUrl = browserWindow
    ? `${browserWindow.location.protocol === 'http:' ? 'ws:' : 'wss:'}//${browserWindow.location.host}/comfy-api`
    : 'ws://localhost/comfy-api';

// Generate a persistent client ID for this session
export const client_id = generateUUID();

/**
 * Returns the active ComfyUI proxy base URL (may switch to the secondary proxy).
 */
export function getComfyUrl(): string {
    return comfyUrl;
}

/**
 * Switches the active proxy, updating both HTTP and WebSocket URLs.
 */
export function setComfyProxy(url: string): void {
    comfyUrl = url;
    wsUrl = `${window.location.protocol === 'http:' ? 'ws:' : 'wss:'}//${window.location.host}${url}`;
}

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
export async function fetchWithTimeout(resource: string | Request, options: RequestInit & { timeout?: number } = {}) {
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
export const uploadImage = async (base64String: string, prefix = 'sketch'): Promise<string> => {
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
        } catch {
            // Silently retry
        }
        attempts++;
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Timeout polling for history.');
};

/**
 * Waits for generation completion via WebSocket or polls history as a fallback.
 */
export const waitForCompletion = async (promptId: string): Promise<ComfyHistoryResponse[string]> => {
    if (
        typeof WebSocket === 'undefined' ||
        (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')
    ) {
        return pollHistory(promptId);
    }

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
