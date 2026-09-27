type Fetcher = typeof fetch;

export type EndpointProbeOutcome = 'supported' | 'unavailable' | 'unauthorized' | 'network' | 'malformed';

export interface EndpointCapabilityProbe {
    /** Whether /openapi.json could be read and parsed. */
    schemaAvailable: boolean;
    outcome: EndpointProbeOutcome;
    /** Optional progress telemetry (e.g. Unsloth generate-progress). */
    progressTelemetry: boolean;
    /** Optional model load progress endpoint. */
    loadProgress: boolean;
    /** Optional generation cancellation endpoint. */
    cancellation: boolean;
}

export interface EndpointProbeOptions {
    apiKey?: string;
    keyless?: boolean;
    fetcher?: Fetcher;
}

const PROBE_TIMEOUT_MS = 5000;

/**
 * Derive the schema root for an OpenAPI document. Endpoints configured as
 * `.../v1` expose their schema at the server root (`.../openapi.json`), while
 * bare roots keep the conventional `.../openapi.json` path.
 */
export function resolveOpenApiUrl(endpoint: string): string {
    const trimmed = endpoint.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    const withoutV1 = trimmed.replace(/\/v\d+$/i, '');
    return `${withoutV1 || trimmed}/openapi.json`;
}

function isPathPresent(paths: Record<string, unknown>, method: string, pattern: RegExp): boolean {
    return Object.entries(paths).some(([path, item]) => {
        if (!pattern.test(path)) return false;
        const operations = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
        return typeof operations[method] === 'object' && operations[method] !== null;
    });
}

/**
 * Best-effort OpenAPI discovery for an OpenAI-compatible image endpoint.
 * The probe is strictly optional: a missing, unauthorized, or malformed
 * schema must never make a working endpoint look broken.
 */
export async function probeEndpointCapabilities(
    endpoint: string,
    options: EndpointProbeOptions = {},
): Promise<EndpointCapabilityProbe> {
    const fetcher = options.fetcher ?? fetch;
    const url = resolveOpenApiUrl(endpoint);
    if (!url) return { schemaAvailable: false, outcome: 'unavailable', progressTelemetry: false, loadProgress: false, cancellation: false };

    let response: Response;
    try {
        response = await fetcher(url, {
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            headers: options.keyless || !options.apiKey ? undefined : { Authorization: `Bearer ${options.apiKey}` },
        });
    } catch {
        // CORS block or network failure — the endpoint may still work.
        return { schemaAvailable: false, outcome: 'network', progressTelemetry: false, loadProgress: false, cancellation: false };
    }

    if (response.status === 401 || response.status === 403) {
        return { schemaAvailable: false, outcome: 'unauthorized', progressTelemetry: false, loadProgress: false, cancellation: false };
    }
    if (!response.ok) {
        return { schemaAvailable: false, outcome: 'unavailable', progressTelemetry: false, loadProgress: false, cancellation: false };
    }

    let schema: unknown;
    try {
        schema = await response.json();
    } catch {
        return { schemaAvailable: false, outcome: 'malformed', progressTelemetry: false, loadProgress: false, cancellation: false };
    }

    const root = (typeof schema === 'object' && schema !== null ? schema : {}) as Record<string, unknown>;
    const paths = (typeof root.paths === 'object' && root.paths !== null ? root.paths : {}) as Record<string, unknown>;
    if (Object.keys(paths).length === 0) {
        return { schemaAvailable: false, outcome: 'malformed', progressTelemetry: false, loadProgress: false, cancellation: false };
    }

    return {
        schemaAvailable: true,
        outcome: 'supported',
        progressTelemetry: isPathPresent(paths, 'get', /generate-progress|progress/i),
        loadProgress: isPathPresent(paths, 'get', /load-progress/i),
        cancellation: isPathPresent(paths, 'post', /cancel/i),
    };
}
