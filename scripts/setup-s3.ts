import { readFile } from "node:fs/promises";
import path from "node:path";

import { S3Client, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

import { parseEnvContent } from "./setupUtils.ts";

/**
 * Idempotently ensures the local asset bucket exists in the configured
 * S3/R2/MinIO backend. Safe to run repeatedly: it only creates the bucket when
 * it is missing. Reads credentials from the environment, falling back to the
 * repo's `.env` file so it can be run standalone (`pnpm setup:s3`).
 */

const ROOT = process.cwd();

async function loadEnv(): Promise<Record<string, string>> {
    // Prefer already-exported values (dev.sh / shell), then merge in .env for
    // anything still missing. Never override a value that is already set.
    const fromDotEnv: Record<string, string> = {};
    try {
        const content = await readFile(path.join(ROOT, ".env"), "utf-8");
        Object.assign(fromDotEnv, parseEnvContent(content));
    } catch {
        // No .env file — rely purely on the process environment.
    }

    const resolve = (key: string): string | undefined => {
        if (process.env[key] && process.env[key].length > 0) return process.env[key];
        return fromDotEnv[key];
    };

    return {
        S3_ENDPOINT: resolve("S3_ENDPOINT") ?? "",
        S3_ACCESS_KEY_ID: resolve("S3_ACCESS_KEY_ID") ?? "",
        S3_SECRET_ACCESS_KEY: resolve("S3_SECRET_ACCESS_KEY") ?? "",
        S3_BUCKET: resolve("S3_BUCKET") ?? "",
        S3_REGION: resolve("S3_REGION") ?? "auto",
    };
}

async function main(): Promise<void> {
    const env = await loadEnv();

    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
        console.error("[setup-s3] Missing S3 configuration.");
        console.error(`[setup-s3]   S3_ENDPOINT=${env.S3_ENDPOINT || "<unset>"}`);
        console.error(`[setup-s3]   S3_ACCESS_KEY_ID=${env.S3_ACCESS_KEY_ID ? "<set>" : "<unset>"}`);
        console.error(`[setup-s3]   S3_SECRET_ACCESS_KEY=${env.S3_SECRET_ACCESS_KEY ? "<set>" : "<unset>"}`);
        console.error(`[setup-s3]   S3_BUCKET=${env.S3_BUCKET || "<unset>"}`);
        console.error("[setup-s3] Set these in .env (see .env.example) and retry.");
        process.exitCode = 1;
        return;
    }

    const client = new S3Client({
        region: env.S3_REGION || "auto",
        endpoint: env.S3_ENDPOINT,
        credentials: {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
        // Match src/lib/services/s3.ts: SeaweedFS requires path-style
        // addressing and rejects the default presigned-checksum header.
        forcePathStyle: true,
        requestChecksumCalculation: "WHEN_REQUIRED",
    });

    const bucket = env.S3_BUCKET;

    try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        console.log(`[setup-s3] Bucket "${bucket}" already exists at ${env.S3_ENDPOINT}. Nothing to do.`);
        return;
    } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) {
            console.log(`[setup-s3] Bucket "${bucket}" not found — creating it.`);
            await client.send(new CreateBucketCommand({ Bucket: bucket }));
            console.log(`[setup-s3] Created bucket "${bucket}".`);
            return;
        }
        throw error;
    }
}

main().catch((error) => {
    console.error("[setup-s3] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
