import { auth } from '@/lib/auth';
import { createDatabaseTargetSettingsRepository } from '@/services/ai/databaseTargetSettingsRepository';
import { createLocalComfyTarget } from '@/services/ai/targets/localComfyTarget';
import { createTargetSettingsService } from '@/services/ai/targetSettingsService';
import { NextResponse } from 'next/server';

async function getService() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const repository = createDatabaseTargetSettingsRepository(session.user.id);
    return createTargetSettingsService({ repository, adapterFactory: (target) => createLocalComfyTarget({ id: target.id, endpoint: target.endpoint }) });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const service = await getService();
    if (!service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const target = (await service.listTargets()).find((candidate) => candidate.id === id);
    return target ? NextResponse.json({ target }) : NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const service = await getService();
    if (!service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json() as { action?: unknown };
    if (body.action === 'refresh') return NextResponse.json({ capabilities: await service.refreshCapabilities(id) });
    if (body.action === 'test') return NextResponse.json({ target: await service.testConnection(id) });
    return NextResponse.json({ error: 'Action must be test or refresh.' }, { status: 400 });
}
