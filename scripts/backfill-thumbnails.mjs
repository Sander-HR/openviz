/**
 * Backfill WebP thumbnails for existing S3 assets (Sprint 3).
 *
 * Usage:
 *   node scripts/backfill-thumbnails.mjs            # dry-run: list what would be generated
 *   node scripts/backfill-thumbnails.mjs --apply    # actually generate + upload
 *
 * Idempotent: an asset whose thumbnail object already exists is skipped, so the
 * script can safely re-run (and scale to <~1k images in a single pass). Reads
 * S3_* from .env — no other config needed.
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";

const APPLY = process.argv.includes("--apply");
const THUMBNAIL_MAX_DIM = 512;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function loadEnv() {
    const env = Object.fromEntries(
        readFileSync(new URL("../.env", import.meta.url), "utf8")
            .split("\n")
            .filter((l) => l.includes("=") && !l.startsWith("#"))
            .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    );
    for (const key of ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET"]) {
        if (!env[key]) throw new Error(`Missing ${key} in .env`);
    }
    return env;
}

const env = loadEnv();

const s3 = new S3Client({
    region: env.S3_REGION || "auto",
    endpoint: env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
});
const BUCKET = env.S3_BUCKET;

function thumbnailKeyFor(uploadKey) {
    const match = /^(uploads|renders)\/(.+)$/u.exec(uploadKey);
    if (!match) return null;
    const rest = match[2];
    const dot = rest.lastIndexOf(".");
    if (dot === -1) return null;
    return `thumbnails/${rest.slice(0, dot)}.webp`;
}

function contentTypeFor(key) {
    const ext = key.toLowerCase().slice(key.lastIndexOf(".") + 1);
    const map = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif" };
    return map[ext] ?? "application/octet-stream";
}

async function objectExists(key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return true;
    } catch (err) {
        if (err.$metadata?.httpStatusCode === 404 || err.name === "NotFound") return false;
        throw err;
    }
}

async function* listImageAssets() {
    let continuationToken;
    do {
        const page = await s3.send(
            new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "", ContinuationToken: continuationToken })
        );
        for (const obj of page.Contents ?? []) {
            if (!/^(uploads|renders)\//u.test(obj.Key)) continue;
            const ext = obj.Key.toLowerCase().slice(obj.Key.lastIndexOf("."));
            if (IMAGE_EXTENSIONS.has(ext) && !obj.Key.startsWith("thumbnails/")) yield obj.Key;
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
}

let seen = 0;
let generated = 0;
let skippedSmall = 0;
let skippedExisting = 0;
let failed = 0;

for await (const key of listImageAssets()) {
    seen++;
    const thumbKey = thumbnailKeyFor(key);
    if (!thumbKey) continue;

    if (await objectExists(thumbKey)) {
        skippedExisting++;
        continue;
    }

    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const chunks = [];
    for await (const chunk of response.Body) chunks.push(chunk);
    const source = Buffer.concat(chunks);

    let pipeline;
    try {
        pipeline = sharp(source);
        const meta = await pipeline.metadata();
        pipeline = sharp(source);
        if (Math.max(meta.width ?? 0, meta.height ?? 0) <= THUMBNAIL_MAX_DIM) {
            skippedSmall++;
            continue; // already small — the original is the cheapest representation
        }
        const buffer = await pipeline
            .resize({ width: THUMBNAIL_MAX_DIM, height: THUMBNAIL_MAX_DIM, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();

        if (APPLY) {
            await s3.send(
                new PutObjectCommand({
                    Bucket: BUCKET,
                    Key: thumbKey,
                    Body: buffer,
                    ContentType: "image/webp",
                    CacheControl: IMMUTABLE_CACHE_CONTROL,
                })
            );
        }
        generated++;
        console.log(`${APPLY ? "generated" : "would generate"} ${thumbKey} (${(buffer.byteLength / 1024).toFixed(0)}KB) <- ${key}`);
    } catch {
        failed++;
        console.warn(`failed (undecodable?) ${key}`);
    }
}

console.log(
    `\n[backfill-thumbnails] mode=${APPLY ? "apply" : "dry-run"} seen=${seen} generated=${generated} ` +
        `skippedExisting=${skippedExisting} skippedSmall=${skippedSmall} failed=${failed}`
);
