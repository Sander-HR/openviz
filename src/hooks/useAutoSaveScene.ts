import { useEffect, useRef, useCallback } from "react";
import { useStore } from "@/store/useStore";

export function useAutoSaveScene(projectId: string | null) {
    const workbenchNodes = useStore((state) => state.workbenchNodes);
    const connections = useStore((state) => state.connections);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedRef = useRef<string>("");
    const nodesRef = useRef(workbenchNodes);
    const connectionsRef = useRef(connections);

    // Keep refs in sync with latest values
    useEffect(() => {
        nodesRef.current = workbenchNodes;
        connectionsRef.current = connections;
    }, [workbenchNodes, connections]);

    // Extract save logic into a callback
    const saveScene = useCallback(async (currentProjectId: string) => {
        const sceneData = {
            nodes: nodesRef.current,
            connections: connectionsRef.current,
        };

        const sceneDataJson = JSON.stringify(sceneData);

        // Only save if data has changed
        if (sceneDataJson === lastSavedRef.current) return;

        try {
            const response = await fetch(`/api/projects/${currentProjectId}/scenes`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: sceneData }),
            });

            if (response.ok) {
                lastSavedRef.current = sceneDataJson;
            }
        } catch (error) {
            console.error("Failed to auto-save scene:", error);
        }
    }, []);

    useEffect(() => {
        if (!projectId) return;
        if (!projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // Don't auto-save for temporary/local projects (non-UUID IDs)
            return;
        }

        // Debounce the save operation
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            saveScene(projectId);
        }, 1000); // Save 1 second after last change

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                // Save immediately on unmount
                saveScene(projectId);
            }
        };
    }, [workbenchNodes, connections, projectId, saveScene]);
}
