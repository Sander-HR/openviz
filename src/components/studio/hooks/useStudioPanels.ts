import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLLAPSED_PANEL_HEIGHT = 40;
const RENDER_PANEL_MAX = 500;
const RENDER_PANEL_MIN = 200;
const RESULTS_PANEL_MIN = 280;
const RESULTS_PANEL_MAX = 400;
const RESIZE_HANDLE_HEIGHT = 5;
const PANEL_VERTICAL_PADDING = 16;
const PANEL_GAP = 1.6;
const PANEL_SPLIT_STORAGE_KEY = "openviz-studio-panel-split";

function readStoredHeight(key: "render" | "results", fallback: number) {
    if (typeof window === "undefined") return fallback;
    const stored = window.localStorage.getItem(PANEL_SPLIT_STORAGE_KEY);
    if (!stored) return fallback;

    try {
        const parsed = JSON.parse(stored) as Partial<Record<"render" | "results", number>>;
        return typeof parsed[key] === "number" && Number.isFinite(parsed[key]) ? parsed[key] : fallback;
    } catch {
        return fallback;
    }
}

type StudioPanelsOptions = {
    resultsPanelOpen: boolean;
    createPanelCollapsed: boolean;
};

export function useStudioPanels({ resultsPanelOpen, createPanelCollapsed }: StudioPanelsOptions) {
    const [expandedRenderHeight, setExpandedRenderHeight] = useState(320);
    const [expandedResultsHeight, setExpandedResultsHeight] = useState(200);
    const isInitialRender = useRef(true);
    const [isResizing, setIsResizing] = useState(false);
    const [containerHeight, setContainerHeight] = useState(0);
    const resizeStartY = useRef(0);
    const startRenderHeight = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const containerHeightRef = useRef(0);

    const updateContainerHeight = useCallback(() => {
        if (containerRef.current) {
            const hasResizeHandle = resultsPanelOpen && !createPanelCollapsed;
            const stackSpacing = PANEL_GAP + (hasResizeHandle ? PANEL_GAP + RESIZE_HANDLE_HEIGHT : 0);
            const nextHeight = Math.max(0, containerRef.current.clientHeight - PANEL_VERTICAL_PADDING - stackSpacing);
            containerHeightRef.current = nextHeight;
            setContainerHeight(nextHeight);
        }
    }, [createPanelCollapsed, resultsPanelOpen]);

    useEffect(() => {
        updateContainerHeight();
        window.addEventListener("resize", updateContainerHeight);
        return () => window.removeEventListener("resize", updateContainerHeight);
    }, [updateContainerHeight]);

    useEffect(() => {
        setExpandedRenderHeight(readStoredHeight("render", 320));
        setExpandedResultsHeight(readStoredHeight("results", 200));
    }, []);

    const { renderPanelHeight, resultsPanelHeight } = useMemo(() => {
        const availableHeight = containerHeight;

        if (createPanelCollapsed) {
            const collapsedRenderHeight = Math.min(COLLAPSED_PANEL_HEIGHT, availableHeight);
            return {
                renderPanelHeight: collapsedRenderHeight,
                resultsPanelHeight: resultsPanelOpen ? Math.max(0, availableHeight - collapsedRenderHeight) : Math.min(COLLAPSED_PANEL_HEIGHT, Math.max(0, availableHeight - collapsedRenderHeight)),
            };
        }

        if (resultsPanelOpen) {
            if (availableHeight <= RENDER_PANEL_MIN + RESULTS_PANEL_MIN) {
                return {
                    renderPanelHeight: Math.max(0, availableHeight - RESULTS_PANEL_MIN),
                    resultsPanelHeight: Math.min(availableHeight, RESULTS_PANEL_MIN),
                };
            }

            const totalHeight = expandedRenderHeight + expandedResultsHeight;
            const preferredRenderHeight = (expandedRenderHeight / totalHeight) * availableHeight;
            const minimumRenderHeight = Math.max(0, Math.max(RENDER_PANEL_MIN, availableHeight - RESULTS_PANEL_MAX));
            const maximumRenderHeight = Math.max(0, availableHeight - RESULTS_PANEL_MIN);
            const renderHeight = Math.min(
                maximumRenderHeight,
                Math.max(minimumRenderHeight, preferredRenderHeight)
            );
            const resultsHeight = availableHeight - renderHeight;
            return { renderPanelHeight: renderHeight, resultsPanelHeight: resultsHeight };
        }

        const renderHeight = Math.min(RENDER_PANEL_MAX, Math.max(0, availableHeight - COLLAPSED_PANEL_HEIGHT));
        return {
            renderPanelHeight: renderHeight,
            resultsPanelHeight: Math.min(COLLAPSED_PANEL_HEIGHT, Math.max(0, availableHeight - renderHeight)),
        };
    }, [containerHeight, resultsPanelOpen, createPanelCollapsed, expandedRenderHeight, expandedResultsHeight]);

    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }
        window.localStorage.setItem(PANEL_SPLIT_STORAGE_KEY, JSON.stringify({
            render: expandedRenderHeight,
            results: expandedResultsHeight,
        }));
    }, [expandedRenderHeight, expandedResultsHeight]);

    const handleResizeStart = useCallback(
        (e: ReactPointerEvent) => {
            e.preventDefault();
            if (!resultsPanelOpen) return;
            setIsResizing(true);
            resizeStartY.current = e.clientY;
            startRenderHeight.current = renderPanelHeight;
        },
        [resultsPanelOpen, renderPanelHeight, resultsPanelHeight]
    );

    const handleResizeMove = useCallback(
        (e: PointerEvent) => {
            if (!isResizing || !resultsPanelOpen) return;

            const deltaY = e.clientY - resizeStartY.current;
            const availableHeight = containerHeightRef.current;
            const minimumRenderHeight = Math.max(0, availableHeight - RESULTS_PANEL_MAX);
            const maximumRenderHeight = Math.max(0, availableHeight - RESULTS_PANEL_MIN);
            const newRenderHeight = Math.min(
                maximumRenderHeight,
                Math.max(minimumRenderHeight, startRenderHeight.current + deltaY)
            );
            const newResultsHeight = availableHeight - newRenderHeight;

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
            window.addEventListener("pointermove", handleResizeMove);
            window.addEventListener("pointerup", handleResizeEnd);
        }

        return () => {
            window.removeEventListener("pointermove", handleResizeMove);
            window.removeEventListener("pointerup", handleResizeEnd);
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    return {
        containerRef,
        renderPanelHeight,
        resultsPanelHeight,
        handleResizeStart,
    };
}
