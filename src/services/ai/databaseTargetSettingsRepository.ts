import { db } from '@/lib/auth';
import { executionTargets } from '@/lib/db/schema';
import type { ExecutionTarget, TargetCapabilities } from '@/types/executionTarget.types';
import { generateUUID } from '@/utils/uuid';
import { and, eq } from 'drizzle-orm';
import type { TargetSettingsRepository } from './targetSettingsService';

type DatabaseClient = typeof db;

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toTarget(row: typeof executionTargets.$inferSelect): ExecutionTarget {
    return {
        id: row.id,
        kind: row.kind,
        endpoint: row.endpoint,
        displayName: row.displayName,
        status: row.status,
        authState: row.authState,
        capabilities: (row.capabilities as TargetCapabilities | null) ?? null,
    };
}

export function createDatabaseTargetSettingsRepository(userId: string, database: DatabaseClient = db): TargetSettingsRepository {
    return {
        async list() {
            const rows = await database.select().from(executionTargets).where(eq(executionTargets.userId, userId));
            return rows.map(toTarget);
        },
        async get(id) {
            if (!isUuid(id)) return undefined;
            const [row] = await database.select().from(executionTargets).where(and(eq(executionTargets.id, id), eq(executionTargets.userId, userId)));
            return row ? toTarget(row) : undefined;
        },
        async save(target) {
            const id = isUuid(target.id) ? target.id : generateUUID();
            const values = {
                id,
                userId,
                kind: target.kind,
                endpoint: target.endpoint,
                displayName: target.displayName,
                status: target.status,
                authState: target.authState,
                capabilities: target.capabilities,
                updatedAt: new Date(),
            };
            const [row] = await database.insert(executionTargets).values(values).onConflictDoUpdate({ target: executionTargets.id, set: values }).returning();
            return toTarget(row);
        },
        async update(id, updates) {
            if (!isUuid(id)) return;
            await database.update(executionTargets).set({ ...updates, updatedAt: new Date() }).where(and(eq(executionTargets.id, id), eq(executionTargets.userId, userId)));
        },
    };
}
