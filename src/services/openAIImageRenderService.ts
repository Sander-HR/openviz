import { RenderService, GenerateRequest, GenerateResponse } from './types';
import { createOpenAIImageTarget } from './ai/targets/openAIImageTarget';
import { useStore } from '@/store/useStore';
import { createGenerationQueue, type GenerationQueueSnapshot } from '@/services/ai/generationQueue';
import { composeStylePrompt } from './ai/stylePromptRegistry';

const openAIImageGenerationQueue = createGenerationQueue();

/**
 * Read-only access to the client-side OpenAI-compatible image queue. The
 * workbench Compute popup uses this to surface live active/queued counts;
 * it is scoped to this browser session, not a server-wide queue.
 */
export const imageApiQueue = {
    getSnapshot: (endpoint: string) => openAIImageGenerationQueue.getSnapshot(endpoint),
    subscribe: (listener: (snapshot: GenerationQueueSnapshot) => void) =>
        openAIImageGenerationQueue.subscribe(listener),
};

/**
 * Unsloth requires both dimensions to be multiples of 16. Round the requested
 * canvas size to the nearest valid dimensions independently so the requested
 * aspect ratio is retained instead of silently forcing a square image.
 */
export function normalizeImageApiSize(width: number, height: number): string {
    const normalizedWidth = Math.max(16, Math.round(width / 16) * 16);
    const normalizedHeight = Math.max(16, Math.round(height / 16) * 16);
    return `${normalizedWidth}x${normalizedHeight}`;
}

/**
 * Scale a render to a bounded long edge while preserving its aspect ratio.
 * Native diffusion accepts dimensions in multiples of 16.
 */
export function downscaleImageApiDimensions(width: number, height: number, maxLongEdge = 512): { width: number; height: number } {
    const scale = Math.min(1, maxLongEdge / Math.max(width, height));
    return {
        width: Math.max(256, Math.round((width * scale) / 16) * 16),
        height: Math.max(256, Math.round((height * scale) / 16) * 16),
    };
}

export const openAIImageRenderService: RenderService = {
    async generate(request: GenerateRequest): Promise<GenerateResponse> {
        const settings = useStore.getState().computeSettings;
        const endpoint = settings.imageApiEndpoint ?? '';
        openAIImageGenerationQueue.setConcurrency(settings.endpointConcurrency ?? 2);

        return openAIImageGenerationQueue.enqueue(endpoint, async () => {
            const size = normalizeImageApiSize(request.width, request.height);
            const target = createOpenAIImageTarget({
                id: 'image-api',
                endpoint,
                model: settings.imageApiModel ?? '',
                apiKey: settings.imageApiKey ?? '',
                keyless: settings.imageApiKeyless ?? false,
                size,
            });

            try {
                const submitted = await target.submit({
                    workflowId: request.workflowId ?? 'image-generation',
                    prompt: composeStylePrompt(request.prompt, request.stylePreset),
                    references: [],
                    width: request.width,
                    height: request.height,
                    batchSize: request.numImages ?? 1,
                    initImage: request.init_image || undefined,
                    referenceImages: request.referenceImages,
                    imageWorkflow: request.imageWorkflow,
                    referenceResolution: request.referenceResolution,
                    parameters: {
                        stylePreset: request.stylePreset,
                        drawingInfluence: request.drawingInfluence,
                    },
                });
                const outputs = await target.getOutputs(submitted.jobId);
                return { success: true, images: outputs.map((output) => output.url) };
            } catch (error) {
                return {
                    success: false,
                    images: [],
                    error: error instanceof Error ? error.message : 'OpenAI-compatible image generation failed.',
                };
            }
        }).promise;
    },

    async animate(): Promise<GenerateResponse> {
        return { success: false, images: [], error: 'The OpenAI-compatible image API does not support animation.' };
    },

    async checkConnection(): Promise<boolean> {
        const settings = useStore.getState().computeSettings;
        const target = createOpenAIImageTarget({
            id: 'image-api',
            endpoint: settings.imageApiEndpoint ?? '',
            model: settings.imageApiModel ?? '',
            apiKey: settings.imageApiKey ?? '',
            keyless: settings.imageApiKeyless ?? false,
        });
        const health = await target.health();
        return health.status === 'ready';
    },
};
