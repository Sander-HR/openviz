import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { folders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateFolderSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
    parentId: z.string().uuid().optional().nullable(),
});

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;

    const allFolders = await db
        .select()
        .from(folders)
        .where(eq(folders.workspaceId, workspaceId));

    return NextResponse.json(allFolders);
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const body = await req.json();
    const validated = CreateFolderSchema.safeParse(body);

    if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const { name, parentId } = validated.data;

    const [newFolder] = await db
        .insert(folders)
        .values({
            name,
            workspaceId,
            parentId: parentId || null,
        })
        .returning();

    return NextResponse.json(newFolder);
}