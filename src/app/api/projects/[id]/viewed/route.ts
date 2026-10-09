import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, workspaceMemberships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Explicit "I opened this project" signal. Kept out of GET /api/projects/:id
 * so that read responses stay cacheable (ETag/304 + short private cache).
 * The client fires this off after a successful load; the dashboard's
 * "Last viewed" sort reads lastViewedAt from the project list endpoint.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));

    if (!project) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    const membership = await db
        .select()
        .from(workspaceMemberships)
        .where(
            and(
                eq(workspaceMemberships.workspaceId, project.workspaceId),
                eq(workspaceMemberships.userId, session.user.id)
            )
        )
        .limit(1);

    if (membership.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await db
        .update(projects)
        .set({ lastViewedAt: new Date() })
        .where(eq(projects.id, id));

    return NextResponse.json({ ok: true });
}
