import { auth } from "@/lib/auth";
import { addRenderJob } from "@/lib/services/jobs";
import { db } from "@/lib/auth";
import { jobs } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { projectId, prompt, initImageKey, type = 'render', options } = body;

    if (!projectId || !prompt || !initImageKey) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create job status in DB
    const [job] = await db.insert(jobs).values({
        projectId,
        type,
        status: 'pending',
    }).returning();

    // 2. Add to BullMQ
    await addRenderJob(projectId, {
        jobId: job.id,
        prompt,
        initImageKey,
        options,
    });

    return NextResponse.json({ jobId: job.id });
}
