import { set as idbSet } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store/useStore';

/**
 * Repro: a persisted snapshot with an OpenAI protocol but empty endpoint must
 * be rehydrated on store creation (that is the state that makes generation-lab
 * report "No image API configured" while the server settings are fine).
 */
describe('persist rehydration of computeSettings', () => {
    beforeEach(async () => {
        await idbSet('openviz-storage-idb', JSON.stringify({
            version: 0,
            state: {
                computeSettings: {
                    targetKind: 'local',
                    protocol: 'openai-image',
                    preference: 'automatic',
                    localEndpoint: '/comfy-api',
                    hostedEndpoint: '',
                    imageApiEndpoint: 'https://api.example.com/v1',
                    imageApiKey: '',
                    imageApiKeyless: false,
                    imageApiModels: [],
                    imageApiModel: 'test-model',
                    imageApiSize: '1024x1024',
                    endpointConcurrency: 2,
                    benchmarkGateEnabled: true,
                },
            },
        }));
    });

    it('restores persisted computeSettings after rehydration', async () => {
        // The store module is a singleton; trigger an explicit rehydrate.
        await new Promise<void>((resolve) => {
            (useStore as unknown as { persist: { rehydrate: () => void; onFinishHydration: (cb: () => void) => () => void } }).persist.onFinishHydration(() => resolve());
            (useStore as unknown as { persist: { rehydrate: () => void } }).persist.rehydrate();
        });
        expect(useStore.getState().computeSettings.protocol).toBe('openai-image');
        expect(useStore.getState().computeSettings.imageApiEndpoint).toBe('https://api.example.com/v1');
    });
});
