import { RenderService, GenerateRequest, GenerateResponse, AnimateRequest } from './types';

/**
 * Refactored Render Service that delegates AI jobs to the Backend.
 */
export const apiRenderService: RenderService = {
    generate: async (request: GenerateRequest): Promise<GenerateResponse> => {
        try {
            // 1. Get S3 Upload URL
            const uploadRes = await fetch("/api/assets/upload-url", {
                method: "POST",
                body: JSON.stringify({ filename: "sketch.png", contentType: "image/png" }),
            });
            const { uploadUrl, key: initImageKey } = await uploadRes.json();

            // 2. Upload to S3
            const imageBlob = await (await fetch(request.init_image)).blob();
            await fetch(uploadUrl, { method: "PUT", body: imageBlob, headers: { "Content-Type": "image/png" } });

            // 3. Trigger Job
            const jobRes = await fetch("/api/generate", {
                method: "POST",
                body: JSON.stringify({
                    projectId: request.projectId || "default", // Need to ensure projectId is passed correctly
                    prompt: request.prompt,
                    initImageKey,
                    options: {
                        strength: request.drawingInfluence,
                        stylePreset: request.stylePreset,
                        numImages: request.numImages,
                        width: request.width,
                        height: request.height,
                    }
                }),
            });
            const { jobId } = await jobRes.json();

            return {
                success: true,
                images: [], // Images will be fetched via job status later
                jobId,
            } as any; // Extending types as needed
        } catch (error: any) {
            return { success: false, images: [], error: error.message };
        }
    },

    animate: async (_request: AnimateRequest): Promise<GenerateResponse> => {
        // Similar pattern for animate...
        return { success: false, images: [] };
    },

    checkConnection: async (): Promise<boolean> => {
        const res = await fetch("/api/health");
        return res.ok;
    }
};

export const renderService = apiRenderService;
