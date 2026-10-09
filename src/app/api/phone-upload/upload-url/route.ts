import { db } from '@/lib/auth';
import { phoneUploadSessions } from '@/lib/db/schema';
import { getUploadUrl, s3Paths } from '@/lib/services/s3';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { sessionId, fileName, mimeType } = await req.json();
    if (!sessionId || !fileName || !mimeType) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const rows = await db.select().from(phoneUploadSessions).where(eq(phoneUploadSessions.id, sessionId)).limit(1);
    if (!rows.length) return NextResponse.json({ error: 'Invalid session' }, { status: 404 });

    const session = rows[0];
    if (session.status === 'expired' || session.status === 'completed') {
        return NextResponse.json({ error: 'Session already used' }, { status: 410 });
    }

    const key = s3Paths.uploads(session.userId, `phone-${Date.now()}-${fileName}`);
    const uploadUrl = await getUploadUrl(key, mimeType);

    await db.update(phoneUploadSessions).set({
        status: 'uploading',
        fileName,
        mimeType,
        s3Key: key,
    }).where(eq(phoneUploadSessions.id, sessionId));

    return NextResponse.json({ uploadUrl, key });
}
