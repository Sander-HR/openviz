import { RenderService, GenerateRequest, GenerateResponse } from './types';

/**
 * A mock implementation of the RenderService for debugging and testing.
 * It simulates network delays and returns placeholder images.
 */
export const mockRenderService: RenderService = {
    generate: async (request: GenerateRequest): Promise<GenerateResponse> => {
        console.log('🧪 [Mock] Starting mock render process...', request);

        // Simulate upload and processing delay
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        await delay(1500); // Simulate upload
        console.log('🧪 [Mock] Sketch uploaded (simulated)');

        await delay(3000); // Simulate rendering
        console.log('🧪 [Mock] Rendering completed (simulated)');

        // Return a set of placeholder images
        // We use picsum.photos for variety, using the seed to keep them consistent for a given request if needed
        const seed = Math.floor(Math.random() * 1000);
        const images = Array.from({ length: request.numImages || 1 }, (_, i) =>
            `https://picsum.photos/seed/${seed + i}/1024/1024`
        );

        return {
            success: true,
            images: images,
        };
    },

    checkConnection: async (): Promise<boolean> => {
        console.log('🔍 [Mock] Checking mock connection...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ [Mock] Connection check successful');
        return true;
    }
};
