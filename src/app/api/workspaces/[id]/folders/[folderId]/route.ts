import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { folders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const UpdateFolderSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
    parentId: z.string().uuid().nullable().optional(),
});

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string; folderId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await params;

    const folder = await db.query.folders.findFirst({
        where: eq(folders.id, folderId),
    });

    if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json(folder);
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string; folderId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await params;
    const body = await req.json();
    const validated = UpdateFolderSchema.safeParse(body);

    if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const existingFolder = await db.query.folders.findFirst({
        where: eq(folders.id, folderId),
    });

    if (!existingFolder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const [updatedFolder] = await db
        .update(folders)
        .set({
            ...validated.data,
            updatedAt: new Date(),
        })
        .where(eq(folders.id, folderId))
        .returning();

    return NextResponse.json(updatedFolder);
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string; folderId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await params;

    const existingFolder = await db.query.folders.findFirst({
        where: eq(folders.id, folderId),
    });

    if (!existingFolder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    await db.delete(folders).where(eq(folders.id, folderId));

    return NextResponse.json({ success: true });
}