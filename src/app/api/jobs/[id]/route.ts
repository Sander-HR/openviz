import { auth, db } from "@/lib/auth";
import { jobs } from "@/lib/db/schema";
import {
    isGenerationJob,
    toDatabaseJobValues,
    type DatabaseGenerationJobValues,
} from "@/services/ai/generationJobPersistence";
import type { GenerationJob } from "@/types/generationJob.types";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function getJobFromBody(value: unknown): GenerationJob | null {
    const body = asRecord(value);
    const job = body?.job;
    return isGenerationJob(job) ? job : null;
}

function toDatabaseValues(job: GenerationJob): DatabaseGenerationJobValues {
    return toDatabaseJobValues(job);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!job) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const metadata = job.metadata;
    if (isGenerationJob(metadata)) return NextResponse.json(metadata);
    return NextResponse.json(job);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const job = getJobFromBody(await req.json() as unknown);
    if (!job || !job.projectId) {
        return NextResponse.json({ error: "A valid project-owned generation job is required." }, { status: 400 });
    }

    const values = toDatabaseValues(job);
    await db.insert(jobs).values(values).onConflictDoUpdate({
        target: jobs.id,
        set: {
            status: values.status,
            progress: values.progress,
            resultUrl: values.resultUrl,
            error: values.error,
            retryOf: values.retryOf,
            metadata: values.metadata,
            updatedAt: new Date(),
        },
    });
    return NextResponse.json({ jobId: job.id, job }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const job = getJobFromBody(await req.json() as unknown);
    if (!job || job.id !== id || !job.projectId) {
        return NextResponse.json({ error: "A matching generation job is required." }, { status: 400 });
    }

    const values = toDatabaseValues(job);
    const updated = await db.update(jobs).set({
        status: values.status,
        progress: values.progress,
        resultUrl: values.resultUrl,
        error: values.error,
        retryOf: values.retryOf,
        metadata: values.metadata,
        updatedAt: new Date(),
    }).where(eq(jobs.id, id)).returning({ id: jobs.id });
    if (updated.length === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    return NextResponse.json({ job });
}
