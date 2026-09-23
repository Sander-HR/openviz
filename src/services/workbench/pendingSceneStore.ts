import type { Connection, WorkbenchNode } from "@/types";

/**
 * Durable "pending scene save" store backed by IndexedDB.
 *
 * Every time the autosave layer is about to send a scene PATCH, it first writes
 * the payload here. If the browser is reloaded/closed before the request lands,
 * the record survives and the next page load re-issues the save — so gesture-end
 * changes are never lost, regardless of payload size (keepalive requests are
 * capped at ~64KB by browsers, while real scenes can be several megabytes).
 */

const DB_NAME = "openviz-scene-sync";
const STORE_NAME = "pending";
const DB_VERSION = 1;

export type PendingSceneRecord = {
    projectId: string;
    expectedVersion: number | null;
    data: { nodes: WorkbenchNode[]; connections: Connection[] };
    savedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error("Failed to open pending scene DB"));
        });
    }
    return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = run(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("Pending scene store request failed"));
    });
}

/** Write/replace the pending record for a project. Best-effort: never throws. */
export async function setPendingScene(record: PendingSceneRecord): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    try {
        await withStore("readwrite", (store) => store.put(record));
    } catch {
        // Storage unavailable (private mode, quota, etc.) — the in-flight
        // network save is still the primary path.
    }
}

/** Read the pending record for a project, or null when there is none. */
export async function getPendingScene(projectId: string): Promise<PendingSceneRecord | null> {
    if (typeof indexedDB === "undefined") return null;
    try {
        const result = await withStore<PendingSceneRecord | undefined>("readonly", (store) => store.get(projectId));
        return result ?? null;
    } catch {
        return null;
    }
}

/** Remove the pending record for a project. Best-effort: never throws. */
export async function clearPendingScene(projectId: string): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    try {
        await withStore("readwrite", (store) => store.delete(projectId));
    } catch {
        // Ignore — a stale record is re-evaluated on the next load.
    }
}
