import { RenderService, GenerateRequest, GenerateResponse, AnimateRequest } from './types';

const MOCK_VIDEOS = [
    'https://download.samplelib.com/mp4/sample-5s.mp4',
    'https://download.samplelib.com/mp4/sample-10s.mp4',
    'https://download.samplelib.com/mp4/sample-15s.mp4',
    'https://download.samplelib.com/mp4/sample-20s.mp4',
    'https://download.samplelib.com/mp4/sample-30s.mp4'
];

/**
 * A mock implementation of the RenderService for debugging and testing.
 * It simulates network delays and returns placeholder images.
 */
export const mockRenderService: RenderService = {
    generate: async (request: GenerateRequest): Promise<GenerateResponse> => {
        console.log('🧪 [Mock] Starting mock render process...', request);

        // Simulate upload and processing delay
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        await delay(1000); // Simulate upload and rendering
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
        await delay(1500); // Simulate animation rendering

        // Return a random video from our mock library
        const randomIndex = Math.floor(Math.random() * MOCK_VIDEOS.length);
        const videoUrl = MOCK_VIDEOS[randomIndex];

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
