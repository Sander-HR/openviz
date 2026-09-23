import { auth } from '@/lib/auth';
import { db } from '@/lib/auth';
import { phoneUploadSessions } from '@/lib/db/schema';
import { getDownloadUrl } from '@/lib/services/s3';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [record] = await db.insert(phoneUploadSessions).values({
        userId: session.user.id,
        status: 'pending',
    }).returning();

    return NextResponse.json({ id: record.id });
}

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await db.select().from(phoneUploadSessions).where(
        and(
            eq(phoneUploadSessions.id, id),
            eq(phoneUploadSessions.userId, session.user.id)
        )
    ).limit(1);

    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const record = rows[0];
    const payload: Record<string, unknown> = { ...record };
    if (record.status === 'completed' && record.s3Key) {
        payload.downloadUrl = await getDownloadUrl(record.s3Key);
    }

    return NextResponse.json(payload);
}
