import { describe, expect, it } from 'vitest';
import { useStore } from '../useStore';

describe('aiComputeSlice', () => {
    it('persists compute preference and target endpoint state', () => {
        useStore.getState().setComputePreference('balanced');
        useStore.getState().setLocalComfyEndpoint('http://localhost:8188');
        useStore.getState().setExecutionTargetKind('hybrid');

        expect(useStore.getState().computeSettings).toMatchObject({
            preference: 'balanced',
            localEndpoint: 'http://localhost:8188',
            targetKind: 'hybrid',
        });
    });
});
