import { auth } from "@/lib/auth";
import { getUploadUrl, s3Paths } from "@/lib/services/s3";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { filename, contentType } = await req.json();
    if (!filename || !contentType) return NextResponse.json({ error: "Missing metadata" }, { status: 400 });

    const key = s3Paths.uploads(session.user.id, `${Date.now()}-${filename}`);
    const uploadUrl = await getUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key });
}
