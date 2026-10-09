import { expect, vi } from 'vitest';

/**
 * Test-only helper: mocks the global asset pipeline (presign → S3 PUT →
 * variants) used by the refs-only re-host paths (`uploadBlobToAsset`). The
 * target-level `fetcher` mock covers endpoint traffic; this spy covers the
 * storage round-trip that always uses global fetch. Tests that need a specific
 * behavior can override the returned spy afterwards.
 */
export function mockAssetPipeline(): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith('data:image/')) {
            return new Response(new Blob(['image-bytes'], { type: 'image/png' }), { status: 200 });
        }
        if (url === '/api/assets/upload-url') {
            return new Response(
                JSON.stringify({ uploadUrl: 'http://s3.local/uploads/r/render.png', key: 'uploads/r/render.png' }),
                { status: 200 },
            );
        }
        if (url.startsWith('http://s3.local/')) {
            expect(init?.method).toBe('PUT');
            return new Response(null, { status: 200 });
        }
        if (url.startsWith('/api/assets/thumbnail')) {
            return new Response(JSON.stringify({ url: null }), { status: 200 });
        }
        throw new Error(`unexpected fetch in asset pipeline mock: ${url}`);
    });
}
