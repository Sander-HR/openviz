import { useState, useRef, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { useStore } from '../../store/useStore';

export const useCanvasViewport = () => {
    const {
        project,
        toolSettings,
        activeLayerId,
        updateLayer,
        setZoom,
        setPan,
        pushHistory,
        setViewMode,
        saveCurrentToWorkbench,
        setExitingStudio
    } = useStore();

    const stageRef = useRef<Konva.Stage>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const [previewShape, setPreviewShape] = useState<any | null>(null);

    const { canvas } = project;

    const isInsideCanvas = (x: number, y: number) => {
        return x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height;
    };

    const fitToScreen = useCallback(() => {
        if (!stageRef.current) return;
        
        // Panel width (240px) + Gap (16px) + User Margin (20px) = 276px
        const horizontalOffset = 276;
        const verticalPadding = 60; // Safe margin for toolbar and bottom controls
        
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;

        const availableWidth = containerWidth - horizontalOffset * 2;
        const availableHeight = containerHeight - verticalPadding * 2;

        const scaleX = availableWidth / canvas.width;
        const scaleY = availableHeight / canvas.height;
        const newScale = Math.min(scaleX, scaleY, 1.5); // Cap zoom at 150% for fit

        const x = horizontalOffset + (availableWidth - canvas.width * newScale) / 2;
        const y = verticalPadding + (availableHeight - canvas.height * newScale) / 2;

        setZoom(newScale);
        setPan(x, y);
    }, [canvas.width, canvas.height, setZoom, setPan]);

    const getFlattenedCanvas = useCallback(() => {
        if (!stageRef.current) return "";
        const stage = stageRef.current;
        const oldAttrs = {
            x: stage.x(),
            y: stage.y(),
            scaleX: stage.scaleX(),
            scaleY: stage.scaleY()
        };

        try {
            stage.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
            stage.draw();
            const dataURL = stage.toDataURL({
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height,
                pixelRatio: 256 / canvas.width
            });
            return dataURL;
        } catch (error) {
            console.error("Critical: Failed to generate thumbnail", error);
            return "";
        } finally {
            stage.setAttrs(oldAttrs);
            stage.batchDraw();
        }
    }, [canvas.width, canvas.height]);

    const updateLayerThumbnail = useCallback((layerId: string) => {
        if (!stageRef.current) return;
        const stage = stageRef.current;
        const layers = stage.getLayers();
        const layerNode = layers.find(l => l.id() === layerId);

        if (layerNode) {
            const oldAttrs = {
                x: stage.x(),
                y: stage.y(),
                scaleX: stage.scaleX(),
                scaleY: stage.scaleY()
            };

            try {
                stage.setAttrs({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
                layerNode.draw();
                const thumb = layerNode.toDataURL({
                    x: 0,
                    y: 0,
                    width: canvas.width,
                    height: canvas.height,
                    pixelRatio: 256 / Math.max(canvas.width, canvas.height)
                });
                updateLayer(layerId, { thumbnail: thumb });
            } catch (e) {
                console.warn('Failed to update thumbnail for layer', layerId, e);
            } finally {
                stage.setAttrs(oldAttrs);
                stage.batchDraw();
            }
        }
    }, [canvas.width, canvas.height, updateLayer]);

    useEffect(() => {
        (window as any).fitToScreen = fitToScreen;
        (window as any).getFlattenedCanvas = getFlattenedCanvas;
        (window as any).updateLayerThumbnail = updateLayerThumbnail;
        return () => {
            delete (window as any).fitToScreen;
            delete (window as any).getFlattenedCanvas;
            delete (window as any).updateLayerThumbnail;
        };
    }, [fitToScreen, getFlattenedCanvas, updateLayerThumbnail]);

    useEffect(() => {
        const updateAllThumbnails = async () => {
            if (!stageRef.current) return;
            project.layers.forEach(layer => {
                if (!layer.thumbnail) {
                    updateLayerThumbnail(layer.id);
                }
            });
        };
        const timer = setTimeout(updateAllThumbnails, 1000);
        return () => clearTimeout(timer);
    }, [project.layers.length, updateLayerThumbnail]);

    const handleMouseDown = (e: any) => {
        const mouseButton = e.evt.button;
        if (mouseButton === 1) {
            stageRef.current?.startDrag();
            return;
        }
        if (mouseButton === 0) {
            if (toolSettings.activeTool === 'select' || !activeLayerId) return;
            const activeLayer = project.layers.find(l => l.id === activeLayerId);
            if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;

            const stage = e.target.getStage();
            const pos = stage.getPointerPosition();
            const transform = stage.getAbsoluteTransform().copy().invert();
            const relativePos = transform.point(pos);

            if (!isInsideCanvas(relativePos.x, relativePos.y)) return;
            setIsDrawing(true);

            if (toolSettings.activeTool === 'brush' || toolSettings.activeTool === 'eraser') {
                const newStroke = {
                    tool: toolSettings.activeTool,
                    points: [relativePos.x, relativePos.y],
                    color: toolSettings.brushColor,
                    size: toolSettings.activeTool === 'brush' ? toolSettings.brushSize : toolSettings.eraserSize,
                    opacity: (toolSettings.activeTool === 'brush' ? toolSettings.brushOpacity : 100) / 100,
                    hardness: toolSettings.brushHardness,
                    fill: 'transparent'
                };
                updateLayer(activeLayerId, { strokes: [...activeLayer.strokes, newStroke] });
            } else if (['circle', 'rectangle', 'line'].includes(toolSettings.activeTool)) {
                setPreviewShape({
                    tool: toolSettings.activeTool,
                    points: [relativePos.x, relativePos.y, relativePos.x, relativePos.y],
                    color: toolSettings.brushColor,
                    size: toolSettings.strokeWidth || 2,
                    opacity: toolSettings.brushOpacity / 100,
                    fill: toolSettings.shapeFill
                });
            } else if (toolSettings.activeTool === 'paintbucket') {
                const fillRect = {
                    tool: 'rectangle' as any,
                    points: [0, 0, canvas.width, canvas.height],
                    color: 'transparent',
                    size: 0,
                    opacity: toolSettings.brushOpacity / 100,
                    hardness: 100,
                    fill: toolSettings.brushColor
                };
                updateLayer(activeLayerId, { strokes: [...activeLayer.strokes, fillRect] });
                pushHistory();
                setTimeout(() => updateLayerThumbnail(activeLayerId), 10);
            }
        }
    };

    const handleMouseMove = (e: any) => {
        if (!isDrawing || !activeLayerId) return;
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;
        const transform = stage.getAbsoluteTransform().copy().invert();
        const relativePos = transform.point(pos);

        if (toolSettings.activeTool === 'brush' || toolSettings.activeTool === 'eraser') {
            const activeLayer = project.layers.find(l => l.id === activeLayerId);
            if (!activeLayer) return;
            const lastStroke = activeLayer.strokes[activeLayer.strokes.length - 1];
            if (!lastStroke) return;
            const newStrokes = [...activeLayer.strokes];
            newStrokes[newStrokes.length - 1] = {
                ...lastStroke,
                points: [...lastStroke.points, relativePos.x, relativePos.y]
            };
            updateLayer(activeLayerId, { strokes: newStrokes });
        } else if (previewShape) {
            setPreviewShape({
                ...previewShape,
                points: [previewShape.points[0], previewShape.points[1], relativePos.x, relativePos.y]
            });
        }
    };

    const handleMouseUp = () => {
        if (isDrawing) {
            if (previewShape) {
                const activeLayer = project.layers.find(l => l.id === activeLayerId);
                if (activeLayer && activeLayerId) {
                    updateLayer(activeLayerId, {
                        strokes: [...activeLayer.strokes, { ...previewShape, hardness: 100 }]
                    });
                }
                setPreviewShape(null);
            }
            setIsDrawing(false);
            pushHistory();
            setTimeout(() => {
                if (activeLayerId) updateLayerThumbnail(activeLayerId);
            }, 100);
        }
    };

    const handleContextMenu = (e: any) => {
        e.evt.preventDefault();
        setContextMenu({ x: e.evt.clientX, y: e.evt.clientY });
    };

    const handleWheel = (e: any) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        
        const oldScale = stage.scaleX();
        
        // Use center of screen for zooming instead of pointer
        const center = {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        };

        const mousePointTo = {
            x: (center.x - stage.x()) / oldScale,
            y: (center.y - stage.y()) / oldScale,
        };

        const speed = 1.1;
        let newScale = e.evt.deltaY > 0 ? oldScale / speed : oldScale * speed;
        newScale = Math.max(0.1, Math.min(5, newScale));
        
        setZoom(newScale);
        
        const newPos = {
            x: center.x - mousePointTo.x * newScale,
            y: center.y - mousePointTo.y * newScale,
        };
        
        stage.setAttrs(newPos);
        stage.scale({ x: newScale, y: newScale });
        setPan(newPos.x, newPos.y);
    };

    const handleExitStudio = async () => {
        if (!stageRef.current) return;
        setExitingStudio(true);
        const exitScale = 0.15;
        const exitX = (window.innerWidth - canvas.width * exitScale) / 2;
        const exitY = (window.innerHeight - canvas.height * exitScale) / 2;

        stageRef.current.to({
            x: exitX,
            y: exitY,
            scaleX: exitScale,
            scaleY: exitScale,
            duration: 0.4,
            easing: Konva.Easings.EaseInOut
        });

        await new Promise(resolve => setTimeout(resolve, 400));
        setZoom(exitScale);
        setPan(exitX, exitY);
        const thumbnail = getFlattenedCanvas();
        saveCurrentToWorkbench(thumbnail);
        setViewMode('WORKBENCH');
        setTimeout(() => setExitingStudio(false), 100);
    };

    return {
        stageRef,
        isDrawing,
        contextMenu,
        setContextMenu,
        previewShape,
        canvas,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleContextMenu,
        handleWheel,
        handleExitStudio,
        fitToScreen
    };
};
