import { auth } from '@/lib/auth';
import { buildAssetUrl } from '@/lib/services/assetUrl';
import { getAssetBuffer, IMMUTABLE_CACHE_CONTROL, isS3Configured, previewKeyFor, putAsset, thumbnailKeyFor } from '@/lib/services/s3';
import { generateVariant, PREVIEW_MAX_DIM, THUMBNAIL_MAX_DIM } from '@/lib/services/thumbnail';
import { NextResponse } from 'next/server';

type AssetVariant = 'thumb' | 'preview';

const VARIANT_BUDGET: Record<AssetVariant, number> = {
    thumb: THUMBNAIL_MAX_DIM,
    preview: PREVIEW_MAX_DIM,
};

/**
 * POST /api/assets/thumbnail  { key: string, variant?: 'thumb' | 'preview' }
 *
 * Generates a WebP variant of an uploaded asset (3-tier pipeline):
 * - `thumb`   (default): ≤512px — dashboard cards / workbench first paint
 * - `preview`       : ≤1024px — background-loaded higher quality tier
 *
 * The client calls this right after its direct S3 PUT completes. The route is
 * deliberately forgiving: any failure (non-image, undecodable bytes, S3 hiccups,
 * image already at or below the budget) yields `{ url: null }` so uploads never
 * break over a missing variant.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isS3Configured()) {
        return NextResponse.json({ url: null, reason: 'asset-store-unavailable' });
    }

    let body: { key?: string; variant?: string };
    try {
        body = (await req.json()) as { key?: string; variant?: string };
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const rawVariant = body.variant;
    if (rawVariant !== undefined && rawVariant !== 'thumb' && rawVariant !== 'preview') {
        return NextResponse.json({ error: `Unknown variant: ${String(rawVariant)}` }, { status: 400 });
    }
    const variant: AssetVariant = rawVariant ?? 'thumb';

    const key = body.key;
    if (!key || !/^(uploads|renders)\//u.test(key)) {
        return NextResponse.json({ url: null, reason: 'unsupported-key' });
    }
    // Only the owning user's uploads may be processed (keys embed the user id).
    if (key.startsWith('uploads/') && !key.startsWith(`uploads/${session.user.id}/`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const variantKey = variant === 'thumb' ? thumbnailKeyFor(key) : previewKeyFor(key);
    if (!variantKey) return NextResponse.json({ url: null, reason: 'unsupported-key' });

    try {
        const source = await getAssetBuffer(key);
        const contentType = guessContentType(key);
        const image = await generateVariant(source, contentType, VARIANT_BUDGET[variant]);
        if (!image) {
            return NextResponse.json({ url: null, reason: 'not-a-variantable-image' });
        }

        await putAsset(variantKey, image.buffer, image.contentType, IMMUTABLE_CACHE_CONTROL);
        return NextResponse.json({ url: buildAssetUrl(variantKey) });
    } catch {
        // Never fail the upload over a missing variant.
        return NextResponse.json({ url: null, reason: 'generation-failed' });
    }
}

function guessContentType(key: string): string {
    const ext = key.toLowerCase().slice(key.lastIndexOf('.') + 1);
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        case 'avif':
            return 'image/avif';
        default:
            return 'application/octet-stream';
    }
}
