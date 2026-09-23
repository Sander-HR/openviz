import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { SceneData } from "@/types";

type SceneSnapshotEvent = {
    projectId: string;
    version: number;
    data: SceneData;
};

export function useSceneStream(projectId: string | null) {
    const {
        currentSceneVersion,
        setCurrentSceneVersion,
        setWorkbenchNodes,
        setConnections,
        setNodeLockState,
        clearNodeLockState,
        upsertPresenceState,
        clearPresenceState,
        collabSessionActive,
    } = useStore(
        useShallow((state) => ({
            currentSceneVersion: state.currentSceneVersion,
            setCurrentSceneVersion: state.setCurrentSceneVersion,
            setWorkbenchNodes: state.setWorkbenchNodes,
            setConnections: state.setConnections,
            setNodeLockState: state.setNodeLockState,
            clearNodeLockState: state.clearNodeLockState,
            upsertPresenceState: state.upsertPresenceState,
            clearPresenceState: state.clearPresenceState,
            collabSessionActive: state.collabSessionActive,
        }))
    );

    useEffect(() => {
        if (!projectId) return;
        if (!projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return;
        }
        // While a collaboration session owns this scene, the ydoc + awareness
        // are the source of truth — SSE snapshots/locks/presence would clobber
        // live projections and never-expiring locks (US2 migration).
        if (collabSessionActive) return;

        const source = new EventSource(`/api/projects/${projectId}/scenes/stream`);

        const onSnapshot = (event: MessageEvent<string>) => {
            try {
                const snapshot = JSON.parse(event.data) as SceneSnapshotEvent;
                if (!snapshot.data || typeof snapshot.version !== "number") return;
                if (snapshot.version <= currentSceneVersion) return;

                setWorkbenchNodes(snapshot.data.nodes);
                setConnections(snapshot.data.connections);
                setCurrentSceneVersion(snapshot.version);
            } catch (error) {
                console.error("Failed to parse scene snapshot event:", error);
            }
        };

        const onLock = (event: MessageEvent<string>) => {
            try {
                const payload = JSON.parse(event.data) as Parameters<typeof setNodeLockState>[0];
                setNodeLockState(payload);
            } catch (error) {
                console.error("Failed to parse lock event:", error);
            }
        };

        const onUnlock = (event: MessageEvent<string>) => {
            try {
                const payload = JSON.parse(event.data) as { nodeId?: string };
                if (payload.nodeId) clearNodeLockState(payload.nodeId);
            } catch (error) {
                console.error("Failed to parse unlock event:", error);
            }
        };

        const onPresence = (event: MessageEvent<string>) => {
            try {
                const payload = JSON.parse(event.data) as Parameters<typeof upsertPresenceState>[0];
                upsertPresenceState(payload);
            } catch (error) {
                console.error("Failed to parse presence event:", error);
            }
        };

        const onPresenceLeave = (event: MessageEvent<string>) => {
            try {
                const payload = JSON.parse(event.data) as { userId?: string };
                if (payload.userId) clearPresenceState(payload.userId);
            } catch (error) {
                console.error("Failed to parse presence leave event:", error);
            }
        };

        source.addEventListener("scene.snapshot", onSnapshot as EventListener);
        source.addEventListener("scene.selection.locked", onLock as EventListener);
        source.addEventListener("scene.selection.unlocked", onUnlock as EventListener);
        source.addEventListener("scene.presence.updated", onPresence as EventListener);
        source.addEventListener("scene.presence.left", onPresenceLeave as EventListener);

        return () => {
            source.removeEventListener("scene.snapshot", onSnapshot as EventListener);
            source.removeEventListener("scene.selection.locked", onLock as EventListener);
            source.removeEventListener("scene.selection.unlocked", onUnlock as EventListener);
            source.removeEventListener("scene.presence.updated", onPresence as EventListener);
            source.removeEventListener("scene.presence.left", onPresenceLeave as EventListener);
            source.close();
        };
    }, [
        projectId,
        currentSceneVersion,
        setCurrentSceneVersion,
        setWorkbenchNodes,
        setConnections,
        setNodeLockState,
        clearNodeLockState,
        upsertPresenceState,
        clearPresenceState,
        collabSessionActive,
    ]);
}
