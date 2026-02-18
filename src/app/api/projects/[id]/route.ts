import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, scenes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id));

    if (!project) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    // Fetch the main scene for this project
    const [scene] = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, id))
        .limit(1);

    // Update lastViewedAt when project is accessed
    await db
        .update(projects)
        .set({ lastViewedAt: new Date() })
        .where(eq(projects.id, id));

    // Add permission check here in a real app

    return NextResponse.json({
        ...project,
        lastViewedAt: new Date(),
        scene: scene ? scene.data : null,
    });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // In a real app, verify project ownership/workspace membership here

    const [updated] = await db
        .update(projects)
        .set({
            ...body,
            updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

    if (!updated) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // In a real app, verify project ownership/permissions here

    const [deleted] = await db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();

    if (!deleted) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    return NextResponse.json(deleted);
}
