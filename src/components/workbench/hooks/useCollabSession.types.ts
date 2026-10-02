import type { SceneDocCommands } from '@/services/collab/sceneDocCommands';
import type { CollabSessionStatus, CollabTokenResponse } from '@/types/collab.types';
import type * as Y from 'yjs';

export type CollabAwarenessStateEntry = Record<string, unknown> & { clientId: number };

export interface CollabProviderLike {
    on(event: 'status', listener: (event: { status: string }) => void): unknown;
    on(event: 'synced', listener: () => void): unknown;
    on(event: 'maxAttemptsFailed', listener: () => void): unknown;
    on(event: 'authenticationFailed', listener: (data: { reason: string }) => void): unknown;
    on(event: 'awarenessUpdate', listener: (data: { states: CollabAwarenessStateEntry[] }) => void): unknown;
    readonly awareness?: { readonly clientID: number } | null;
    setAwarenessField(key: string, value: unknown): void;
    destroy(): void;
}

export interface CollabProviderRequest {
    url: string;
    token: string;
    name: string;
    userId: string;
    userName: string;
}

export interface CollabSessionHandle {
    provider: CollabProviderLike;
    doc: Y.Doc;
    origin: string;
    connect(): void | Promise<unknown>;
    disconnect(): void;
    localStoreReady?: Promise<void>;
    localPersistenceAvailable?: boolean;
    destroy(): void;
}

export type CreateCollabProvider = (request: CollabProviderRequest) => CollabSessionHandle;

export interface UseCollabSessionOptions {
    projectId: string | null;
    userId: string;
    userName: string;
    serverUrl: string;
    getToken?: (projectId: string) => Promise<CollabTokenResponse>;
    createProvider?: CreateCollabProvider;
}

export interface UseCollabSessionResult {
    status: CollabSessionStatus;
    doc: Y.Doc | null;
    sceneName: string | undefined;
    origin: string | null;
    commands: SceneDocCommands | null;
    localPersistenceAvailable: boolean;
    provider: CollabProviderLike | null;
    userId: string;
    userName: string;
    retryWithFreshToken(): void;
    undo(): void;
    redo(): void;
    canUndo: boolean;
    canRedo: boolean;
}
