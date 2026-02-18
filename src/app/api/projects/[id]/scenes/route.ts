import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { scenes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId));

    return NextResponse.json(projectScenes);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name = "Main", data, isMain = true } = body;

    // Check if a main scene already exists for this project
    if (isMain) {
        const [existingMain] = await db
            .select()
            .from(scenes)
            .where(and(eq(scenes.projectId, projectId), eq(scenes.isMain, true)));

        if (existingMain) {
            // Update the existing main scene
            const [updated] = await db
                .update(scenes)
                .set({
                    data,
                    updatedAt: new Date(),
                })
                .where(eq(scenes.id, existingMain.id))
                .returning();
            return NextResponse.json(updated);
        }
    }

    // Create a new scene
    const [newScene] = await db
        .insert(scenes)
        .values({
            projectId,
            name,
            data,
            isMain,
        })
        .returning();

    return NextResponse.json(newScene);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { data } = body;

    // Find and update the main scene
    const [existingMain] = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.projectId, projectId), eq(scenes.isMain, true)));

    if (existingMain) {
        const [updated] = await db
            .update(scenes)
            .set({
                data,
                updatedAt: new Date(),
            })
            .where(eq(scenes.id, existingMain.id))
            .returning();
        return NextResponse.json(updated);
    }

    // If no main scene exists, create one
    const [newScene] = await db
        .insert(scenes)
        .values({
            projectId,
            name: "Main",
            data,
            isMain: true,
        })
        .returning();

    return NextResponse.json(newScene);
}
