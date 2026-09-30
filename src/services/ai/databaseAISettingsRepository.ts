import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/auth';
import { aiComputeSettings, aiEndpointProfiles } from '@/lib/db/schema';
import { decryptAISecret, encryptAISecret } from '@/lib/aiSettingsCrypto';
import type { AISettingsUpdate, PersistedAISettings } from '@/types/aiSettings.types';
import type { ComputeSettings } from '@/types/executionTarget.types';

type DatabaseClient = typeof db;

function toSettings(row: typeof aiComputeSettings.$inferSelect): PersistedAISettings {
    return {
        targetKind: row.targetKind,
        protocol: row.protocol,
        preference: row.preference,
        localEndpoint: row.localEndpoint,
        hostedEndpoint: row.hostedEndpoint,
        imageApiEndpoint: row.imageApiEndpoint,
        imageApiKeyless: row.imageApiKeyless,
        imageApiModels: [],
        imageApiModel: row.imageApiModel,
        imageApiSize: row.imageApiSize,
        endpointConcurrency: row.endpointConcurrency,
        hasImageApiKey: Boolean(row.imageApiKeyCiphertext),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export function createDatabaseAISettingsRepository(userId: string, database: DatabaseClient = db) {
    return {
        async get(): Promise<PersistedAISettings | null> {
            const [row] = await database.select().from(aiComputeSettings).where(eq(aiComputeSettings.userId, userId));
            return row ? toSettings(row) : null;
        },
        async getSecret(): Promise<string | null> {
            const [row] = await database.select({ ciphertext: aiComputeSettings.imageApiKeyCiphertext }).from(aiComputeSettings).where(eq(aiComputeSettings.userId, userId));
            return row?.ciphertext ? decryptAISecret(row.ciphertext) : null;
        },
        async upsert(update: AISettingsUpdate): Promise<PersistedAISettings> {
            const current = await database.select().from(aiComputeSettings).where(eq(aiComputeSettings.userId, userId));
            const currentRow = current[0];
            const values = {
                userId,
                targetKind: update.targetKind ?? currentRow?.targetKind ?? 'local',
                protocol: update.protocol ?? currentRow?.protocol ?? 'comfyui',
                preference: update.preference ?? currentRow?.preference ?? 'automatic',
                localEndpoint: update.localEndpoint ?? currentRow?.localEndpoint ?? '/comfy-api',
                hostedEndpoint: update.hostedEndpoint ?? currentRow?.hostedEndpoint ?? '',
                imageApiEndpoint: update.imageApiEndpoint ?? currentRow?.imageApiEndpoint ?? '',
                imageApiKeyless: update.imageApiKeyless ?? currentRow?.imageApiKeyless ?? false,
                imageApiModel: update.imageApiModel ?? currentRow?.imageApiModel ?? '',
                imageApiSize: update.imageApiSize ?? currentRow?.imageApiSize ?? '1024x1024',
                endpointConcurrency: update.endpointConcurrency ?? currentRow?.endpointConcurrency ?? 2,
                imageApiKeyCiphertext: update.imageApiKey === undefined
                    ? currentRow?.imageApiKeyCiphertext ?? null
                    : update.imageApiKey
                        ? encryptAISecret(update.imageApiKey)
                        : null,
                imageApiKeyUpdatedAt: update.imageApiKey === undefined ? currentRow?.imageApiKeyUpdatedAt ?? null : new Date(),
                updatedAt: new Date(),
            };
            const [row] = await database.insert(aiComputeSettings).values(values).onConflictDoUpdate({ target: aiComputeSettings.userId, set: values }).returning();
            return toSettings(row);
        },
        async deleteProfile(profileId: string): Promise<void> {
            await database.delete(aiEndpointProfiles).where(and(eq(aiEndpointProfiles.id, profileId), eq(aiEndpointProfiles.userId, userId)));
        },
    };
}

export type AISettingsRepository = ReturnType<typeof createDatabaseAISettingsRepository>;

export function toClientComputeSettings(settings: PersistedAISettings, current: ComputeSettings): ComputeSettings {
    return { ...current, ...settings, imageApiKey: current.imageApiKey };
}