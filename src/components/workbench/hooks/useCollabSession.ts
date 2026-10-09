import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { CollabRemoteAwarenessEntry, CollabSessionStatus, CollabTokenResponse } from '@/types/collab.types';
import type { CollabProviderLike, CollabSessionHandle, CreateCollabProvider, UseCollabSessionOptions, UseCollabSessionResult } from './useCollabSession.types';
export type { CollabAwarenessStateEntry, CollabProviderLike, CollabProviderRequest, CollabSessionHandle, CreateCollabProvider, UseCollabSessionOptions, UseCollabSessionResult } from './useCollabSession.types';
import { useStore } from '@/store/useStore';
import { createCollabProvider } from '@/services/collab/collabProviderFactory';
import { createSceneDocCommands, type SceneDocCommands } from '@/services/collab/sceneDocCommands';
import { createAwarenessUpdateCoalescer, createStalePeerCleanup, type AwarenessUpdateCoalescer, type StalePeerCleanup } from '@/services/collab/awareness';
import { emitBrowserCollaborationMetric, installBrowserCollabBenchControl } from '@/services/collab/performanceTelemetry';
import { waitForLocalDocumentReadiness } from '@/services/collab/localStoreReadiness';
import { useWorkbenchGraphProjection } from './useWorkbenchGraphProjection';
import { createCollabUndoManager, type CollabUndoManager } from '@/services/collab/undoOrigin';
import { consumePrefetchedRoomToken } from '@/services/collab/roomTokenPrefetch';

async function fetchRoomToken(projectId: string): Promise<CollabTokenResponse> {
    // T2.4: ProjectWorkspace prefetched this token in parallel with the scene
    // fetch; reuse it to keep the token round-trip off the join critical path.
    const prefetched = await consumePrefetchedRoomToken(projectId);
    if (prefetched) return prefetched;
    const response = await fetch(`/api/projects/${projectId}/scenes/collab-token`, { method: 'POST' });
    if (!response.ok) {
        throw new Error(`Failed to fetch collaboration token (HTTP ${response.status})`);
    }
    return (await response.json()) as CollabTokenResponse;
}

const defaultCreateProvider: CreateCollabProvider = (request) => {
    const handle = createCollabProvider({
        url: request.url,
        token: request.token,
        sceneId: request.name,
        userId: request.userId,
        userName: request.userName,
    });
    return {
        provider: handle.provider,
        doc: handle.doc,
        origin: handle.origin,
        connect: () => handle.connect(),
        disconnect: () => handle.disconnect(),
        localStoreReady: handle.offlineStore?.whenSynced.then(() => undefined),
        localPersistenceAvailable: handle.offlineStore !== null,
        destroy: handle.destroy,
    };
};

/**
 * Owns the real-time collaboration session for the current project's main
 * scene: token fetch → local replica restore → WebSocket join → Y.Doc projection → teardown.
 * The shared graph is not written from Zustand back to the document.
 */
export function useCollabSession(options: UseCollabSessionOptions): UseCollabSessionResult {
    const { projectId, userId, userName, serverUrl } = options;
    const getToken = options.getToken ?? fetchRoomToken;
    const createProvider = options.createProvider ?? defaultCreateProvider;

    const [status, setStatus] = useState<CollabSessionStatus>('idle');
    const [localPersistenceAvailable, setLocalPersistenceAvailable] = useState(true);
    const [doc, setDoc] = useState<Y.Doc | null>(null);
    const [origin, setOrigin] = useState<string | null>(null);
    const [commands, setCommands] = useState<SceneDocCommands | null>(null);
    const [provider, setProvider] = useState<CollabProviderLike | null>(null);
    // Bumped by retryWithFreshToken — re-runs the join effect with a new token.
    const [joinEpoch, setJoinEpoch] = useState(0);
    const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });
    const undoRef = useRef<CollabUndoManager | null>(null);
    const collabSessionActive = useStore((state) => state.collabSessionActive);
    const graphProjection = useWorkbenchGraphProjection({ doc, enabled: collabSessionActive });

    useEffect(() => {
        if (!projectId) {
            setStatus('idle');
            setLocalPersistenceAvailable(true);
            setCommands(null);
            useStore.getState().setCollabDocumentCommands(null);
            useStore.getState().setCollabSessionActive(false);
            return;
        }

        let cancelled = false;
        let handle: CollabSessionHandle | null = null;
        let unsubscribeUndo: (() => void) | null = null;
        let stalePeerCleanup: StalePeerCleanup | null = null;
        let awarenessCoalescer: AwarenessUpdateCoalescer | null = null;
        let disposeBenchControl: (() => void) | null = null;
        const awarenessStates = new Map<number, CollabRemoteAwarenessEntry>();
        let sessionStatus: CollabSessionStatus = 'connecting';
        // Once the document has synced, a transport drop is an OFFLINE state
        // (US3): local edits keep flowing into the doc and merge on reconnect.
        // Before the first sync it is just a cold connection attempt.
        let wasSynced = false;
        let sessionLocalPersistenceAvailable = true;

        // A fresh join attempt clears any prior terminal outcome so the
        // single-user fallback (Sprint 2) can re-arm on retry.
        useStore.getState().setCollabUnavailable(false);

        const updateStatus = (next: CollabSessionStatus): void => {
            if (cancelled) return;
            sessionStatus = next;
            setStatus(next);
            // Terminal outcomes without a sync: the workspace falls back to the
            // full-scene fetch instead of waiting on a dead session.
            if (next === 'failed' || next === 'denied') {
                useStore.getState().setCollabUnavailable(true);
            }
        };

        // Frozen/suspended tabs can exhaust the provider's retry budget while
        // away (background throttling). When the user comes back, re-trigger
        // the connection so the state-vector sync delivers everything missed —
        // the resulting doc update re-projects the store from the server.
        const handleVisibilityChange = (): void => {
            if (cancelled || !handle) return;
            if (document.visibilityState !== 'visible') return;
            if (sessionStatus === 'connected') return;
            void handle.connect();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        updateStatus('connecting');

        void (async () => {
            try {
                const tokenResponse = await getToken(projectId);
                if (cancelled) return;

                handle = createProvider({
                    url: serverUrl,
                    token: tokenResponse.token,
                    name: tokenResponse.sceneId,
                    userId,
                    userName,
                });
                sessionLocalPersistenceAvailable = handle.localPersistenceAvailable ?? true;
                setLocalPersistenceAvailable(sessionLocalPersistenceAvailable);
                try {
                    await waitForLocalDocumentReadiness(handle.localStoreReady);
                } catch (error) {
                    sessionLocalPersistenceAvailable = false;
                    setLocalPersistenceAvailable(false);
                    console.warn('[collab] local document restore unavailable; offline edits are not durable', error);
                }
                if (cancelled) {
                    handle.destroy();
                    return;
                }
                const sessionCommands = createSceneDocCommands(handle.doc, handle.origin);
                disposeBenchControl = installBrowserCollabBenchControl(handle.doc, handle.origin, sessionCommands);
                setCommands(sessionCommands);
                const applyAwarenessProjection = (): void => {
                    const localClientId = handle?.provider.awareness?.clientID ?? -1;
                    useStore.getState().applyRemoteAwareness(Array.from(awarenessStates.values()), localClientId);
                };
                awarenessCoalescer = createAwarenessUpdateCoalescer(applyAwarenessProjection);
                stalePeerCleanup = createStalePeerCleanup((clientId) => {
                    awarenessStates.delete(clientId);
                    awarenessCoalescer?.schedule();
                });

                const undoManager = createCollabUndoManager(handle.doc, handle.origin);
                undoRef.current = undoManager;
                unsubscribeUndo = undoManager.subscribe(() => {
                    setUndoState({ canUndo: undoManager.canUndo(), canRedo: undoManager.canRedo() });
                });

                // The document is only safe to project after the initial sync.
                handle.provider.on('synced', () => {
                    if (cancelled) return;
                    wasSynced = true;
                    useStore.getState().setCollabDocumentCommands(sessionCommands);
                    useStore.getState().setCollabSessionActive(true);
                    if (typeof window !== 'undefined') window.__openvizCollabBenchControl?.markReady();
                    console.info('[collab] synced — live co-editing active for scene', tokenResponse.sceneId);
                });
                handle.provider.on('status', (event) => {
                    let next: CollabSessionStatus;
                    if (event.status === 'connected') {
                        next = 'connected';
                    } else if (wasSynced && event.status === 'connecting') {
                        next = 'reconnecting';
                    } else if (wasSynced && sessionStatus !== 'failed') {
                        next = sessionLocalPersistenceAvailable ? 'offline-queued' : 'offline-unpersisted';
                    } else {
                        next = 'connecting';
                    }
                    if (next !== sessionStatus) console.info('[collab] status:', next);
                    updateStatus(next);
                });
                handle.provider.on('awarenessUpdate', (data) => {
                    if (cancelled) return;
                    const localClientId = handle?.provider.awareness?.clientID ?? -1;
                    const entries: CollabRemoteAwarenessEntry[] = data.states
                        .filter(({ clientId }) => clientId !== localClientId)
                        .map(({ clientId, ...state }) => ({
                            clientId,
                            state: state as CollabRemoteAwarenessEntry['state'],
                        }));
                    for (const entry of entries) {
                        const state = entry.state as Record<string, unknown>;
                        const previous = awarenessStates.get(entry.clientId)?.state as Record<string, unknown> | undefined;
                        const sentAt = state.collabBenchSentAt;
                        if (typeof sentAt === 'number' && state.collabBenchSequence !== previous?.collabBenchSequence) {
                            emitBrowserCollaborationMetric('cursorLatencyMs', Math.max(0, Date.now() - sentAt));
                        }
                    }
                    const liveClientIds = new Set(entries.map(({ clientId }) => clientId));
                    const removedClientIds = Array.from(awarenessStates.keys()).filter((clientId) => !liveClientIds.has(clientId));
                    awarenessStates.clear();
                    for (const entry of entries) {
                        awarenessStates.set(entry.clientId, entry);
                        stalePeerCleanup?.refresh(entry.clientId);
                    }
                    for (const clientId of removedClientIds) stalePeerCleanup?.remove(clientId);
                    if (removedClientIds.length > 0) awarenessCoalescer?.flush();
                    else awarenessCoalescer?.schedule();
                });
                handle.provider.on('maxAttemptsFailed', () => {
                    updateStatus(sessionLocalPersistenceAvailable ? 'failed' : 'offline-unpersisted');
                });
                handle.provider.on('authenticationFailed', (data) => {
                    if (cancelled) return;
                    console.info('[collab] authentication failed:', data.reason);
                    // SC-006: a rejected join must not be retried with the same
                    // token — stop the provider and surface `denied`. Recovery is
                    // explicit (retryWithFreshToken re-fetches a fresh token).
                    stalePeerCleanup?.dispose();
                    awarenessCoalescer?.dispose();
                    disposeBenchControl?.();
                    handle?.destroy();
                    setCommands(null);
                    useStore.getState().clearCollaborationState();
                    updateStatus('denied');
                });

                setDoc(handle.doc);
                setOrigin(handle.origin);
                setProvider(handle.provider);
                void handle.connect();
            } catch (error) {
                console.error('Failed to join collaboration session:', error);
                disposeBenchControl?.();
                setCommands(null);
                useStore.getState().setCollabDocumentCommands(null);
                // Terminal failure (e.g. the token endpoint is down with the
                // collab server): surface `failed` so the workspace falls back
                // to the full-scene fetch instead of sitting on an empty canvas.
                updateStatus('failed');
            }
        })();

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stalePeerCleanup?.dispose();
            awarenessCoalescer?.dispose();
            disposeBenchControl?.();
            awarenessStates.clear();
            unsubscribeUndo?.();
            undoRef.current?.destroy();
            undoRef.current = null;
            handle?.destroy();
            useStore.getState().setCollabSessionActive(false);
            useStore.getState().setCollabUnavailable(false);
            useStore.getState().setCollabDocumentCommands(null);
            setCommands(null);
            setDoc(null);
            setOrigin(null);
            setProvider(null);
            setUndoState({ canUndo: false, canRedo: false });
            setStatus('idle');
        };
    }, [projectId, userId, userName, serverUrl, getToken, createProvider, joinEpoch]);

    const retryWithFreshToken = useCallback(() => {
        setJoinEpoch((epoch) => epoch + 1);
    }, []);

    const undo = useCallback(() => {
        undoRef.current?.undo();
    }, []);

    const redo = useCallback(() => {
        undoRef.current?.redo();
    }, []);

    return { status, doc, sceneName: graphProjection.sceneName, origin, commands, localPersistenceAvailable, provider, userId, userName, retryWithFreshToken, undo, redo, canUndo: undoState.canUndo, canRedo: undoState.canRedo };
}
