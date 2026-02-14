import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects } from "@/lib/db/schema";
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

    // Add permission check here in a real app

    return NextResponse.json(project);
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
