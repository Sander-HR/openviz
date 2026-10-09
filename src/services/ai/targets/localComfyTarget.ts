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
import { getProductWorkflow } from '../productWorkflowRegistry';
import { runDependencyPreflight } from '../dependencyPreflight';
import { buildProductPrompt } from '../workflowValidation';
import { normalizeComfyCapabilities } from './comfyCapabilitiesService';

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

interface LocalComfyTargetOptions {
    id: string;
    endpoint: string;
    fetcher?: Fetcher;
    clientId?: string;
    headers?: HeadersInit;
}

function asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

async function readJson(response: Response): Promise<unknown> {
    const value: unknown = await response.json();
    return value;
}

function normalizeEndpoint(endpoint: string): string {
    return endpoint.replace(/\/$/, '');
}

export function createLocalComfyTarget(options: LocalComfyTargetOptions): ExecutionTargetAdapter {
    const endpoint = normalizeEndpoint(options.endpoint);
    const fetcher = options.fetcher ?? fetch;
    const clientId = options.clientId ?? 'openviz-product-design';
    let cachedCapabilities: TargetCapabilities | null = null;

    function sendRequest(path: string, init?: RequestInit): Promise<Response> {
        return fetcher(`${endpoint}${path}`, {
            ...init,
            headers: { ...options.headers, ...(init?.headers ?? {}) },
        });
    }

    async function capabilities(): Promise<TargetCapabilities> {
        const [statsResponse, objectInfoResponse] = await Promise.all([
            sendRequest('/system_stats'),
            sendRequest('/object_info'),
        ]);
        if (!statsResponse.ok || !objectInfoResponse.ok) {
            throw new Error(`ComfyUI capability check failed (${statsResponse.status}/${objectInfoResponse.status}).`);
        }
        cachedCapabilities = normalizeComfyCapabilities(
            await readJson(statsResponse),
            await readJson(objectInfoResponse),
        );
        return cachedCapabilities;
    }

    return {
        async health(): Promise<TargetHealth> {
            try {
                const currentCapabilities = await capabilities();
                return {
                    targetId: options.id,
                    status: 'ready',
                    capabilities: currentCapabilities,
                };
            } catch (error) {
                return {
                    targetId: options.id,
                    status: 'unavailable',
                    message: error instanceof Error ? error.message : 'ComfyUI is unavailable.',
                    capabilities: cachedCapabilities,
                };
            }
        },

        async capabilities(): Promise<TargetCapabilities> {
            return capabilities();
        },

        async preflight(request: ProductWorkflowRequest): Promise<PreflightResult> {
            const currentCapabilities = await capabilities();
            return runDependencyPreflight(request.workflowId, currentCapabilities);
        },

        async submit(request: ProductWorkflowRequest): Promise<SubmittedJob> {
            const workflow = getProductWorkflow(request.workflowId);
            if (!workflow) throw new Error(`Unknown product workflow: ${request.workflowId}`);

            const builtPrompt = buildProductPrompt({ ...request, seed: request.seed ?? Math.floor(Math.random() * 1_000_000_000_000) });
            const response = await sendRequest('/prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: builtPrompt.prompt,
                    client_id: clientId,
                }),
            });
            const body = asRecord(await readJson(response));
            if (!response.ok || typeof body.prompt_id !== 'string') {
                throw new Error(typeof body.error === 'string' ? body.error : 'ComfyUI rejected the workflow.');
            }
            return { jobId: body.prompt_id, targetId: options.id };
        },

        async getStatus(jobId: string): Promise<NormalizedJobStatus> {
            const response = await sendRequest(`/history/${encodeURIComponent(jobId)}`);
            if (!response.ok) throw new Error('Unable to read ComfyUI job history.');
            const history = asRecord(await readJson(response));
            const record = asRecord(history[jobId]);
            const status = asRecord(record.status);
            const statusString = status.status_str;
            if (statusString === 'success') return { jobId, status: 'completed', progress: 100 };
            if (statusString === 'error' || statusString === 'failed') {
                return { jobId, status: 'failed', progress: 100, message: 'ComfyUI reported a failed job.' };
            }
            return { jobId, status: 'running', progress: 0 };
        },

        async cancel(jobId: string): Promise<void> {
            const response = await sendRequest('/interrupt', { method: 'POST' });
            if (!response.ok) throw new Error(`Unable to cancel ComfyUI job ${jobId}.`);
        },

        async getOutputs(jobId: string): Promise<GenerationOutput[]> {
            const response = await sendRequest(`/history/${encodeURIComponent(jobId)}`);
            if (!response.ok) throw new Error('Unable to read ComfyUI outputs.');
            const history = asRecord(await readJson(response));
            const record = asRecord(history[jobId]);
            const outputs = asRecord(record.outputs);
            const result: GenerationOutput[] = [];
            Object.values(outputs).forEach((output) => {
                const outputRecord = asRecord(output);
                const files = [
                    ...(Array.isArray(outputRecord.images) ? outputRecord.images : []),
                    ...(Array.isArray(outputRecord.videos) ? outputRecord.videos : []),
                    ...(Array.isArray(outputRecord.gifs) ? outputRecord.gifs : []),
                ];
                files.forEach((file, index) => {
                    const fileRecord = asRecord(file);
                    if (typeof fileRecord.filename === 'string') {
                        const params = new URLSearchParams({
                            filename: fileRecord.filename,
                            subfolder: typeof fileRecord.subfolder === 'string' ? fileRecord.subfolder : '',
                            type: typeof fileRecord.type === 'string' ? fileRecord.type : 'output',
                        });
                        const contentType = Array.isArray(outputRecord.videos) || Array.isArray(outputRecord.gifs)
                            ? 'video/mp4'
                            : 'image/png';
                        result.push({ url: `${endpoint}/view?${params.toString()}`, index, contentType });
                    }
                });
            });
            return result;
        },
    };
}
