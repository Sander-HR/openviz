"use client";

import { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const Workbench = dynamic(() => import("@/components/workbench/workbench").then(mod => mod.Workbench), { ssr: false });
const Studio = dynamic(() => import("@/components/Studio").then(mod => mod.Studio), { ssr: false });

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [isHydrated, setIsHydrated] = useState(false);
    const viewMode = useStore((state) => state.viewMode);
    const setNodes = useStore((state) => state.setWorkbenchNodes);
    const setConnections = useStore((state) => state.setConnections);
    const setCurrentProjectId = useStore((state) => state.setCurrentProjectId);

    const { data: projectData, isLoading, error } = useQuery({
        queryKey: ["projects", id],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) throw new Error("Project not found");
            return res.json();
        },
    });

    useEffect(() => {
        // Set the current project ID in the store
        setCurrentProjectId(id);

        return () => {
            // Clear the project ID when leaving the page
            // Note: We keep workbenchNodes so the dashboard can show previews
            setCurrentProjectId(null);
        };
    }, [id, setCurrentProjectId]);

    useEffect(() => {
        // Clear workbench nodes and connections first to avoid showing data from previous project
        setNodes([]);
        setConnections([]);

        if (projectData?.scene) {
            // Hydrate the store with the project's scene data
            const scene = projectData.scene;
            // Tag nodes with projectId so dashboard can filter them properly
            const nodesWithProjectId = scene.nodes?.map((node: any) => ({
                ...node,
                projectId: id
            })) || [];
            if (nodesWithProjectId.length > 0) setNodes(nodesWithProjectId);
            if (scene.connections) setConnections(scene.connections);
            setIsHydrated(true);
        } else if (projectData) {
            // Project exists but has no scene data yet - start with empty workbench
            setIsHydrated(true);
        }
    }, [projectData, setNodes, setConnections, id]);

    if (isLoading || !isHydrated) {
        return (
            <div className="h-screen w-screen bg-[#0F0F0F] flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-indigo-500" size={48} />
                    <p className="text-sm font-medium text-zinc-400">Loading workspace...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen bg-[#0F0F0F] flex items-center justify-center text-white">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">Project not found</h1>
                    <p className="text-zinc-500">The project you're looking for doesn't exist or you don't have access.</p>
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-6 py-2 bg-indigo-600 rounded-lg text-sm font-medium"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return viewMode === "WORKBENCH" ? <Workbench /> : <Studio />;
}
