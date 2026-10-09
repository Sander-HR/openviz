import * as dotenv from 'dotenv';
dotenv.config();

import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { putAsset, isS3Configured } from '../src/lib/services/s3';
import { buildAssetUrl } from '../src/lib/services/assetUrl';

/**
 * Migrate inline base64 image/video blobs stored in `scenes.data` to S3-backed
 * asset references (`/api/assets/<token>`), so scene payloads stay small.
 *
 * Safe by design:
 *   - DRY-RUN by default. Pass `--apply` to actually upload + rewrite rows.
 *   - Idempotent: each unique blob is keyed by its content SHA-1, so re-runs and
 *     the image+thumbnail duplication collapse to a single stored object.
 *   - Skips anything that is not a base64 data URL (URLs are left untouched).
 *
 * Usage:
 *   pnpm exec tsx scripts/migrate-scene-assets.ts            # dry run
 *   pnpm exec tsx scripts/migrate-scene-assets.ts --apply    # apply changes
 */

const APPLY = process.argv.includes('--apply');

interface SceneRow {
    id: string;
    project_id: string;
    data: unknown;
    version: number;
}

function isDataUrl(value: unknown): value is string {
    return typeof value === 'string' && /^data:[a-z0-9/+.-]+;base64,/.test(value);
}

function parseDataUrl(value: string): { contentType: string; payload: string } | null {
    const match = value.match(/^data:([a-z0-9/+.-]+);base64,(.+)$/s);
    if (!match) return null;
    return { contentType: match[1], payload: match[2] };
}

function extFor(contentType: string): string {
    switch (contentType) {
        case 'image/png': return 'png';
        case 'image/jpeg': return 'jpg';
        case 'image/webp': return 'webp';
        case 'image/gif': return 'gif';
        case 'video/mp4': return 'mp4';
        default: return 'bin';
    }
}

/** Recursively replace base64 data URLs in a JSON tree, tracking uploads. */
function rewriteTree(
    node: unknown,
    projectId: string,
    uploaded: Map<string, { key: string; url: string; bytes: number }>,
    stats: { replaced: number; skipped: number },
): unknown {
    if (Array.isArray(node)) return node.map((item) => rewriteTree(item, projectId, uploaded, stats));

    if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            out[k] = rewriteTree(v, projectId, uploaded, stats);
        }
        return out;
    }

    if (isDataUrl(node)) {
        const parsed = parseDataUrl(node);
        if (!parsed) {
            stats.skipped += 1;
            return node;
        }
        const hash = createHash('sha1').update(parsed.payload).digest('hex');
        const existing = uploaded.get(hash);
        if (existing) {
            stats.replaced += 1;
            return existing.url;
        }

        const bytes = Buffer.from(parsed.payload, 'base64');
        const key = `renders/${projectId}/migrated-${hash}.${extFor(parsed.contentType)}`;
        // Upload is deferred until the apply phase (see main), but we record the
        // mapping now so identical blobs dedupe within and across scenes.
        uploaded.set(hash, { key, url: buildAssetUrl(key), bytes: bytes.length });
        stats.replaced += 1;
        return buildAssetUrl(key);
    }

    return node;
}

async function main() {
    if (!isS3Configured()) {
        console.error('S3/R2 is not configured (missing S3_* env vars). Nothing to do.');
        process.exit(1);
    }

    const connectionString = process.env.DATABASE_URL!;
    if (!connectionString) {
        console.error('DATABASE_URL is not set.');
        process.exit(1);
    }

    const client = postgres(connectionString);
    const rows = (await client.unsafe<SceneRow[]>(
        'SELECT id, project_id, data, version FROM scenes WHERE is_main = true',
    )) as SceneRow[];

    console.log(`Scanning ${rows.length} main scene(s) ...`);

    const uploaded = new Map<string, { key: string; url: string; bytes: number }>();
    const updates: Array<{ id: string; data: unknown; version: number }> = [];
    let totalReplaced = 0;
    let totalSkipped = 0;

    for (const row of rows) {
        const stats = { replaced: 0, skipped: 0 };
        const newData = rewriteTree(row.data, row.project_id, uploaded, stats);
        if (stats.replaced > 0) {
            updates.push({ id: row.id, data: newData, version: row.version + 1 });
            totalReplaced += stats.replaced;
            totalSkipped += stats.skipped;
        }
    }

    const uniqueObjects = uploaded.size;
    const totalBytes = [...uploaded.values()].reduce((sum, o) => sum + o.bytes, 0);

    console.log('\n--- Summary ---');
    console.log(`Scenes with base64 blobs: ${updates.length}`);
    console.log(`Base64 fields to rewrite : ${totalReplaced}`);
    if (totalSkipped > 0) console.log(`Unparseable data URLs   : ${totalSkipped} (left untouched)`);
    console.log(`Unique objects to upload: ${uniqueObjects} (~${(totalBytes / 1024).toFixed(1)} KB)`);

    if (!APPLY) {
        console.log('\nDry run — no changes written. Re-run with --apply to execute.');
        await client.end();
        return;
    }

    // Upload each unique object once. Re-derive the raw base64 payload per hash
    // by scanning rows again (cheap) so we can hand bytes to putAsset.
    const payloads = new Map<string, { payload: string; contentType: string }>();
    for (const row of rows) {
        collectDataUrls(row.data, (contentType, payload) => {
            const hash = createHash('sha1').update(payload).digest('hex');
            if (!payloads.has(hash)) payloads.set(hash, { payload, contentType });
        });
    }

    for (const [hash, obj] of uploaded.entries()) {
        const src = payloads.get(hash);
        if (!src) continue;
        const bytes = Buffer.from(src.payload, 'base64');
        await putAsset(obj.key, bytes, src.contentType);
        console.log(`Uploaded ${obj.key} (${bytes.length} bytes)`);
    }

    for (const u of updates) {
        await client.unsafe(
            'UPDATE scenes SET data = $1::jsonb, version = $2, updated_at = now() WHERE id = $3',
            [JSON.stringify(u.data), u.version, u.id],
        );
        console.log(`Rewrote scene ${u.id} (version -> ${u.version})`);
    }

    console.log('\nDone.');
    await client.end();
}

/** Visit every base64 data URL string in a JSON tree, invoking the callback. */
function collectDataUrls(node: unknown, visit: (contentType: string, payload: string) => void): void {
    if (Array.isArray(node)) {
        for (const item of node) collectDataUrls(item, visit);
        return;
    }
    if (node && typeof node === 'object') {
        for (const v of Object.values(node as Record<string, unknown>)) collectDataUrls(v, visit);
        return;
    }
    if (isDataUrl(node)) {
        const parsed = parseDataUrl(node);
        if (parsed) visit(parsed.contentType, parsed.payload);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
