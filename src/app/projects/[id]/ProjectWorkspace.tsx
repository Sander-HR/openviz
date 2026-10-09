"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SceneData, WorkbenchNode, Connection } from "@/types";
import { useShallow } from "zustand/react/shallow";
import { studioModule, workbenchModule } from "@/lib/viewImports";
import { prefetchRoomToken } from "@/services/collab/roomTokenPrefetch";
import {
    COLLAB_FALLBACK_WAIT_MS,
    resolveSceneHydration,
    settleCollabOutcome,
    shouldHydrateFromServer,
    shouldPaintFromCache,
} from "./projectReadiness";

// Built from the shared import promises (see viewImports.ts) so the idle
// preloader and this page load exactly the same chunks.
const Workbench = dynamic(() => workbenchModule.then((mod) => mod.Workbench), { ssr: false });
const Studio = dynamic(() => studioModule.then((mod) => mod.Studio), { ssr: false });

/** `?lite=1` response — KB-sized readiness payload (inline data stripped). */
type LiteProjectResponse = {
    name?: string;
    sceneVersion?: number;
};

/** Full scene payload — fetched only for the single-user fallback path. */
type ProjectApiResponse = {
    scene: SceneData | null;
    sceneVersion?: number;
};

/**
 * Shared project workspace rendered by both /projects/[id]/studio and
 * /projects/[id]/workbench. The URL segment is the source of truth for the
 * active view; the zustand viewMode is kept in sync so components that read
 * it (e.g. useWorkbenchCenterOnReturn) keep working unchanged.
 */
export function ProjectWorkspace({ id, activeView }: { id: string; activeView: "STUDIO" | "WORKBENCH" }) {
    const [isProjectReady, setIsProjectReady] = useState(() => {
        const state = useStore.getState();
        if (state.currentProjectId === id && state.sceneHydrated) return true;
        // Stale-while-revalidate: persisted nodes for this project paint on
        // first render; the server fetch reconciles when it arrives.
        return shouldPaintFromCache(
            {
                lastOpenedProjectId: state.lastOpenedProjectId,
                persistHydrated: useStore.persist.hasHydrated(),
                workbenchNodeCount: state.workbenchNodes.length,
                collabSessionActive: state.collabSessionActive,
            },
            id
        );
    });
    // True once we painted (or will keep painting) from the local cache before
    // the server response arrived — suppresses the node-clearing path and the
    // version downgrade in the hydration effect below.
    const [paintedFromCache] = useState(() => {
        const state = useStore.getState();
        return shouldPaintFromCache(
            {
                lastOpenedProjectId: state.lastOpenedProjectId,
                persistHydrated: useStore.persist.hasHydrated(),
                workbenchNodeCount: state.workbenchNodes.length,
                collabSessionActive: state.collabSessionActive,
            },
            id
        );
    });
    // zustand persist rehydrates from IndexedDB asynchronously; until it
    // finishes we cannot know whether a cache exists for this project.
    const [persistHydrated, setPersistHydrated] = useState(() => useStore.persist.hasHydrated());
    useEffect(() => {
        if (useStore.persist.hasHydrated()) {
            setPersistHydrated(true);
            return;
        }
        const unsubscribe = useStore.persist.onFinishHydration(() => setPersistHydrated(true));
        return unsubscribe;
    }, []);
    useEffect(() => {
        if (!persistHydrated || isProjectReady) return;
        const state = useStore.getState();
        if (
            shouldPaintFromCache(
                {
                    lastOpenedProjectId: state.lastOpenedProjectId,
                    persistHydrated: true,
                    workbenchNodeCount: state.workbenchNodes.length,
                    collabSessionActive: state.collabSessionActive,
                },
                id
            )
        ) {
            setIsProjectReady(true);
        }
    }, [persistHydrated, id, isProjectReady]);
    const {
        setNodes,
        setConnections,
        setCurrentProjectId,
        setCurrentSceneVersion,
        setSceneHydrated,
        clearCollaborationState,
        setViewMode,
    } = useStore(
        useShallow((state) => ({
            setNodes: state.setWorkbenchNodes,
            setConnections: state.setConnections,
            setCurrentProjectId: state.setCurrentProjectId,
            setCurrentSceneVersion: state.setCurrentSceneVersion,
            setSceneHydrated: state.setSceneHydrated,
            clearCollaborationState: state.clearCollaborationState,
            setViewMode: state.setViewMode,
        }))
    );
    // Sprint 2: readiness rides the KB-sized lite variant — the full scene is
    // never on the critical path. The collab join (started by Workbench below)
    // streams the live document in parallel; only a terminally unavailable
    // session with no cache paint triggers the one-off full fetch.
    const { data: liteData, error } = useQuery<LiteProjectResponse>({
        queryKey: ["projects-lite", id],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${id}?lite=1`);
            if (!res.ok) throw new Error("Project not found");
            return res.json();
        },
    });

    const collabSessionActive = useStore((state) => state.collabSessionActive);
    const collabUnavailable = useStore((state) => state.collabUnavailable);
    const [fullScene, setFullScene] = useState<ProjectApiResponse | null>(null);
    // The provider's retry budget can take minutes to exhaust; after this
    // bounded wait a still-pending join no longer blocks single-user content.
    const [fallbackWaitElapsed, setFallbackWaitElapsed] = useState(false);

    useEffect(() => {
        if (!liteData || collabSessionActive) return;
        const timer = window.setTimeout(() => setFallbackWaitElapsed(true), COLLAB_FALLBACK_WAIT_MS);
        return () => window.clearTimeout(timer);
    }, [liteData, collabSessionActive]);

    useEffect(() => {
        if (!liteData) return;
        const outcome = settleCollabOutcome(
            collabSessionActive ? "active" : collabUnavailable ? "unavailable" : "pending",
            fallbackWaitElapsed,
        );
        if (resolveSceneHydration({ payloadKind: "lite", collabOutcome: outcome, paintedFromCache }) !== "fallback-fetch") {
            return;
        }
        let cancelled = false;
        fetch(`/api/projects/${id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (!cancelled && json) setFullScene(json);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [liteData, collabSessionActive, collabUnavailable, fallbackWaitElapsed, paintedFromCache, id]);

    // Keep the store's viewMode aligned with the URL segment. Runs after child
    // effects on mount, so hooks that detect the STUDIO -> WORKBENCH transition
    // (e.g. center-on-return) still observe the switch.
    useEffect(() => {
        setViewMode(activeView);
    }, [activeView, setViewMode]);

    useEffect(() => {
        // Set the current project ID in the store. This effect belongs to the
        // project-scoped layout and therefore does not run on view switches.
        setCurrentProjectId(id);
        // lastOpenedProjectId is intentionally NOT cleared on unmount: it tells
        // a future re-open which project the persisted workbenchNodes belong to
        // (stale-while-revalidate first paint, see projectReadiness.ts).
        useStore.setState({ lastOpenedProjectId: id });
        // T2.4: mint the collab room token in parallel with the scene fetch so
        // the later Workbench join doesn't pay a serial round-trip.
        prefetchRoomToken(id);

        return () => {
            // Clear the project ID when leaving the page
            // Note: We keep workbenchNodes so the dashboard can show previews
            setCurrentProjectId(null);
            setCurrentSceneVersion(0);
            setSceneHydrated(false);
            clearCollaborationState();
        };
    }, [id, setCurrentProjectId, setCurrentSceneVersion, setSceneHydrated, clearCollaborationState]);

    useEffect(() => {
        // While a collaboration session owns this scene, the shared document is
        // the source of truth — hydrating the (stale) DB snapshot into the store
        // would clobber live remote edits and flush them back. If the session
        // never joins (server down), this stays false and the single-user path
        // below runs unchanged.
        const state = useStore.getState();
        const collabOwnsScene = state.collabSessionActive;

        if (!collabOwnsScene && !paintedFromCache) {
            // Clear workbench nodes and connections first to avoid showing data from previous project.
            // Skipped when we already painted this project's cached nodes —
            // the server response below reconciles them instead.
            setNodes([]);
            setConnections([]);
        }

        // The full scene only exists on the fallback path; a lite payload never
        // hydrates (the live document or the cache paint owns the content).
        const scene = fullScene?.scene ?? null;
        const hydrateFromServer =
            !!scene &&
            !!fullScene &&
            resolveSceneHydration({
                payloadKind: "full",
                collabOutcome: collabOwnsScene ? "active" : "unavailable",
                paintedFromCache,
            }) === "hydrate" &&
            shouldHydrateFromServer({
                paintedFromCache,
                collabOwnsScene,
                localVersion: state.currentSceneVersion ?? null,
                serverVersion: fullScene.sceneVersion ?? null,
            });

        if (hydrateFromServer && scene) {
            // Hydrate the store with the project's scene data
            // Tag nodes with projectId so dashboard can filter them properly
            const nodesWithProjectId = scene.nodes?.map((node: WorkbenchNode) => ({
                ...node,
                projectId: id
            })) || [];
            if (nodesWithProjectId.length > 0) setNodes(nodesWithProjectId);
            if (scene.connections) setConnections(scene.connections as Connection[]);
        } else if (fullScene && !collabOwnsScene && !paintedFromCache) {
            // Older projects may predate the database-backed scene record. Restore
            // their locally cached Workbench nodes so the first autosave can migrate
            // them into the current main-scene persistence path instead of dropping
            // them during hydration.
            const cachedNodes = useStore.getState().projectNodes[id] ?? [];
            if (cachedNodes.length > 0) {
                setNodes(cachedNodes);
            }
        }

        if (liteData || fullScene) {
            // The lite payload carries the authoritative sceneVersion — no full
            // fetch needed to track it.
            const serverVersion = fullScene?.sceneVersion ?? liteData?.sceneVersion ?? 0;
            // Never downgrade: when we painted from cache with a strictly newer
            // local version, keep it so autosave continues from the right base.
            const localVersion = state.currentSceneVersion ?? 0;
            setCurrentSceneVersion(paintedFromCache && localVersion > serverVersion ? localVersion : serverVersion);
            // Signals useAutoSaveScene that local state now reflects this fetch, so any
            // interrupted save restored from IndexedDB can be applied on top of it.
            setSceneHydrated(true);
            setIsProjectReady(true);

            // Fire-and-forget view tracking: kept out of the GET (which is now
            // cacheable) — a failed ping must not affect the workspace.
            fetch(`/api/projects/${id}/viewed`, { method: "POST" }).catch(() => undefined);
        }
    }, [liteData, fullScene, setNodes, setConnections, setCurrentSceneVersion, setSceneHydrated, id, paintedFromCache]);

    if (!isProjectReady && !error) {
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
                    <p className="text-zinc-500">The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
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

    return (
        <div className="relative h-screen w-screen overflow-hidden">
            {/* Workbench stays mounted across view switches on purpose: the
                collaboration session (WebSocket + Y.Doc) lives inside it, and
                unmounting would tear down / re-join the room on every switch.
                It is only hidden — not removed — while Studio is active. */}
            <div
                className={activeView === "WORKBENCH" ? "absolute inset-0 z-10" : "pointer-events-none invisible absolute inset-0 z-0"}
                aria-hidden={activeView !== "WORKBENCH"}
            >
                <Workbench active={activeView === "WORKBENCH"} />
            </div>
            {/* Studio is unmounted when inactive (not just CSS-hidden). Its Konva
                canvas, ~15 selector-less store subscribers, and stage/resize
                listeners otherwise stay live during workbench node drags — the
                dominant source of heap growth + listener churn. Both view chunks
                are preloaded at idle (see lib/viewImports.ts), so mounting it on
                switch-in does not flash; the image-transition overlay rides on
                document.body and is completed from CanvasViewport's mount effect. */}
            {activeView === "STUDIO" && (
                <div className="absolute inset-0 z-10">
                    <Studio active />
                </div>
            )}
        </div>
    );
}
