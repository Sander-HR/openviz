import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { folders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

interface FolderInfo {
    id: string;
    name: string;
    parentId: string | null;
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string; folderId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await params;
    
    const path: { id: string; name: string }[] = [];
    let currentId: string | null = folderId;
    
    while (currentId) {
        const folder = await db.query.folders.findFirst({
            where: eq(folders.id, currentId),
        }) as FolderInfo | undefined;
        
        if (!folder) break;
        
        path.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
    }
    
    return NextResponse.json(path);
}