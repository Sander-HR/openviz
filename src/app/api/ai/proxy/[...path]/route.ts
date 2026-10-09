import { auth } from '@/lib/auth';
import { createDatabaseAISettingsRepository } from '@/services/ai/databaseAISettingsRepository';
import { endpointRoot } from '@/services/ai/targets/openAIImagePayload';
import { NextResponse } from 'next/server';

/**
 * Authenticated relay for OpenAI-compatible image/video endpoints.
 *
 * The browser never holds the API key: it calls /api/ai/proxy/<path>, and this
 * route forwards the request to the user's configured endpoint, injecting the
 * stored (encrypted at rest) key server-side. This makes credentials work on
 * every device a user signs in from and keeps the secret out of client code.
 *
 * The upstream host is always the configured imageApiEndpoint — callers can
 * only control the path, so this route can never be used as an open relay or
 * to leak the key to another host.
 *
 * Proxy paths are relative to the endpoint's HOST root (the trailing /vN
 * version prefix is stripped before joining), so both the OpenAI-compatible
 * API (`/v1/...`) and host-root-level native routes (`/api/inference/...`)
 * can be reached.
 */

// Hop-by-hop headers plus anything that must not be forwarded verbatim.
// `authorization` is replaced with the stored key; `accept-encoding` and
// `content-length` are recomputed by the fetch stack (the upstream response is
// decompressed before being streamed back).
const BLOCKED_REQUEST_HEADERS = new Set([
    'accept-encoding',
    'authorization',
    'connection',
    'content-length',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'host',
]);

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: Context): Promise<Response> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const repository = createDatabaseAISettingsRepository(session.user.id);
    const settings = await repository.get();
    const root = (settings?.imageApiEndpoint ?? '').trim().replace(/\/+$/, '');
    if (!root) return NextResponse.json({ error: 'No image API endpoint configured.' }, { status: 400 });

    const { path } = await context.params;
    const search = new URL(request.url).search;
    // Join against the host root so paths like /v1/models keep their version
    // prefix while native routes like /api/inference/... stay at the root.
    const targetUrl = `${endpointRoot(root)}/${path.join('/')}${search}`;

    const headers = new Headers();
    request.headers.forEach((value, key) => {
        if (!BLOCKED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
    });
    if (!(settings?.imageApiKeyless ?? false)) {
        const secret = await repository.getSecret();
        if (secret) headers.set('Authorization', `Bearer ${secret}`);
    }

    const method = request.method.toUpperCase();
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const upstream = await fetch(targetUrl, {
        method,
        headers,
        ...(hasBody ? { body: request.body, duplex: 'half' as const } : {}),
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export async function GET(request: Request, context: Context) {
    return forward(request, context);
}

export async function POST(request: Request, context: Context) {
    return forward(request, context);
}

export async function PUT(request: Request, context: Context) {
    return forward(request, context);
}

export async function DELETE(request: Request, context: Context) {
    return forward(request, context);
}
