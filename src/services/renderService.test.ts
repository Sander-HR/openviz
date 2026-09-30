import { describe, it, expect, vi, beforeEach } from 'vitest';
import { comfyRenderService, downscaleImageApiDimensions, normalizeImageApiSize } from './renderService';

// Mock the fetch call
global.fetch = vi.fn();

describe('renderService integration', () => {
    it('downscales oversized output while preserving aspect ratio', () => {
        expect(downscaleImageApiDimensions(1024, 704)).toEqual({ width: 512, height: 352 });
    });
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default successful responses for upload and prompt
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.startsWith('data:image')) {
                return Promise.resolve({
                    ok: true,
                    blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' }))
                });
            }
            if (url.includes('/upload/image')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ name: 'uploaded_file.png' })
                });
            }
            if (url.includes('/prompt')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ prompt_id: 'test_prompt_id' })
                });
            }
            if (url.includes('/history')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        'test_prompt_id': {
                            status: { status_str: 'success' },
                            outputs: {
                                '9': {
                                    images: [{ filename: 'out.png', subfolder: '', type: 'output' }],
                                },
                                '37': { // video_output node for animate_from_to
                                    videos: [{ filename: 'out.mp4', subfolder: '', type: 'output' }]
                                }
                            }
                        }
                    })
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
    });

    it('normalizes API dimensions to multiples of 16 without forcing a square ratio', () => {
        expect(normalizeImageApiSize(1024, 682)).toBe('1024x688');
        expect(normalizeImageApiSize(900, 1200)).toBe('896x1200');
    });

    it('injects the selected style prompt into the ComfyUI positive prompt', async () => {
        await comfyRenderService.generate({
            workflowId: 'cyberpunk',
            prompt: 'A desk lamp',
            stylePreset: 'Cyberpunk / Neon',
            drawingInfluence: 0.65,
            numImages: 1,
            init_image: 'data:image/png;base64,input',
            width: 1024,
            height: 1024,
        });

        const promptCall = (global.fetch as any).mock.calls.find((call: any) => call[0].includes('/prompt'));
        expect(promptCall).toBeDefined();
        const payload = JSON.parse(promptCall[1].body);
        expect(payload.prompt['6'].inputs.text).toContain('A desk lamp');
        expect(payload.prompt['6'].inputs.text).toContain('Style direction:');
        expect(payload.prompt['6'].inputs.text).toContain('cyberpunk/neon');
    });

    it('should correctly map nodes for animate_from_to workflow', async () => {
        const request = {
            workflowId: 'animate_from_to',
            init_image: 'data:image/png;base64,start',
            end_image: 'data:image/png;base64,end',
            prompt: 'test animation prompt',
            width: 832,
            height: 480
        };

        await comfyRenderService.animate(request);

        // Check the third fetch call (1st: upload start, 2nd: upload end, 3rd: prompt)
        const promptCall = (global.fetch as any).mock.calls.find((call: any) => call[0].includes('/prompt'));
        expect(promptCall).toBeDefined();

        const payload = JSON.parse(promptCall[1].body);
        const workflow = payload.prompt;

        // Verify Node 14 (Start Image)
        expect(workflow['14'].inputs.image).toBe('uploaded_file.png');

        // Verify Node 21 (End Image)
        expect(workflow['21'].inputs.image).toBe('uploaded_file.png');

        // Verify Node 22 (Prompt - StringConstantMultiline)
        expect(workflow['22'].inputs.string).toBe('test animation prompt');

        // Verify Node 2 (Sampler - Seed)
        expect(workflow['2'].inputs.seed).toBeDefined();
    });
});
