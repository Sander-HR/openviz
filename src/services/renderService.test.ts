import { describe, it, expect, vi, beforeEach } from 'vitest';
// @vitest-environment jsdom
import { comfyRenderService } from './renderService';

// Mock the fetch call
global.fetch = vi.fn();

describe('renderService integration', () => {
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
