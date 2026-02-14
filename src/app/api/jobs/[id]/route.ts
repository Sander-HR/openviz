import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, id));

    if (!job) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    return NextResponse.json(job);
}
