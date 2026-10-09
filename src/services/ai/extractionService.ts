/**
 * Feature 012 — T022 extraction service (FR-018, R2).
 *
 * Stage 1: a structured vision-chat call against the configured
 * OpenAI-compatible endpoint, requiring JSON that matches
 * contracts/extraction-output.schema.json. Stage 2 (color kind only):
 * deterministic pixel sampling refines each component's hex + confidence;
 * the vision read is kept as a label/sanity check. Analysis only — this
 * pipeline never generates pixels.
 */

import type { RenderTaskRequest } from '@/types/renderTask.types';
import { buildExtractionPrompt, type ExtractionKind, type ExtractionSampleBy } from './extractionPrompts';
import { analyzeRegionColors, loadPixelBufferFromDataUrl, type PixelBuffer } from './colorAnalysis';

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

/** Validated vision output (contracts/extraction-output.schema.json). */
export interface ExtractionOutput {
    kind: ExtractionKind;
    sampleBy: ExtractionSampleBy;
    confidence: number;
    components: Array<{
        name: string;
        role?: string;
        region: { x: number; y: number; w: number; h: number };
        color?: { label?: string; hex: string; confidence: number } | null;
        material?: {
            category?: string;
            finish?: string;
            texture?: string;
            roughnessImpression?: string;
            metallicAppearance?: boolean;
            reflectivity?: string;
            observations: string[];
            inferences: string[];
        } | null;
    }>;
}

export interface ExtractionRunnerOptions {
    endpoint: string;
    model: string;
    apiKey?: string;
    keyless?: boolean;
    fetcher?: Fetcher;
    /** Injectable for tests; defaults to the canvas-based browser loader. */
    loadPixels?: (source: string) => Promise<PixelBuffer>;
}

/** Boundary error: the vision model answered, but not with a valid record. */
export class ExtractionValidationError extends Error {}

function asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function validateRegion(value: unknown, componentName: string): ExtractionOutput['components'][number]['region'] {
    const region = asRecord(value);
    const { x, y, w, h } = region;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) {
        throw new ExtractionValidationError(`Component "${componentName}" has an invalid region box.`);
    }
    if (x < 0 || x > 1 || y < 0 || y > 1 || w <= 0 || w > 1 || h <= 0 || h > 1) {
        throw new ExtractionValidationError(`Component "${componentName}" has a region box outside the 0-1 image bounds.`);
    }
    return { x, y, w, h };
}

/** Typed narrowing of the vision answer; throws on any contract breach. */
export function validateExtractionOutput(value: unknown, kind: ExtractionKind, sampleBy: ExtractionSampleBy): ExtractionOutput {
    const record = asRecord(value);
    if (record.kind !== kind) {
        throw new ExtractionValidationError(`The vision model answered with kind "${String(record.kind)}" instead of "${kind}".`);
    }
    if (record.sampleBy !== sampleBy) {
        throw new ExtractionValidationError(`The vision model answered with sampleBy "${String(record.sampleBy)}" instead of "${sampleBy}".`);
    }
    if (!isFiniteNumber(record.confidence) || record.confidence < 0 || record.confidence > 1) {
        throw new ExtractionValidationError('The extraction answer is missing a valid overall confidence (0-1).');
    }
    if (!Array.isArray(record.components) || record.components.length === 0) {
        throw new ExtractionValidationError('The extraction answer contains no components; refusing to fabricate product parts.');
    }

    const components = record.components.map((entry) => {
        const component = asRecord(entry);
        const name = typeof component.name === 'string' && component.name.trim().length > 0 ? component.name : '';
        if (!name) throw new ExtractionValidationError('Every extraction component needs a non-empty name.');
        const result: ExtractionOutput['components'][number] = { name, region: validateRegion(component.region, name) };

        if (component.role !== undefined && typeof component.role !== 'string') {
            throw new ExtractionValidationError(`Component "${name}" has an invalid role.`);
        }
        if (typeof component.role === 'string' && component.role.length > 0) result.role = component.role;

        if (kind === 'color') {
            const color = asRecord(component.color);
            if (typeof color.hex !== 'string' || !HEX_PATTERN.test(color.hex)) {
                throw new ExtractionValidationError(`Component "${name}" is missing a valid "#rrggbb" hex value.`);
            }
            if (!isFiniteNumber(color.confidence) || color.confidence < 0 || color.confidence > 1) {
                throw new ExtractionValidationError(`Component "${name}" has an invalid color confidence.`);
            }
            result.color = {
                ...(typeof color.label === 'string' && color.label.length > 0 ? { label: color.label } : {}),
                hex: color.hex,
                confidence: color.confidence,
            };
        }

        if (kind === 'material') {
            const material = asRecord(component.material);
            if (!isStringArray(material.observations) || !isStringArray(material.inferences)) {
                throw new ExtractionValidationError(`Component "${name}" must separate observations from inferences.`);
            }
            result.material = {
                ...(typeof material.category === 'string' ? { category: material.category } : {}),
                ...(typeof material.finish === 'string' ? { finish: material.finish } : {}),
                ...(typeof material.texture === 'string' ? { texture: material.texture } : {}),
                ...(typeof material.roughnessImpression === 'string' ? { roughnessImpression: material.roughnessImpression } : {}),
                ...(typeof material.metallicAppearance === 'boolean' ? { metallicAppearance: material.metallicAppearance } : {}),
                ...(typeof material.reflectivity === 'string' ? { reflectivity: material.reflectivity } : {}),
                observations: material.observations,
                inferences: material.inferences,
            };
        }

        return result;
    });

    return { kind, sampleBy, confidence: record.confidence, components };
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
    if (typeof record.detail === 'string') return record.detail;
    if (typeof record.message === 'string') return record.message;
    return fallback;
}

/** Canvas decoding is browser-only; reject fast elsewhere so callers can fall back. */
function canvasAvailable(): boolean {
    try {
        return typeof document !== 'undefined' && Boolean(document.createElement('canvas').getContext('2d'));
    } catch {
        return false;
    }
}

const defaultLoadPixels = (source: string): Promise<PixelBuffer> =>
    canvasAvailable() ? loadPixelBufferFromDataUrl(source) : Promise.reject(new Error('Canvas 2D is unavailable for color analysis.'));

/** Deterministic hex refinement for color extractions (R2 stage 2). */
function refineColorHexes(output: ExtractionOutput, buffer: PixelBuffer): ExtractionOutput {
    return {
        ...output,
        components: output.components.map((component) => {
            if (!component.color) return component;
            const sampled = analyzeRegionColors(buffer, component.region);
            if (sampled.hex === null) return component;
            return { ...component, color: { ...component.color, hex: sampled.hex, confidence: sampled.confidence } };
        }),
    };
}

export function createExtractionRunner(options: ExtractionRunnerOptions) {
    const endpoint = options.endpoint.trim().replace(/\/$/, '');
    const fetcher = options.fetcher ?? fetch;
    const loadPixels = options.loadPixels ?? defaultLoadPixels;

    async function run(request: RenderTaskRequest, sourceImage: string): Promise<ExtractionOutput> {
        const kind = request.extractKind;
        const sampleBy = request.sampleBy;
        if (!kind || !sampleBy) throw new ExtractionValidationError('An extraction kind and sampling mode are required.');

        const prompt = buildExtractionPrompt(kind, sampleBy);
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (!options.keyless) {
            if (!options.apiKey?.trim()) throw new Error('An API key is required unless keyless API access is enabled.');
            headers.Authorization = `Bearer ${options.apiKey.trim()}`;
        }

        const response = await fetcher(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: options.model,
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: prompt.system },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt.user },
                            { type: 'image_url', image_url: { url: sourceImage } },
                        ],
                    },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`Extraction failed (${response.status}): ${errorMessage(await readJson(response), 'the vision endpoint rejected the request.')}`);
        }

        const body = asRecord(await readJson(response));
        const choice = Array.isArray(body.choices) ? asRecord(body.choices[0]) : {};
        const message = asRecord(choice.message);
        if (typeof message.content !== 'string' || message.content.trim().length === 0) {
            throw new ExtractionValidationError('The extraction answer was empty.');
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(message.content) as unknown;
        } catch {
            throw new ExtractionValidationError('The vision model did not return valid JSON for the extraction.');
        }

        const output = validateExtractionOutput(parsed, kind, sampleBy);
        if (kind !== 'color') return output;

        try {
            const buffer = await loadPixels(sourceImage);
            return refineColorHexes(output, buffer);
        } catch {
            // Pixel decoding is unavailable (e.g. exotic image format): the
            // vision hexes stand in, flagged by their own confidence.
            return output;
        }
    }

    return { run };
}
