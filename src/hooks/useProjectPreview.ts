import { useEffect, useState, useRef } from 'react';
import { useStore } from '@/store/useStore';

export function useProjectPreview(projectId: string) {
    const setProjectNodes = useStore((state) => state.setProjectNodes);
    const cachedNodes = useStore((state) => state.projectNodes[projectId]);
    const [isLoading, setIsLoading] = useState(false);
    const fetchTimeoutRef = useRef<any>(null);

    const fetchPreviews = async () => {
        if (cachedNodes || isLoading) return;

        setIsLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/previews`);
            if (res.ok) {
                const previews = await res.json();
                // Map the lightweight previews to a format ProjectCard understands
                // ProjectCard expects ImageNode | VideoNode structure
                const nodes = previews.map((p: any) => ({
                    id: p.id,
                    type: 'image', // Default to image for preview purposes
                    projectId: projectId,
                    project: {
                        thumbnail: p.thumbnail,
                        lastModifiedAt: p.lastModifiedAt
                    }
                }));
                setProjectNodes(projectId, nodes);
            }
        } catch (error) {
            console.error(`Failed to fetch previews for project ${projectId}:`, error);
        } finally {
            setIsLoading(false);
        }
    };

    const triggerFetch = (isVisible: boolean) => {
        if (isVisible && !cachedNodes && !isLoading) {
            // Debounce to avoid fetching while scrolling fast
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            fetchTimeoutRef.current = setTimeout(fetchPreviews, 200);
        } else if (!isVisible && fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
        }
    };

    useEffect(() => {
        return () => {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        };
    }, []);

    return {
        thumbnails: cachedNodes || [],
        isLoading,
        triggerFetch
    };
}
