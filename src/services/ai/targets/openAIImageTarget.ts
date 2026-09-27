import type {
    ExecutionTargetAdapter,
    GenerationOutput,
    NormalizedJobStatus,
    PreflightResult,
    SubmittedJob,
    TargetCapabilities,
    TargetHealth,
} from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

export interface OpenAIImageTargetOptions {
    id: string;
    endpoint: string;
    model: string;
    apiKey?: string;
    keyless?: boolean;
    size?: string;
    fetcher?: Fetcher;
}

function asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

function normalizeEndpoint(endpoint: string): string {
    return endpoint.trim().replace(/\/$/, '');
}

async function readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { error: text };
    }
}

function errorMessage(body: unknown, fallback: string): string {
    const record = asRecord(body);
    const nested = asRecord(record.error);
    if (typeof nested.message === 'string') return nested.message;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
    return fallback;
}

function authorizationHeader(options: OpenAIImageTargetOptions): string | undefined {
    if (options.keyless) return undefined;
    if (!options.apiKey?.trim()) throw new Error('An API key is required unless keyless API access is enabled.');
    return `Bearer ${options.apiKey.trim()}`;
}

function headers(options: OpenAIImageTargetOptions, includeJson = false): HeadersInit {
    const authorization = authorizationHeader(options);
    return {
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
    };
}

function parseModels(body: unknown): string[] {
    const record = asRecord(body);
    const data = Array.isArray(record.data) ? record.data : [];
    return data.flatMap((entry) => {
        if (typeof entry === 'string') return [entry];
        const model = asRecord(entry);
        return typeof model.id === 'string' ? [model.id] : [];
    });
}

function parseImageOutputs(body: unknown): GenerationOutput[] {
    const data = asRecord(body).data;
    if (!Array.isArray(data)) return [];
    return data.flatMap((entry, index) => {
        const record = asRecord(entry);
        if (typeof record.url === 'string' && /^https?:\/\//.test(record.url)) {
            return [{ url: record.url, index, contentType: 'image/*' }];
        }

        // OpenAI's Images API commonly returns base64 image data instead of a
        // hosted URL. Convert it to a browser-readable data URL so the rest of
        // the render pipeline can treat both response formats identically.
        if (typeof record.b64_json === 'string' && record.b64_json.length > 0) {
            const contentType = typeof record.mime_type === 'string' && record.mime_type.startsWith('image/')
                ? record.mime_type
                : 'image/png';
            return [{
                url: `data:${contentType};base64,${record.b64_json}`,
                index,
                contentType,
            }];
        }

        return [];
    });
}

function parseSize(size: string | undefined, width: number, height: number): { width: number; height: number } {
    const match = size?.match(/^(\d+)x(\d+)$/);
    return match ? { width: Number(match[1]), height: Number(match[2]) } : { width, height };
}

function normalizeNativeImageDimensions(
    dimensions: { width: number; height: number },
    model: string,
): { width: number; height: number } {
    // Qwen Image 2.1 requires both dimensions to be divisible by 32.
    // Keep the requested aspect ratio as closely as possible while satisfying
    // the backend contract instead of allowing a 16-aligned canvas size through.
    if (/qwen[-_ ]image[-_ ]2\.1/i.test(model)) {
        return {
            width: Math.max(32, Math.round(dimensions.width / 32) * 32),
            height: Math.max(32, Math.round(dimensions.height / 32) * 32),
        };
    }
    return dimensions;
}

function endpointRoot(endpoint: string): string {
    return endpoint.replace(/\/v\d+$/i, '');
}

function resolveNativeImageUrl(endpoint: string, url: string): string {
    const normalizedUrl = url.replace(/\/$/, '');
    const galleryPath = normalizedUrl.match(/^(\/api\/inference\/images\/gallery\/[^/]+)(?:\/file)?$/);
    const resolvedPath = galleryPath ? `${galleryPath[1]}/file` : normalizedUrl;
    if (/^(?:data:|https?:\/\/)/.test(resolvedPath)) return resolvedPath;
    return `${endpointRoot(endpoint)}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`;
}

function parseNativeImageOutputs(body: unknown, endpoint: string): GenerationOutput[] {
    const images = asRecord(body).images;
    if (!Array.isArray(images)) return [];
    return images.flatMap((entry, index) => {
        const record = asRecord(entry);
        return typeof record.url === 'string'
            ? [{ url: resolveNativeImageUrl(endpoint, record.url), index, contentType: 'image/png' }]
            : [];
    });
}

async function materializeNativeImageOutputs(
    outputs: GenerationOutput[],
    options: OpenAIImageTargetOptions,
    fetcher: Fetcher,
): Promise<GenerationOutput[]> {
    return Promise.all(outputs.map(async (output) => {
        if (!/^https?:\/\//.test(output.url) || typeof URL.createObjectURL !== 'function') return output;

        const response = await fetcher(output.url, { headers: headers(options) });
        if (!response.ok) {
            throw new Error(`Rendered image download failed (${response.status}).`);
        }
        const blob = await response.blob();
        return { ...output, url: URL.createObjectURL(blob) };
    }));
}

export function createOpenAIImageTarget(options: OpenAIImageTargetOptions): ExecutionTargetAdapter {
    const endpoint = normalizeEndpoint(options.endpoint);
    const fetcher = options.fetcher ?? fetch;
    let cachedModels: string[] = [];
    let cachedOutputs: GenerationOutput[] = [];

    async function listModels(): Promise<string[]> {
        const response = await fetcher(`${endpoint}/models`, { headers: headers(options) });
        const body = await readJson(response);
        if (!response.ok) {
            const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
            throw new Error(`${errorMessage(body, `Model discovery failed (${response.status}).`)}${suffix}`);
        }
        cachedModels = parseModels(body);
        if (cachedModels.length === 0) throw new Error('The image API returned no usable models.');
        return cachedModels;
    }

    return {
        async health(): Promise<TargetHealth> {
            try {
                const models = await listModels();
                return { targetId: options.id, status: 'ready', capabilities: await this.capabilities(), message: models.join(', ') };
            } catch (error) {
                return {
                    targetId: options.id,
                    status: error instanceof Error && /401|403|API key|Authorization/i.test(error.message) ? 'auth-required' : 'unavailable',
                    message: error instanceof Error ? error.message : 'Image API is unavailable.',
                    capabilities: null,
                };
            }
        },

        async capabilities(): Promise<TargetCapabilities> {
            return {
                checkedAt: Date.now(),
                devices: [],
                customNodes: [],
                availableModels: cachedModels,
                availableNodeTypes: [],
                supportedPrecisions: [],
                supportedWorkflows: ['image-generation', 'image-edit'],
            };
        },

        async preflight(request: ProductWorkflowRequest): Promise<PreflightResult> {
            if (!options.model.trim()) {
                return { ready: false, status: 'incompatible', issues: [{ code: 'missing-model', message: 'Select an image API model before generating.' }] };
            }
            if (!request.prompt.trim()) {
                return { ready: false, status: 'incompatible', issues: [{ code: 'missing-prompt', message: 'Enter a prompt before generating.' }] };
            }
            return { ready: true, status: 'ready', issues: [], selectedTier: 'hosted-auto', explanation: 'Synchronous OpenAI-compatible image generation.' };
        },

        async submit(request: ProductWorkflowRequest): Promise<SubmittedJob> {
            const hasInputImage = Boolean(request.initImage);
            const referenceImages = request.referenceImages?.filter((image) => image.trim().length > 0) ?? [];
            const hasImageConditions = hasInputImage || referenceImages.length > 0 || Boolean(request.maskImage);
            const targetUrl = hasImageConditions
                ? `${endpointRoot(endpoint)}/api/inference/images/generate`
                : `${endpoint}/images/generations`;
            const dimensions = normalizeNativeImageDimensions(
                parseSize(options.size, request.width, request.height),
                options.model,
            );
            const payload = hasImageConditions
                ? {
                    prompt: request.prompt,
                    model: options.model,
                    width: dimensions.width,
                    height: dimensions.height,
                    batch_size: request.batchSize,
                    ...(request.initImage ? { init_image: request.initImage } : {}),
                    mask_image: request.maskImage,
                    ...(referenceImages.length > 0 ? { reference_images: referenceImages } : {}),
                    ...(request.referenceResolution ? { reference_resolution: request.referenceResolution } : {}),
                    workflow: request.imageWorkflow ?? (referenceImages.length > 0 ? 'reference' : 'edit'),
                    ...(request.negativePrompt ? { negative_prompt: request.negativePrompt } : {}),
                    ...(request.seed !== undefined ? { seed: request.seed } : {}),
                }
                : {
                    model: options.model,
                    prompt: request.prompt,
                    n: request.batchSize,
                    size: options.size ?? `${request.width}x${request.height}`,
                };
            const response = await fetcher(targetUrl, {
                method: 'POST',
                headers: headers(options, true),
                body: JSON.stringify(payload),
            });
            const body = await readJson(response);
            if (!response.ok) {
                const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
                throw new Error(`${errorMessage(body, `Image generation failed (${response.status}).`)}${suffix}`);
            }
            const parsedOutputs = hasImageConditions
                ? parseNativeImageOutputs(body, endpoint)
                : parseImageOutputs(body);
            cachedOutputs = hasInputImage
                ? await materializeNativeImageOutputs(parsedOutputs, options, fetcher)
                : parsedOutputs;
            if (cachedOutputs.length === 0) throw new Error('The image API returned no usable image URLs.');
            return { jobId: `image-api-${Date.now()}`, targetId: options.id };
        },

        async getStatus(jobId: string): Promise<NormalizedJobStatus> {
            return { jobId, status: cachedOutputs.length > 0 ? 'completed' : 'failed', progress: cachedOutputs.length > 0 ? 100 : 0 };
        },

        async cancel(): Promise<void> {
            // The synchronous image API has no cancellation endpoint.
        },

        async getOutputs(): Promise<GenerationOutput[]> {
            return cachedOutputs;
        },
    };
}

export { normalizeNativeImageDimensions, parseModels, parseImageOutputs, parseNativeImageOutputs };
