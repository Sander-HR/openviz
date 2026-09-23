import { useEffect } from "react";

import { TOOL_SHORTCUT_MAP } from "@/store/workbenchTools";
import type { WorkbenchToolType } from "@/types";

type UseWorkbenchKeyboardShortcutsOptions = {
    copyToClipboard: () => void;
    pasteFromClipboard: (pos: { x: number; y: number }) => void;
    duplicateWorkbenchNode: () => void;
    removeWorkbenchNode: () => void;
    reorderWorkbenchNode: (id: string, direction: "front" | "back") => void;
    activeNodeId: string | null;
    selectedNodeIds: string[];
    getMousePosition: () => { x: number; y: number };
    screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
    setActiveWorkbenchTool: (tool: WorkbenchToolType) => void;
    undoWorkbench: () => void;
    redoWorkbench: () => void;
    panViewport: (direction: "up" | "down" | "left" | "right") => void;
    zoomIn: () => void;
    zoomOut: () => void;
    fitView: () => void;
    resetView: () => void;
    zoomTo100: () => void;
    clearSelection: () => void;
};

export function useWorkbenchKeyboardShortcuts({
    copyToClipboard,
    pasteFromClipboard,
    duplicateWorkbenchNode,
    removeWorkbenchNode,
    reorderWorkbenchNode,
    activeNodeId,
    selectedNodeIds,
    getMousePosition,
    screenToFlowPosition,
    setActiveWorkbenchTool,
    undoWorkbench,
    redoWorkbench,
    panViewport,
    zoomIn,
    zoomOut,
    fitView,
    resetView,
    zoomTo100,
    clearSelection,
}: UseWorkbenchKeyboardShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.target instanceof HTMLElement && e.target.isContentEditable) return;

            const isMod = e.ctrlKey || e.metaKey;

            if (e.key === "Escape") {
                e.preventDefault();
                clearSelection();
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                panViewport(e.key.slice(5).toLowerCase() as "up" | "down" | "left" | "right");
            } else if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                zoomIn();
            } else if (e.key === "-") {
                e.preventDefault();
                zoomOut();
            } else if (e.shiftKey && e.key === "1" && !isMod) {
                e.preventDefault();
                fitView();
            } else if (e.shiftKey && e.key === "0" && !isMod) {
                e.preventDefault();
                zoomTo100();
            } else if (e.shiftKey && e.key.toLowerCase() === "r" && !isMod) {
                e.preventDefault();
                resetView();
            } else if (isMod && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    redoWorkbench();
                } else {
                    undoWorkbench();
                }
            } else if (isMod && e.key.toLowerCase() === "y") {
                e.preventDefault();
                redoWorkbench();
            } else if (isMod && e.key === "c") {
                copyToClipboard();
            } else if (isMod && e.key === "v") {
                const mousePosition = getMousePosition();
                const pos = screenToFlowPosition({ x: mousePosition.x, y: mousePosition.y });
                pasteFromClipboard(pos);
            } else if (isMod && e.key === "d") {
                e.preventDefault();
                duplicateWorkbenchNode();
            } else if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedNodeIds.length > 0) {
                    removeWorkbenchNode();
                }
            } else if (e.key === "[") {
                if (activeNodeId) reorderWorkbenchNode(activeNodeId, "back");
            } else if (e.key === "]") {
                if (activeNodeId) reorderWorkbenchNode(activeNodeId, "front");
            } else if (!isMod) {
                // Single source of truth for tool keys — see workbenchTools.ts (T007).
                const tool = TOOL_SHORTCUT_MAP[e.key.toLowerCase()];
                if (tool) {
                    e.preventDefault();
                    setActiveWorkbenchTool(tool);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode,
        reorderWorkbenchNode,
        activeNodeId,
        selectedNodeIds,
        getMousePosition,
        screenToFlowPosition,
        setActiveWorkbenchTool,
        undoWorkbench,
        redoWorkbench,
        panViewport,
        zoomIn,
        zoomOut,
        fitView,
        resetView,
        zoomTo100,
        clearSelection,
    ]);
}
