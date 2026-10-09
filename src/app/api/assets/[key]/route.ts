import { auth } from '@/lib/auth';
import { getDownloadUrl, isS3Configured } from '@/lib/services/s3';
import { decodeAssetKey } from '@/lib/services/assetUrl';
import { NextResponse } from 'next/server';

/**
 * GET /api/assets/<token>
 *
 * Resolve-on-read asset endpoint. Node state stores the app-relative URL
 * `/api/assets/<token>` (see {@link buildAssetUrl}); this route decodes the
 * token back to an S3 key and redirects to a freshly minted presigned GET.
 * Minting per-request means the 24h presign expiry never has to be persisted,
 * so stored references stay small and always valid.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isS3Configured()) {
        // S3/R2 not configured (local mock mode). There is no object to resolve;
        // writes fall back to inline base64 in this mode, so a stored reference
        // here indicates a misconfiguration.
        return NextResponse.json({ error: 'Asset storage unavailable' }, { status: 503 });
    }

    const { key: token } = await params;
    const s3Key = decodeAssetKey(token);
    if (!s3Key) return NextResponse.json({ error: 'Invalid asset reference' }, { status: 400 });

    let downloadUrl: string;
    try {
        downloadUrl = await getDownloadUrl(s3Key);
    } catch {
        return NextResponse.json({ error: 'Failed to resolve asset' }, { status: 502 });
    }

    // Redirect (not proxy) so the browser fetches bytes straight from S3/R2.
    // Cache the redirect itself per-user for an hour: the presigned target is
    // valid 24h and uploaded objects carry immutable cache headers, so repeat
    // loads skip the auth + presign-mint round-trip. `private` keeps it out of
    // shared caches (the credential is user-scoped).
    return new Response(null, {
        status: 307,
        headers: { Location: downloadUrl, 'Cache-Control': 'private, max-age=3600' },
    });
}
