'use client';

import { useQuery } from '@tanstack/react-query';
import { createApiExtractionAssetRepository } from '@/services/extractionAssetRepository';
import type { ProjectAsset } from '@/types/renderTask.types';
import { useStore } from '@/store/useStore';

/**
 * Feature 012 — T030 (FR-023): server state for saved extraction assets.
 * Lists the project's reusable assets (palettes, material notes, part lists)
 * so other tasks can reference them by explicit selection. The effective
 * project id mirrors the save path in `renderTaskService` (`'default'` when
 * no project is active).
 */
export function useExtractionAssets(options?: { enabled?: boolean }) {
    const projectId = useStore((state) => state.currentProjectId);
    const effectiveProjectId = projectId ?? 'default';

    const query = useQuery<ProjectAsset[]>({
        queryKey: ['extraction-assets', effectiveProjectId],
        // Created per call so the default fetcher resolves to the current global.
        queryFn: () => createApiExtractionAssetRepository().list(effectiveProjectId),
        enabled: options?.enabled ?? true,
        staleTime: 30_000,
    });

    return { assets: query.data ?? [], isLoading: query.isLoading, error: query.error as Error | null };
}
