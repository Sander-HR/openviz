import { db } from '@/lib/auth';
import { phoneUploadSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { sessionId, s3Key, fileName, mimeType } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const rows = await db.select().from(phoneUploadSessions).where(eq(phoneUploadSessions.id, sessionId)).limit(1);
    if (!rows.length) return NextResponse.json({ error: 'Invalid session' }, { status: 404 });

    const session = rows[0];
    if (session.status === 'expired' || session.status === 'completed') {
        return NextResponse.json({ error: 'Session already used' }, { status: 410 });
    }

    await db.update(phoneUploadSessions).set({
        status: 'completed',
        s3Key: s3Key || session.s3Key,
        fileName: fileName || session.fileName,
        mimeType: mimeType || session.mimeType,
        updatedAt: new Date(),
    }).where(eq(phoneUploadSessions.id, sessionId));

    return NextResponse.json({ success: true });
}
