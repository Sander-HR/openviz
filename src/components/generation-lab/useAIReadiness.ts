'use client';

import { useMemo } from 'react';
import { isImageBackendReady, type ImageBackendReadiness } from '@/services/ai/computeStatusService';
import { useStore } from '@/store/useStore';

/**
 * T031 (spec edge case: model/backend unavailable): derive the "AI ready /
 * AI not ready" workbench indicator and the generation gate from compute settings.
 */
export function useAIReadiness(): ImageBackendReadiness {
    const computeSettings = useStore((state) => state.computeSettings);
    return useMemo(() => isImageBackendReady(computeSettings), [computeSettings]);
}
