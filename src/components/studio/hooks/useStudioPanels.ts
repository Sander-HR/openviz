import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLLAPSED_RESULTS_HEIGHT = 140;
const RENDER_PANEL_MAX = 500;
const RENDER_PANEL_MIN = 200;
const RESULTS_PANEL_MIN = 100;
const RESULTS_PANEL_MAX = 400;

type StudioPanelsOptions = {
    resultsPanelOpen: boolean;
};

export function useStudioPanels({ resultsPanelOpen }: StudioPanelsOptions) {
    const [expandedRenderHeight, setExpandedRenderHeight] = useState(320);
    const [expandedResultsHeight, setExpandedResultsHeight] = useState(200);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartY = useRef(0);
    const startRenderHeight = useRef(0);
    const startResultsHeight = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const containerHeightRef = useRef(0);

    const updateContainerHeight = useCallback(() => {
        if (containerRef.current) {
            containerHeightRef.current = containerRef.current.clientHeight - 5;
        }
    }, []);

    useEffect(() => {
        updateContainerHeight();
        window.addEventListener("resize", updateContainerHeight);
        return () => window.removeEventListener("resize", updateContainerHeight);
    }, [updateContainerHeight]);

    const { renderPanelHeight, resultsPanelHeight } = useMemo(() => {
        updateContainerHeight();
        const availableHeight = containerHeightRef.current;

        if (resultsPanelOpen) {
            const totalHeight = expandedRenderHeight + expandedResultsHeight;
            const renderHeight = Math.max(
                RENDER_PANEL_MIN,
                Math.min(RENDER_PANEL_MAX, (expandedRenderHeight / totalHeight) * availableHeight)
            );
            const resultsHeight = Math.max(
                RESULTS_PANEL_MIN,
                Math.min(RESULTS_PANEL_MAX, availableHeight - renderHeight)
            );
            return { renderPanelHeight: renderHeight, resultsPanelHeight: resultsHeight };
        }

        const renderHeight =
            availableHeight > 0
                ? Math.min(RENDER_PANEL_MAX, availableHeight - COLLAPSED_RESULTS_HEIGHT)
                : RENDER_PANEL_MAX;
        return {
            renderPanelHeight: Math.max(RENDER_PANEL_MIN, renderHeight),
            resultsPanelHeight: COLLAPSED_RESULTS_HEIGHT,
        };
    }, [resultsPanelOpen, expandedRenderHeight, expandedResultsHeight, updateContainerHeight]);

    const handleResizeStart = useCallback(
        (e: ReactMouseEvent) => {
            e.preventDefault();
            if (!resultsPanelOpen) return;
            setIsResizing(true);
            resizeStartY.current = e.clientY;
            startRenderHeight.current = expandedRenderHeight;
            startResultsHeight.current = expandedResultsHeight;
        },
        [resultsPanelOpen, expandedRenderHeight, expandedResultsHeight]
    );

    const handleResizeMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing || !resultsPanelOpen) return;

            const deltaY = e.clientY - resizeStartY.current;
            const newRenderHeight = Math.max(
                RENDER_PANEL_MIN,
                Math.min(RENDER_PANEL_MAX, startRenderHeight.current + deltaY)
            );
            const newResultsHeight = Math.max(
                RESULTS_PANEL_MIN,
                Math.min(RESULTS_PANEL_MAX, startResultsHeight.current - deltaY)
            );

            setExpandedRenderHeight(newRenderHeight);
            setExpandedResultsHeight(newResultsHeight);
        },
        [isResizing, resultsPanelOpen]
    );

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", handleResizeMove);
            window.addEventListener("mouseup", handleResizeEnd);
        }

        return () => {
            window.removeEventListener("mousemove", handleResizeMove);
            window.removeEventListener("mouseup", handleResizeEnd);
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    return {
        containerRef,
        renderPanelHeight,
        resultsPanelHeight,
        handleResizeStart,
    };
}
