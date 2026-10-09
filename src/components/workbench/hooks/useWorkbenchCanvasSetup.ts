import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store/useStore';
import { startImageCanvasTransition } from '@/services/workbench/imageCanvasTransition';
import { useAutoSaveScene } from '@/hooks/useAutoSaveScene';
import { useWorkbenchAddNodeCreation } from './useWorkbenchAddNodeCreation';
import { useWorkbenchMediaUpload } from './useWorkbenchMediaUpload';
import { useResizeObserverWarningSuppression } from './useResizeObserverWarningSuppression';
import { useWorkbench } from './useWorkbench';
import type { ResizeSnapStateRef } from './nodeSnapLogic';
import { useWorkbenchCollabSession } from './useWorkbenchCollabSession';
import { useCollabPresencePublisher } from './useCollabPresencePublisher';
import { useSceneStream } from './useSceneStream';

interface WorkbenchCanvasSetupOptions {
    active: boolean;
    flowWrapperRef: RefObject<HTMLDivElement | null>;
    screenToFlowPosition: ReturnType<typeof useReactFlow>['screenToFlowPosition'];
    /** Shared live-resize snap state (created by the canvas, read on resize commit). */
    resizeSnapStateRef?: ResizeSnapStateRef;
}

export function useWorkbenchCanvasSetup({
    active,
    flowWrapperRef,
    screenToFlowPosition,
    resizeSnapStateRef,
}: WorkbenchCanvasSetupOptions) {
    const { getNode, setCenter } = useReactFlow();
    const router = useRouter();
    const studioTransitionActiveRef = useRef(false);
    const [isTransitioningToStudio, setIsTransitioningToStudio] = useState(false);
    const { viewMode, currentProjectId, createOneShotNode, createSketchWithFormat } = useStore(
        useShallow((state) => ({
            viewMode: state.viewMode,
            currentProjectId: state.currentProjectId,
            createOneShotNode: state.createOneShotNode,
            createSketchWithFormat: state.createSketchWithFormat,
        }))
    );
    const sceneHydrated = useStore((state) => state.sceneHydrated);

    useEffect(() => {
        if (currentProjectId) router.prefetch(`/projects/${currentProjectId}/studio`);
    }, [currentProjectId, router]);

    const openNodeInStudioWithTransition = useCallback(async (nodeId: string) => {
        if (studioTransitionActiveRef.current) return;

        const node = getNode(nodeId);
        const container = flowWrapperRef.current;
        if (!node || !currentProjectId) {
            if (currentProjectId) router.push(`/projects/${currentProjectId}/studio`);
            return;
        }

        if (!container) {
            useStore.getState().openNodeInStudio(nodeId);
            router.push(`/projects/${currentProjectId}/studio`);
            return;
        }

        const width = node.measured?.width ?? node.width ?? 0;
        const height = node.measured?.height ?? node.height ?? 0;
        if (width <= 0 || height <= 0) {
            useStore.getState().openNodeInStudio(nodeId);
            router.push(`/projects/${currentProjectId}/studio`);
            return;
        }

        studioTransitionActiveRef.current = true;
        setIsTransitioningToStudio(true);
        const targetZoom = Math.max(
            0.1,
            Math.min(20, Math.min(container.clientWidth / width, container.clientHeight / height))
        );

        useStore.getState().openNodeInStudio(nodeId);
        const workbenchNode = useStore.getState().workbenchNodes.find((candidate) => candidate.id === nodeId);
        if (workbenchNode?.type === 'image' || workbenchNode?.type === 'video') {
            const drawable = document.querySelector(`[data-workbench-drawable="${nodeId}"]`);
            if (drawable instanceof HTMLElement) startImageCanvasTransition(drawable, workbenchNode.project);
        }

        try {
            void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
                zoom: targetZoom,
                duration: 350,
            });
        } finally {
            window.setTimeout(() => router.push(`/projects/${currentProjectId}/studio`), 40);
            window.setTimeout(() => {
                studioTransitionActiveRef.current = false;
                setIsTransitioningToStudio(false);
            }, 400);
        }
    }, [currentProjectId, flowWrapperRef, getNode, router, setCenter]);

    useAutoSaveScene(currentProjectId);
    useSceneStream(currentProjectId, active);
    const collabSession = useWorkbenchCollabSession();
    const mediaUpload = useWorkbenchMediaUpload({
        flowWrapperRef,
        screenToFlowPosition,
        makeOneShotNode: createOneShotNode,
    });
    const nodeLocks = useStore((state) => state.nodeLocks);
    const presenceByUser = useStore((state) => state.presenceByUser);

    useCollabPresencePublisher({
        provider: collabSession.provider,
        userId: collabSession.userId,
        userName: collabSession.userName,
        containerRef: flowWrapperRef,
        toWorld: screenToFlowPosition,
    });
    useResizeObserverWarningSuppression();

    const workbench = useWorkbench({
        enabled: active,
        ...(collabSession.active
            ? { undoAction: collabSession.undo, redoAction: collabSession.redo, commands: collabSession.commands }
            : {}),
        onUploadImage: mediaUpload.handleMediaUpload,
        onUploadFromPhone: mediaUpload.handleMediaUploadFromPhone,
        onOpenNodeInStudio: openNodeInStudioWithTransition,
        resizeSnapStateRef,
    });
    const { handleCreateNode } = useWorkbenchAddNodeCreation({
        flowWrapperRef,
        screenToFlowPosition,
        addWorkbenchNode: workbench.actions.addWorkbenchNode,
        createOneShotNode,
        createSketchWithFormat,
        onMediaUpload: mediaUpload.handleMediaUpload,
    });

    return {
        currentProjectId,
        sceneHydrated,
        viewMode,
        isTransitioningToStudio,
        collabSession,
        nodeLocks,
        presenceByUser,
        mediaUpload,
        workbench,
        createOneShotNode,
        createSketchWithFormat,
        handleCreateNode,
        openNodeInStudioWithTransition,
    };
}
