import { RenderService, GenerateRequest, GenerateResponse, AnimateRequest } from './types';

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

        // Return a set of placeholder images with requested dimensions
        // We use picsum.photos for variety, using the seed to keep them consistent for a given request if needed
        const seed = Math.floor(Math.random() * 1000);
        const width = request.width || 1024;
        const height = request.height || 1024;
        const images = Array.from({ length: request.numImages || 1 }, (_, i) =>
            `https://picsum.photos/seed/${seed + i}/${width}/${height}`
        );

        return {
            success: true,
            images: images,
        };
    },

    animate: async (request: AnimateRequest): Promise<GenerateResponse> => {
        console.log('🧪 [Mock] Starting mock animation process...', request);

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        await delay(5000); // Animation takes longer

        // Simulate video URL (using a placeholder video or GIF if possible, but let's just return a placeholder image for now as the type expects string URLs)
        // Ideally GenerateResponse.images should support video URLs too
        const videoUrl = `https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzQyMzQyMzQyMzQyMzQyMzQyMzQyMzQyMzQyMzQyMzQmZXA9djFfaW50ZXJuYWxfZ2lmX2J5X2lkJmN0PWc/3o7aD2saalBwwftBIY/giphy.gif`; // Just a placeholder gif

        return {
            success: true,
            images: [videoUrl]
        };
    },

    checkConnection: async (): Promise<boolean> => {
        console.log('🔍 [Mock] Checking mock connection...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ [Mock] Connection check successful');
        return true;
    }
};
