import * as Y from 'yjs';
import type { fetchPayload, storePayload } from '@hocuspocus/server';
import { eq, sql } from 'drizzle-orm';
import type { SceneDataJson } from '../../src/types/collab.types';
import { createSceneDoc, extractSceneFromDoc, seedSceneFromJson } from '../../src/services/collab/sceneDocMapping';
import { scenes } from '../../src/lib/db/schema';
import { getDb } from './db';

/** A `scenes` row narrowed to what the persistence layer needs. */
export interface SceneRow {
    id: string;
    data: SceneDataJson;
    ydoc: Uint8Array | null;
}

export interface SaveSceneInput {
    sceneId: string;
    data: SceneDataJson;
    ydoc: Uint8Array;
    /** Last editor derived from the transaction origin, when known. */
    updatedBy: string | null;
}

export interface PersistenceDependencies {
    getScene: (sceneId: string) => Promise<SceneRow | null>;
    saveScene: (input: SaveSceneInput) => Promise<void>;
    log?: (message: string, error?: unknown) => void;
}

/** Extracts the user id from local client origins (`user:<id>`); null otherwise. */
export function parseOriginUser(origin: unknown): string | null {
    if (typeof origin !== 'string' || !origin.startsWith('user:')) return null;
    // Origin format: `user:<userId>[:<clientID>]` — the client suffix isolates
    // concurrent tabs of one user; attribution only needs the userId segment.
    const userId = origin.slice('user:'.length).split(':')[0];
    return userId.length > 0 ? userId : null;
}

/**
 * Hocuspocus `fetch` hook: prefers the lossless encoded document, else seeds
 * a fresh document from saved scene JSON (lazy import — SC-007), else null.
 */
export function createFetch(deps: PersistenceDependencies) {
    return async (payload: fetchPayload): Promise<Uint8Array | null> => {
        const row = await deps.getScene(payload.documentName);
        if (!row) return null;

        if (row.ydoc && row.ydoc.byteLength > 0) {
            return row.ydoc;
        }

        const data = row.data ?? { nodes: [], connections: [] };
        if (data.nodes.length === 0 && data.connections.length === 0) {
            return null;
        }

        const seeded = createSceneDoc();
        seedSceneFromJson(seeded, data);
        return Y.encodeStateAsUpdate(seeded);
    };
}

/**
 * Hocuspocus `store` hook (debounced by the server). Extracts converged JSON,
 * persists it together with the encoded document, and bumps the scene version.
 * Failures are logged and swallowed: live collaboration must never be blocked,
 * and the next save trigger retries.
 */
export function createStore(deps: PersistenceDependencies) {
    return async (payload: storePayload): Promise<void> => {
        const data = extractSceneFromDoc(payload.document);
        const input: SaveSceneInput = {
            sceneId: payload.documentName,
            data,
            ydoc: new Uint8Array(payload.state),
            updatedBy: parseOriginUser(payload.lastTransactionOrigin),
        };

        try {
            await deps.saveScene(input);
        } catch (error) {
            deps.log?.('collab scene save failed — will retry on next trigger', error);
        }
    };
}

/** Default dependencies wired to Postgres via Drizzle. */
export function createDbPersistence(): PersistenceDependencies {
    return {
        getScene: async (sceneId) => {
            const db = getDb();
            const [row] = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1);
            if (!row) return null;
            return {
                id: row.id,
                data: (row.data as SceneDataJson | null) ?? { nodes: [], connections: [] },
                ydoc: row.ydoc ? new Uint8Array(row.ydoc) : null,
            };
        },
        saveScene: async ({ sceneId, data, ydoc, updatedBy }) => {
            const db = getDb();
            await db
                .update(scenes)
                .set({
                    data,
                    ydoc,
                    version: sql`${scenes.version} + 1`,
                    updatedBy,
                    updatedAt: new Date(),
                })
                .where(eq(scenes.id, sceneId));
        },
        log: (message, error) => {
            console.error(`[collab] ${message}`, error ?? '');
        },
    };
}
