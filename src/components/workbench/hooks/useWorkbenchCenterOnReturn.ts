import { useEffect, useRef } from "react";
import { WorkbenchNode } from "@/types";

type CenterOnReturnOptions = {
    viewMode: "STUDIO" | "WORKBENCH";
    activeNodeId: string | null;
    workbenchNodes: WorkbenchNode[];
    setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
};

function getNodeSize(node: WorkbenchNode) {
    let width = node.width;
    let height = node.height;

    if ((node.type === "image" || node.type === "video") && typeof node.scale === "number") {
        width = node.project.canvas.width * node.scale;
        height = node.project.canvas.height * node.scale;
    }

    const normalizedWidth = Number.isFinite(width) && (width as number) > 0 ? (width as number) : 256;
    const normalizedHeight = Number.isFinite(height) && (height as number) > 0 ? (height as number) : 256;

    return {
        width: normalizedWidth,
        height: normalizedHeight,
    };
}

export function useWorkbenchCenterOnReturn({
    viewMode,
    activeNodeId,
    workbenchNodes,
    setCenter,
}: CenterOnReturnOptions) {
    const prevViewModeRef = useRef(viewMode);

    useEffect(() => {
        if (viewMode === "WORKBENCH" && prevViewModeRef.current === "STUDIO" && activeNodeId) {
            const node = workbenchNodes.find((candidate) => candidate.id === activeNodeId);
            if (node) {
                const { width, height } = getNodeSize(node);
                const centerX = node.x + width / 2;
                const centerY = node.y + height / 2;
                setCenter(centerX, centerY, { zoom: 1, duration: 500 });
            }
        }

        prevViewModeRef.current = viewMode;
    }, [viewMode, activeNodeId, workbenchNodes, setCenter]);
}
