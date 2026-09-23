import { StateCreator } from "zustand";
import { AppState } from "../storeTypes";
import { NodeLockState, PresenceState } from "@/types";
import type { CollabPresencePeer, CollabRemoteAwarenessEntry, CollabRemoteCursorState } from "@/types/collab.types";

const PRESENCE_COLORS = ['#f97316', '#0ea5e9', '#22c55e', '#a855f7', '#ef4444', '#eab308'];

/** Deterministic per-user color so every replica renders the same palette. */
export function presenceColorFor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i += 1) {
        hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    }
    return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

export interface WorkbenchCollaborationSlice {
    currentSceneVersion: number;
    /** True once the project page has hydrated the store from its scene fetch. */
    sceneHydrated: boolean;
    /** True while a real-time collaboration session owns this scene's writes (single-writer rule). */
    collabSessionActive: boolean;
    nodeLocks: Record<string, NodeLockState>;
    /** Remote peers keyed by user id (derived from awareness; one entry per user). */
    presenceByUser: Record<string, CollabPresencePeer>;
    /** Remote cursor markers keyed by awareness client id (two tabs of one user = two entries). */
    remoteCursors: Record<string, CollabRemoteCursorState>;
    /**
     * Pure projection of a full awareness snapshot into presence/cursors/locks.
     * `nodeLocks` holds REMOTE locks only — nodes another client has selected or
     * is editing (spec FR-015). Per-node winner: earliest `selectedAt`, ties
     * break to the lower client id, so every replica derives the same holder.
     */
    applyRemoteAwareness: (entries: CollabRemoteAwarenessEntry[], localClientId: number) => void;
    setCurrentSceneVersion: (version: number) => void;
    setSceneHydrated: (hydrated: boolean) => void;
    setCollabSessionActive: (active: boolean) => void;
    setNodeLockState: (lock: NodeLockState) => void;
    clearNodeLockState: (nodeId: string) => void;
    upsertPresenceState: (presence: PresenceState) => void;
    clearPresenceState: (userId: string) => void;
    clearCollaborationState: () => void;
}

export const createWorkbenchCollaborationSlice: StateCreator<AppState, [], [], WorkbenchCollaborationSlice> = (set) => ({
    currentSceneVersion: 0,
    sceneHydrated: false,
    collabSessionActive: false,
    nodeLocks: {},
    presenceByUser: {},
    remoteCursors: {},
    setCurrentSceneVersion: (version) => set({ currentSceneVersion: version }),
    setSceneHydrated: (hydrated) => set({ sceneHydrated: hydrated }),
    setCollabSessionActive: (active) => set({ collabSessionActive: active }),
    setNodeLockState: (lock) =>
        set((state: AppState) => ({
            nodeLocks: {
                ...state.nodeLocks,
                [lock.nodeId]: lock,
            },
        })),
    clearNodeLockState: (nodeId) =>
        set((state: AppState) => {
            const nextLocks = { ...state.nodeLocks };
            delete nextLocks[nodeId];
            return { nodeLocks: nextLocks };
        }),
    // Legacy SSE path — mapped into the same awareness-derived peer shape.
    upsertPresenceState: (presence) =>
        set((state: AppState) => ({
            presenceByUser: {
                ...state.presenceByUser,
                [presence.userId]: {
                    userId: presence.userId,
                    userName: presence.userName,
                    color: presenceColorFor(presence.userId),
                },
            },
        })),
    clearPresenceState: (userId) =>
        set((state: AppState) => {
            const nextPresence = { ...state.presenceByUser };
            delete nextPresence[userId];
            return { presenceByUser: nextPresence };
        }),
    applyRemoteAwareness: (entries, localClientId) => {
        const presenceByUser: Record<string, CollabPresencePeer> = {};
        const remoteCursors: Record<string, CollabRemoteCursorState> = {};
        const lockHolders = new Map<string, CollabRemoteAwarenessEntry>();

        for (const entry of entries) {
            if (entry.clientId === localClientId) continue;
            const user = entry.state.user;
            if (!user?.id) continue;

            presenceByUser[user.id] ??= {
                userId: user.id,
                userName: user.name,
                color: presenceColorFor(user.id),
            };

            if (entry.state.cursor) {
                remoteCursors[String(entry.clientId)] = {
                    userId: user.id,
                    userName: user.name,
                    color: presenceColorFor(user.id),
                    x: entry.state.cursor.x,
                    y: entry.state.cursor.y,
                };
            }

            for (const nodeId of entry.state.activeNodeIds ?? []) {
                const current = lockHolders.get(nodeId);
                if (!current) {
                    lockHolders.set(nodeId, entry);
                    continue;
                }
                const a = current.state.selectedAt ?? Number.MAX_SAFE_INTEGER;
                const b = entry.state.selectedAt ?? Number.MAX_SAFE_INTEGER;
                if (b < a || (b === a && entry.clientId < current.clientId)) {
                    lockHolders.set(nodeId, entry);
                }
            }
        }

        const nodeLocks: Record<string, NodeLockState> = {};
        for (const [nodeId, holder] of lockHolders) {
            nodeLocks[nodeId] = {
                nodeId,
                userId: holder.state.user!.id,
                userName: holder.state.user!.name,
            };
        }

        set({ presenceByUser, remoteCursors, nodeLocks });
    },
    clearCollaborationState: () =>
        set({
            collabSessionActive: false,
            nodeLocks: {},
            presenceByUser: {},
            remoteCursors: {},
        }),
});
