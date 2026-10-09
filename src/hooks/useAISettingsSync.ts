"use client";

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from '@/store/useStore';
import type { PersistedAISettings } from '@/types/aiSettings.types';

type PersistApi = {
    hasHydrated: () => boolean;
    onFinishHydration: (callback: () => void) => () => void;
};

/**
 * Hydrate compute settings from the server (source of truth) on app load.
 *
 * The store rehydrates computeSettings from IndexedDB, but that snapshot can
 * be stale or missing (fresh profile, cleared storage, or a debounced write
 * of pre-hydration defaults). Left alone, generation-lab then reports "no
 * image API configured" even though the server stores an endpoint. Syncing
 * after IDB hydration completes makes the server state win on every page —
 * previously only Settings fetched /api/ai/settings.
 */
export function useAISettingsSync() {
    const { status } = useSession();
    const applyComputeSettings = useStore((state) => state.applyComputeSettings);

    useEffect(() => {
        if (status !== 'authenticated') return;

        let cancelled = false;
        const persistApi = (useStore as unknown as { persist: PersistApi }).persist;

        const sync = () => {
            fetch('/api/ai/settings')
                .then((response) => (response.ok ? (response.json() as Promise<{ settings: PersistedAISettings | null }>) : null))
                .then((payload) => {
                    if (cancelled || !payload?.settings) return;
                    const s = payload.settings;
                    // Pick fields explicitly: the server never returns the key
                    // secret and always returns imageApiModels: [] (models are
                    // discovered live), neither of which should clobber local state.
                    applyComputeSettings({
                        targetKind: s.targetKind,
                        protocol: s.protocol,
                        preference: s.preference,
                        localEndpoint: s.localEndpoint,
                        hostedEndpoint: s.hostedEndpoint,
                        imageApiEndpoint: s.imageApiEndpoint,
                        imageApiKeyless: s.imageApiKeyless,
                        imageApiModel: s.imageApiModel,
                        imageApiSize: s.imageApiSize,
                        endpointConcurrency: s.endpointConcurrency,
                    });
                })
                .catch(() => undefined); // offline or transient failure — keep local state
        };

        if (persistApi.hasHydrated()) {
            sync();
            return () => { cancelled = true; };
        }
        const unsubscribe = persistApi.onFinishHydration(sync);
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [status, applyComputeSettings]);
}
