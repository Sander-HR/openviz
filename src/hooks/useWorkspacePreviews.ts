import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export type ProjectPreview = {
    id: string;
    thumbnail: string;
    lastModifiedAt: number | null;
};

export type PreviewsByProject = Record<string, ProjectPreview[]>;

const EMPTY_PREVIEWS: PreviewsByProject = {};

/**
 * Fetches dashboard preview thumbnails for a whole set of projects in ONE
 * request (GET /api/projects/previews?ids=...) — replaces the per-card
 * useProjectPreview N+1. The query key is the sorted, deduped id list so
 * re-sorting or re-filtering the dashboard does not refetch.
 */
export function useWorkspacePreviews(projectIds: readonly string[]): PreviewsByProject {
    const idsKey = useMemo(
        () => [...new Set(projectIds.filter(Boolean))].sort().join(","),
        [projectIds]
    );

    const { data } = useQuery({
        queryKey: ["project-previews", idsKey],
        enabled: idsKey.length > 0,
        staleTime: 30_000,
        queryFn: async (): Promise<PreviewsByProject> => {
            const res = await fetch(`/api/projects/previews?ids=${encodeURIComponent(idsKey)}`);
            if (!res.ok) return {};
            return (await res.json()) as PreviewsByProject;
        },
    });

    return data ?? EMPTY_PREVIEWS;
}
