import { describe, expect, it, vi } from 'vitest';
import { buildExtractionPrompt } from '@/services/ai/extractionPrompts';
import { createExtractionRunner, ExtractionValidationError } from '@/services/ai/extractionService';
import { buildPixelBuffer, type PixelBuffer } from '@/services/ai/colorAnalysis';
import type { RenderTaskRequest } from '@/types/renderTask.types';

type Fetcher = typeof fetch;

function chatResponse(payload: unknown): Response {
    return new Response(
        JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(payload) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
}

const colorVisionOutput = {
    kind: 'color',
    sampleBy: 'hierarchy',
    confidence: 0.91,
    components: [
        { name: 'Base', region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 }, color: { label: 'matte black', hex: '#111111', confidence: 0.8 } },
        { name: 'Arc arm', region: { x: 0.3, y: 0.2, w: 0.4, h: 0.5 }, color: { label: 'brass', hex: '#b08d57', confidence: 0.7 } },
    ],
};

const redBuffer: PixelBuffer = buildPixelBuffer(100, 100, () => ({ r: 200, g: 30, b: 40, a: 255 }));

function colorRequest(overrides: Partial<RenderTaskRequest> = {}): RenderTaskRequest {
    return { kind: 'extract', referenceImageId: 'img-1', extractKind: 'color', sampleBy: 'hierarchy', ...overrides };
}

function makeRunner(options: { fetcher?: Fetcher; loadPixels?: (source: string) => Promise<PixelBuffer> }) {
    return createExtractionRunner({
        endpoint: 'http://localhost:8001/v1',
        model: 'qwen-vl',
        apiKey: 'secret',
        fetcher: options.fetcher,
        loadPixels: options.loadPixels,
    });
}

describe('extractionPrompts — structured analysis contracts (T020, FR-018)', () => {
    it('requires JSON output and names the kind-specific fields for color', () => {
        const prompt = buildExtractionPrompt('color', 'hierarchy');
        expect(prompt.system).toMatch(/json/i);
        expect(prompt.system).toMatch(/hex/);
        expect(prompt.system).toMatch(/confidence/);
    });

    it('separates observations from inferences for material', () => {
        const prompt = buildExtractionPrompt('material', 'hierarchy');
        expect(prompt.system).toMatch(/observations/);
        expect(prompt.system).toMatch(/inferences/);
    });

    it('asks for semantic roles for parts', () => {
        const prompt = buildExtractionPrompt('parts', 'hierarchy');
        expect(prompt.system).toMatch(/role/);
    });

    it('excludes background content in every variant', () => {
        for (const kind of ['color', 'material', 'parts'] as const) {
            for (const sampleBy of ['hierarchy', 'region'] as const) {
                expect(buildExtractionPrompt(kind, sampleBy).system).toMatch(/background/i);
            }
        }
    });

    it('uses different phrasing for hierarchy vs region sampling', () => {
        const hierarchy = buildExtractionPrompt('parts', 'hierarchy').user;
        const region = buildExtractionPrompt('parts', 'region').user;
        expect(hierarchy).not.toEqual(region);
        expect(hierarchy).toMatch(/component/i);
        expect(region).toMatch(/region/i);
    });
});

describe('extractionService.run — vision stage + deterministic color refinement (T020, FR-018, R2)', () => {
    it('returns the structured record for a valid color extraction and refines hexes from pixels', async () => {
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse(colorVisionOutput));
        const loadPixels = vi.fn<(source: string) => Promise<PixelBuffer>>().mockResolvedValueOnce(redBuffer);
        const runner = makeRunner({ fetcher, loadPixels });

        const output = await runner.run(colorRequest(), 'data:image/png;base64,aW1n');

        expect(output.kind).toBe('color');
        expect(output.sampleBy).toBe('hierarchy');
        expect(output.components).toHaveLength(2);
        // Deterministic sampling (solid #c81e28 buffer) replaces the model hexes.
        for (const component of output.components) {
            expect(component.color?.hex).toBe('#c81e28');
            expect(component.color?.confidence).toBeGreaterThan(0.9);
        }
        // The vision label is kept as a sanity-check annotation.
        expect(output.components[0]?.color?.label).toBe('matte black');

        const call = fetcher.mock.calls[0];
        expect(call?.[0]).toBe('http://localhost:8001/v1/chat/completions');
        const body = JSON.parse((call?.[1] as RequestInit).body as string);
        expect(body.model).toBe('qwen-vl');
        const userContent = body.messages[1].content;
        expect(userContent.some((part: { type: string }) => part.type === 'image_url')).toBe(true);
    });

    it('passes material observations and inferences through untouched', async () => {
        const vision = {
            kind: 'material',
            sampleBy: 'hierarchy',
            confidence: 0.8,
            components: [
                {
                    name: 'Base',
                    region: { x: 0.1, y: 0.7, w: 0.5, h: 0.2 },
                    material: { category: 'metal', finish: 'matte', observations: ['Non-reflective surface'], inferences: ['Likely powder-coated steel'] },
                },
            ],
        };
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse(vision));
        const runner = makeRunner({ fetcher, loadPixels: vi.fn().mockRejectedValue(new Error('no pixels needed')) });

        const output = await runner.run(colorRequest({ extractKind: 'material' }), 'data:image/png;base64,aW1n');

        expect(output.components[0]?.material?.observations).toEqual(['Non-reflective surface']);
        expect(output.components[0]?.material?.inferences).toEqual(['Likely powder-coated steel']);
    });

    it('keeps parts roles and regions in the record', async () => {
        const vision = {
            kind: 'parts',
            sampleBy: 'region',
            confidence: 0.75,
            components: [
                { name: 'Lamp head', role: 'light housing', region: { x: 0.6, y: 0.1, w: 0.3, h: 0.2 } },
                { name: 'Base', role: 'counterweight', region: { x: 0.2, y: 0.75, w: 0.4, h: 0.15 } },
            ],
        };
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse(vision));
        const runner = makeRunner({ fetcher });

        const output = await runner.run(colorRequest({ extractKind: 'parts', sampleBy: 'region' }), 'data:image/png;base64,aW1n');

        expect(output.components[0]?.role).toBe('light housing');
        expect(output.components[1]?.region).toEqual({ x: 0.2, y: 0.75, w: 0.4, h: 0.15 });
    });

    it('rejects a record whose kind does not match the requested extraction', async () => {
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse({ ...colorVisionOutput, kind: 'parts' }));
        const runner = makeRunner({ fetcher });
        await expect(runner.run(colorRequest(), 'data:image/png;base64,aW1n')).rejects.toBeInstanceOf(ExtractionValidationError);
    });

    it('rejects empty component lists (background-only images must not fabricate parts)', async () => {
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse({ ...colorVisionOutput, components: [] }));
        const runner = makeRunner({ fetcher });
        await expect(runner.run(colorRequest(), 'data:image/png;base64,aW1n')).rejects.toBeInstanceOf(ExtractionValidationError);
    });

    it('rejects out-of-range region boxes', async () => {
        const bad = { ...colorVisionOutput, components: [{ name: 'Base', region: { x: 1.5, y: 0, w: 0.2, h: 0.2 }, color: { hex: '#111111', confidence: 0.5 } }] };
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse(bad));
        const runner = makeRunner({ fetcher });
        await expect(runner.run(colorRequest(), 'data:image/png;base64,aW1n')).rejects.toBeInstanceOf(ExtractionValidationError);
    });

    it('rejects malformed hex values on color extractions', async () => {
        const bad = { ...colorVisionOutput, components: [{ name: 'Base', region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 }, color: { hex: 'black', confidence: 0.9 } }] };
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse(bad));
        const runner = makeRunner({ fetcher });
        await expect(runner.run(colorRequest(), 'data:image/png;base64,aW1n')).rejects.toBeInstanceOf(ExtractionValidationError);
    });

    it('surfaces a client-safe error when the vision call is not JSON', async () => {
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(new Response('not json', { status: 200 }));
        const runner = makeRunner({ fetcher });
        await expect(runner.run(colorRequest(), 'data:image/png;base64,aW1n')).rejects.toThrow(/extraction/i);
    });

    it('surfaces the endpoint error on HTTP failure', async () => {
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'model not loaded' }), { status: 422 }));
        const runner = makeRunner({ fetcher });
        await expect(runner.run(colorRequest(), 'data:image/png;base64,aW1n')).rejects.toThrow(/model not loaded/);
    });

    it('falls back to the vision hexes when pixel decoding is unavailable', async () => {
        const fetcher = vi.fn<Fetcher>().mockResolvedValueOnce(chatResponse(colorVisionOutput));
        const runner = makeRunner({ fetcher, loadPixels: vi.fn().mockRejectedValue(new Error('decode failed')) });

        const output = await runner.run(colorRequest(), 'data:image/png;base64,aW1n');

        expect(output.components[0]?.color?.hex).toBe('#111111');
    });
});
