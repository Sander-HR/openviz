import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: "auto", // Most S3-compatible (R2, Supabase) use auto or specific region
    endpoint: process.env.S3_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
});

const BUCKET_NAME = process.env.S3_BUCKET!;

/**
 * Generates a pre-signed URL for uploading a file to S3.
 */
export async function getUploadUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Generates a pre-signed URL for viewing/downloading an object.
 */
export async function getDownloadUrl(key: string) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 }); // 24 hours
}

/**
 * Helper to construct the path for different asset types.
 */
export const s3Paths = {
    uploads: (userId: string, filename: string) => `uploads/${userId}/${filename}`,
    renders: (projectId: string, jobId: string, filename: string) => `renders/${projectId}/${jobId}/${filename}`,
    thumbnails: (projectId: string, filename: string) => `thumbnails/${projectId}/${filename}`,
};
