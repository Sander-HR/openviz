import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAssetPipeline } from '@/services/assetPipelineMock';
import { createRenderTaskService, RenderTaskCapabilityError } from '@/services/renderTaskService';
import { RenderTaskValidationError } from '@/services/ai/renderTaskResolver';
import { BenchmarkGateError } from '@/services/ai/renderTaskCoordinator';
import type { ComputeSettings } from '@/types/executionTarget.types';
import type { TaskRecord } from '@/types/renderTask.types';

type Fetcher = typeof fetch;

/** vi.fn mock that still exposes .mock.calls through the Fetcher cast. */
interface FetchMockLike {
    mock: { calls: Array<[RequestInfo | URL, RequestInit?]> };
}

const SETTINGS: ComputeSettings = {
    targetKind: 'hosted',
    protocol: 'openai-image',
    preference: 'balanced',
    localEndpoint: '',
    hostedEndpoint: '',
    imageApiEndpoint: 'http://localhost:8001/v1',
    imageApiKey: 'secret',
    imageApiKeyless: false,
    imageApiModels: ['qwen-image-edit-2511'],
    imageApiModel: 'qwen-image-edit-2511',
    imageApiSize: '1024x1024',
    endpointConcurrency: 2,
    benchmarkGateEnabled: true,
};

interface RepoCall {
    kind: 'create' | 'update';
    record?: TaskRecord;
    id?: string;
    patch?: Partial<Pick<TaskRecord, 'status' | 'error' | 'outputIds'>>;
}

function makeRepo() {
    const calls: RepoCall[] = [];
    return {
        calls,
        create: vi.fn(async (record: TaskRecord) => {
            calls.push({ kind: 'create', record });
        }),
        update: vi.fn(async (id: string, patch: Partial<Pick<TaskRecord, 'status' | 'error' | 'outputIds'>>) => {
            calls.push({ kind: 'update', id, patch });
        }),
    };
}

/** Fake Unsloth endpoint: image native route, video native route + progress, vision chat. */
function makeFetcher(overrides: Partial<Record<'imageBody' | 'videoOutcome' | 'chatBody', unknown>> = {}): Fetcher & FetchMockLike {
    let videoPolls = 0;
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';

        if (url.endsWith('/openapi.json')) {
            return new Response(
                JSON.stringify({
                    openapi: '3.0.0',
                    paths: {
                        '/api/inference/video/generate': { post: {} },
                        '/api/inference/images/generate-progress': { get: {} },
                    },
                }),
                { status: 200 },
            );
        }

        if (url.endsWith('/api/inference/images/generate') && method === 'POST') {
            const body = overrides.imageBody;
            if (body) return new Response(JSON.stringify(body), { status: 500 });
            return new Response(JSON.stringify({ images: [{ url: 'data:image/png;base64,QUJD' }] }), { status: 200 });
        }

        if (url.endsWith('/api/inference/video/generate') && method === 'POST') {
            return new Response(JSON.stringify({ status: 'started', video: null }), { status: 200 });
        }

        if (url.endsWith('/api/inference/video/generate-progress')) {
            videoPolls += 1;
            if (videoPolls < 2) return new Response(JSON.stringify({ active: true, phase: 'denoise', fraction: 0.5 }), { status: 200 });
            const outcome = overrides.videoOutcome;
            if (outcome) return new Response(JSON.stringify(outcome), { status: 200 });
            return new Response(
                JSON.stringify({ active: false, phase: 'completed', video: { url: '/api/inference/video/gallery/v1/file.mp4' } }),
                { status: 200 },
            );
        }

        if (url.endsWith('/api/inference/video/gallery/v1/file.mp4')) {
            return new Response('video-bytes', { status: 200, headers: { 'Content-Type': 'video/mp4' } });
        }

        if (url.endsWith('/v1/chat/completions') && method === 'POST') {
            const body = overrides.chatBody;
            const content = typeof body === 'string' ? body : JSON.stringify(body);
            return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), { status: 200 });
        }

        throw new Error(`Unexpected fetch in renderTaskService test: ${method} ${url}`);
    }) as Fetcher & FetchMockLike;
}

function makeService(fetcher: Fetcher, repo = makeRepo(), settings: ComputeSettings = SETTINGS) {
    const service = createRenderTaskService({
        getSettings: () => settings,
        resolveReferenceImage: async () => 'data:image/png;base64,aW1n',
        repository: repo,
        fetcher,
        pollIntervalMs: 1,
        benchmarkStatusFor: () => 'validated', // bypass the launch gate unless a test overrides
    });
    return { service, repo };
}

beforeEach(() => {
    mockAssetPipeline();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('renderTaskService.submit — validation & persistence (T007, FR-019)', () => {
    it('rejects invalid requests before persisting anything', async () => {
        const fetcher = makeFetcher();
        const { service, repo } = makeService(fetcher);

        await expect(service.submit({ kind: 'modify', prompt: 'make the base matte black' })).rejects.toBeInstanceOf(RenderTaskValidationError);
        expect(repo.create).not.toHaveBeenCalled();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('persists a task record with resolved params, seeds and terminal status for Modify (edit workflow)', async () => {
        const fetcher = makeFetcher();
        const { service, repo } = makeService(fetcher);

        const submitted = await service.submit({ kind: 'modify', prompt: 'make the base matte black', referenceImageId: 'img-1', referenceFidelity: 0.9 });
        const outcome = await submitted.promise;

        expect(outcome.allOutputsSucceeded).toBe(true);
        expect(outcome.outputIds).toHaveLength(1);

        const created = repo.calls.find((call) => call.kind === 'create')?.record;
        expect(created?.kind).toBe('modify');
        expect(created?.protocol).toBe('openai-compatible');
        expect(created?.status).toBe('queued');
        expect(created?.queuePositionAtSubmit).toBe(1);
        expect(created?.resolved.workflow).toBe('edit');
        expect(created?.resolved.seeds).toHaveLength(1);
        expect(created?.resolved.prompt).toContain('make the base matte black');

        const updates = repo.calls.filter((call) => call.kind === 'update');
        const terminal = updates[updates.length - 1];
        expect(terminal?.patch?.status).toBe('completed');
        expect(terminal?.patch?.outputIds).toHaveLength(1);

        // The native image payload carries strength, seeds and the negative prompt (FR-005/FR-012).
        const imageCall = fetcher.mock.calls.find((call) => String(call[0]).endsWith('/api/inference/images/generate'));
        const body = JSON.parse((imageCall?.[1] as RequestInit).body as string);
        expect(body.workflow).toBe('edit');
        expect(typeof body.strength).toBe('number');
        // Single output ⇒ scalar seed; batches emit a seeds array (FR-014).
        expect(body.seed ?? body.seeds?.[0]).toBe(created?.resolved.seeds[0]);
        expect(body.negative_prompt).toBeTruthy();
    });

    it('routes Instant Render through the reference workflow at the chosen preset dims (FR-013)', async () => {
        const fetcher = makeFetcher();
        const { service } = makeService(fetcher);

        const submitted = await service.submit({ kind: 'instant-render', prompt: 'warm living room, three-quarter view', referenceImageId: 'img-1', aspectRatio: '16:9' });
        await submitted.promise;

        const imageCall = fetcher.mock.calls.find((call) => String(call[0]).endsWith('/api/inference/images/generate'));
        const body = JSON.parse((imageCall?.[1] as RequestInit).body as string);
        expect(body.workflow).toBe('reference');
        expect(body.width).toBe(1280);
        expect(body.height).toBe(720);
        expect(Array.isArray(body.reference_images)).toBe(true);
        expect(body.init_image).toBeUndefined();
    });

    it('resolves a form-variate batch of 4 to four unique seeds (FR-014)', async () => {
        const fetcher = makeFetcher();
        const { service, repo } = makeService(fetcher);

        await (await service.submit({ kind: 'form-variate', referenceImageId: 'img-1', variationCount: 4, formDirection: { preset: 'balanced', magnitude: 0.5 } })).promise;

        const created = repo.calls.find((call) => call.kind === 'create')?.record;
        expect(created?.resolved.seeds).toHaveLength(4);
        expect(new Set(created?.resolved.seeds).size).toBe(4);
    });

    it('persists a failed record with the error reason when the endpoint fails (SC-009 retryable)', async () => {
        const fetcher = makeFetcher({ imageBody: { detail: 'model not loaded' } });
        const { service, repo } = makeService(fetcher);

        const submitted = await service.submit({ kind: 'modify', prompt: 'make the base matte black', referenceImageId: 'img-1' });
        const outcome = await submitted.promise;

        expect(outcome.allOutputsSucceeded).toBe(false);
        expect(outcome.outputIds).toHaveLength(0);
        const updates = repo.calls.filter((call) => call.kind === 'update');
        const terminal = updates[updates.length - 1];
        expect(terminal?.patch?.status).toBe('failed');
        expect(terminal?.patch?.error).toContain('model not loaded');
    });

    it('rejects unvalidated task kinds while the benchmark gate is enabled (FR-021)', async () => {
        const fetcher = makeFetcher();
        const repo = makeRepo();
        const service = createRenderTaskService({
            getSettings: () => SETTINGS,
            resolveReferenceImage: async () => 'data:image/png;base64,aW1n',
            repository: repo,
            fetcher,
            pollIntervalMs: 1,
            // default benchmarkStatusFor → 'starting'
        });

        await expect(service.submit({ kind: 'modify', prompt: 'x', referenceImageId: 'img-1' })).rejects.toBeInstanceOf(BenchmarkGateError);
        expect(repo.create).not.toHaveBeenCalled();
    });

    it('re-reads the gate from live settings at submit time (singleton service, FR-021)', async () => {
        const fetcher = makeFetcher();
        const repo = makeRepo();
        const settings: ComputeSettings = { ...SETTINGS };
        const service = createRenderTaskService({
            getSettings: () => settings,
            resolveReferenceImage: async () => 'data:image/png;base64,aW1n',
            repository: repo,
            fetcher,
            pollIntervalMs: 1,
            // default benchmarkStatusFor → 'starting'
        });

        await expect(service.submit({ kind: 'modify', prompt: 'x', referenceImageId: 'img-1' })).rejects.toBeInstanceOf(BenchmarkGateError);

        // User disables the gate in settings after the service (and its coordinator) already exists.
        settings.benchmarkGateEnabled = false;
        const submitted = await service.submit({ kind: 'modify', prompt: 'x', referenceImageId: 'img-1' });
        const outcome = await submitted.promise;

        expect(outcome.allOutputsSucceeded).toBe(true);
    });
});

describe('renderTaskService.submit — video routing (T007, R1)', () => {
    it('routes Animate through the native video route with progress polling when probed', async () => {
        const fetcher = makeFetcher();
        const { service, repo } = makeService(fetcher);

        const submitted = await service.submit({ kind: 'animate', prompt: 'slow 360 degree turntable', referenceImageId: 'img-1', duration: '4s' });
        const outcome = await submitted.promise;

        expect(outcome.allOutputsSucceeded).toBe(true);
        expect(outcome.outputIds).toHaveLength(1);

        const generateCall = fetcher.mock.calls.find((call) => String(call[0]).endsWith('/api/inference/video/generate'));
        expect(generateCall).toBeDefined();
        const body = JSON.parse((generateCall?.[1] as RequestInit).body as string);
        expect(body.num_frames).toBe(96); // 4s × 24fps (R1)
        expect(body.fps).toBe(24);

        const created = repo.calls.find((call) => call.kind === 'create')?.record;
        expect(created?.resolved.workflow).toBe('video');
        expect(created?.protocol).toBe('openai-compatible');
    });

    it('surfaces a capability error when no active protocol serves video', async () => {
        const fetcher = makeFetcher();
        const repo = makeRepo();
        const service = createRenderTaskService({
            getSettings: () => ({ ...SETTINGS, imageApiEndpoint: '', protocol: 'openai-image' }),
            resolveReferenceImage: async () => 'data:image/png;base64,aW1n',
            repository: repo,
            fetcher,
            pollIntervalMs: 1,
            benchmarkStatusFor: () => 'validated',
        });

        await expect(service.submit({ kind: 'animate', prompt: 'turntable', referenceImageId: 'img-1' })).rejects.toBeInstanceOf(RenderTaskCapabilityError);
        expect(repo.create).not.toHaveBeenCalled();
    });
});

describe('renderTaskService.submit — extraction routing (T007, FR-020)', () => {
    const colorVisionOutput = {
        kind: 'color',
        sampleBy: 'hierarchy',
        confidence: 0.9,
        components: [{ name: 'Base', region: { x: 0.2, y: 0.7, w: 0.5, h: 0.2 }, color: { hex: '#111111', confidence: 0.8 } }],
    };

    it('routes Extract through the vision pipeline and persists the task record', async () => {
        const fetcher = makeFetcher({ chatBody: colorVisionOutput });
        const { service, repo } = makeService(fetcher);

        const submitted = await service.submit({ kind: 'extract', referenceImageId: 'img-1', extractKind: 'color', sampleBy: 'hierarchy' });
        const outcome = await submitted.promise;

        expect(outcome.allOutputsSucceeded).toBe(true);
        expect(outcome.outputIds).toHaveLength(1);

        const chatCall = fetcher.mock.calls.find((call) => String(call[0]).endsWith('/v1/chat/completions'));
        expect(chatCall).toBeDefined();

        const created = repo.calls.find((call) => call.kind === 'create')?.record;
        expect(created?.kind).toBe('extract');
        const updates = repo.calls.filter((call) => call.kind === 'update');
        const terminal = updates[updates.length - 1];
        expect(terminal?.patch?.status).toBe('completed');
    });

    it('persists a failed record when the vision pipeline rejects the answer', async () => {
        const fetcher = makeFetcher({ chatBody: 'not json' });
        const { service, repo } = makeService(fetcher);

        const submitted = await service.submit({ kind: 'extract', referenceImageId: 'img-1', extractKind: 'color', sampleBy: 'hierarchy' });
        await submitted.promise;

        const updates = repo.calls.filter((call) => call.kind === 'update');
        const terminal = updates[updates.length - 1];
        expect(terminal?.patch?.status).toBe('failed');
        expect(terminal?.patch?.error).toBeTruthy();
    });
});
