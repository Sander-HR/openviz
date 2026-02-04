import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer as KonvaLayer, Line, Rect, Circle, Image as KonvaImage } from 'react-konva';
import { useStore } from '../store/useStore';
import Konva from 'konva';
import useImage from 'use-image';
import ToolContextMenu from './ToolContextMenu';

const URLImage = ({ src, x, y, width, height }: any) => {
    const [image] = useImage(src, "anonymous");
    return <KonvaImage image={image} x={x} y={y} width={width} height={height} />;
};

const CanvasViewport = () => {
    const {
        project,
        toolSettings,
        activeLayerId,
        updateLayer,
        setZoom,
        setPan,
        pushHistory,
        previewingRender,
        setViewMode,
        saveCurrentToWorkbench
    } = useStore();


    const stageRef = useRef<Konva.Stage>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

    // New state for shape previews
    const [previewShape, setPreviewShape] = useState<any | null>(null);

    const { canvas } = project;

    const isInsideCanvas = (x: number, y: number) => {
        return x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height;
    };

    const fitToScreen = useCallback(() => {
        if (!stageRef.current) return;
        const padding = 100; // More padding to avoid being under sidebars/toolbars
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;

        const scaleX = (containerWidth - padding * 2) / canvas.width;
        const scaleY = (containerHeight - padding * 2) / canvas.height;
        const newScale = Math.min(scaleX, scaleY); // Fill as much as possible

        const x = (containerWidth - canvas.width * newScale) / 2;
        const y = (containerHeight - canvas.height * newScale) / 2;

        setZoom(newScale);
        setPan(x, y);
    }, [canvas.width, canvas.height, setZoom, setPan]);

    const getFlattenedCanvas = useCallback(() => {
        if (!stageRef.current) return "";

        const stage = stageRef.current;

        // 1. Save current transform to restore later
        const oldAttrs = {
            x: stage.x(),
            y: stage.y(),
            scaleX: stage.scaleX(),
            scaleY: stage.scaleY()
        };

        try {
            // 2. Reset stage to identity to capture the full canvas area correctly
            // This bypasses any viewport clipping or panning offsets
            stage.setAttrs({
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1
            });

            // Force a synchronous draw of all layers
            stage.draw();

            // 3. Capture the project area at a reasonable thumbnail resolution
            const dataURL = stage.toDataURL({
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height,
                pixelRatio: 256 / canvas.width // Downscale to ~256px width for performance
            });

            return dataURL;
        } catch (error) {
            console.error("Critical: Failed to generate thumbnail", error);
            return "";
        } finally {
            // 4. Restore the user's view immediately
            stage.setAttrs(oldAttrs);
            stage.batchDraw();
        }
    }, [canvas.width, canvas.height, canvas.panX, canvas.panY, canvas.zoomLevel]);

    // Expose functions to window for other components to call
    const updateLayerThumbnail = useCallback((layerId: string) => {
        if (!stageRef.current) return;
        const stage = stageRef.current;
        const layers = stage.getLayers();
        const layerNode = layers.find(l => l.id() === layerId);

        if (layerNode) {
            // Save current stage state
            const oldAttrs = {
                x: stage.x(),
                y: stage.y(),
                scaleX: stage.scaleX(),
                scaleY: stage.scaleY()
            };

            try {
                // Reset stage for capture to ensure we get the full canvas area at 1:1 local scale
                // This prevents zoom/pan from affecting the thumbnail capture
                stage.setAttrs({
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1
                });

                // Force a draw of the specific layer to ensure it's up to date
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
                // Restore stage state
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

    // Update thumbnails for layers that don't have them
    useEffect(() => {
        const updateAllThumbnails = async () => {
            if (!stageRef.current) return;
            project.layers.forEach(layer => {
                if (!layer.thumbnail) {
                    updateLayerThumbnail(layer.id);
                }
            });
        };

        // Delay to allow images to load
        const timer = setTimeout(updateAllThumbnails, 1000);
        return () => clearTimeout(timer);
    }, [project.layers.length, updateLayerThumbnail]);


    const handleMouseDown = (e: any) => {
        const mouseButton = e.evt.button;

        // Middle Mouse Button (1) - Panning
        if (mouseButton === 1) {
            stageRef.current?.startDrag();
            return;
        }

        // Left Mouse Button (0) - Drawing/Shapes
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

                updateLayer(activeLayerId, {
                    strokes: [...activeLayer.strokes, newStroke]
                });
            } else if (toolSettings.activeTool === 'circle' || toolSettings.activeTool === 'rectangle' || toolSettings.activeTool === 'line') {
                setPreviewShape({
                    tool: toolSettings.activeTool,
                    points: [relativePos.x, relativePos.y, relativePos.x, relativePos.y], // start x, y, current x, y
                    color: toolSettings.brushColor,
                    size: toolSettings.strokeWidth || 2,
                    opacity: toolSettings.brushOpacity / 100,
                    fill: toolSettings.shapeFill
                });
            } else if (toolSettings.activeTool === 'paintbucket') {
                // For MVP, paintbucket fills the whole layer background if empty or just adds a rect
                const fillRect = {
                    tool: 'rectangle' as any,
                    points: [0, 0, canvas.width, canvas.height],
                    color: 'transparent',
                    size: 0,
                    opacity: toolSettings.brushOpacity / 100,
                    hardness: 100,
                    fill: toolSettings.brushColor
                };
                updateLayer(activeLayerId, {
                    strokes: [...activeLayer.strokes, fillRect]
                });
                pushHistory();
                // Update thumbnail after fill
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

            // Generate thumbnail for active layer
            setTimeout(() => {
                if (activeLayerId) {
                    updateLayerThumbnail(activeLayerId);
                }
            }, 100); // Slightly more delay for performance
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
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const speed = 1.1;
        let newScale = e.evt.deltaY > 0 ? oldScale / speed : oldScale * speed;
        newScale = Math.max(0.1, Math.min(5, newScale));

        setZoom(newScale);

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.setAttrs(newPos);
        stage.scale({ x: newScale, y: newScale });
        setPan(newPos.x, newPos.y);
    };

    useEffect(() => {
        fitToScreen();
        window.addEventListener('resize', fitToScreen);
        return () => window.removeEventListener('resize', fitToScreen);
    }, []);

    // Render helper for strokes and shapes
    const renderStroke = (stroke: any, i: number) => {
        if (stroke.tool === 'brush' || stroke.tool === 'eraser') {
            return (
                <Line
                    key={i}
                    points={stroke.points}
                    stroke={stroke.color}
                    // Use a non-linear falloff for the core to make it softer at low/mid hardness
                    strokeWidth={Math.max(0.1, stroke.size * Math.pow(stroke.hardness / 100, 1.5))}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={
                        stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                    opacity={stroke.opacity}
                    shadowColor={stroke.color}
                    // Adjust blur to fill the rest of the intended brush size
                    shadowBlur={(stroke.size - (stroke.size * Math.pow(stroke.hardness / 100, 1.5))) / 2}
                    shadowOpacity={1}
                />
            );
        }
        if (stroke.tool === 'rectangle') {
            const x = Math.min(stroke.points[0], stroke.points[2]);
            const y = Math.min(stroke.points[1], stroke.points[3]);
            const w = Math.abs(stroke.points[2] - stroke.points[0]);
            const h = Math.abs(stroke.points[3] - stroke.points[1]);
            return (
                <Rect
                    key={i}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    stroke={stroke.color}
                    strokeWidth={stroke.size}
                    fill={stroke.fill === 'transparent' ? undefined : stroke.fill}
                    opacity={stroke.opacity}
                />
            );
        }
        if (stroke.tool === 'circle') {
            const x = stroke.points[0];
            const y = stroke.points[1];
            const radius = Math.sqrt(
                Math.pow(stroke.points[2] - stroke.points[0], 2) +
                Math.pow(stroke.points[3] - stroke.points[1], 2)
            );
            return (
                <Circle
                    key={i}
                    x={x}
                    y={y}
                    radius={radius}
                    stroke={stroke.color}
                    strokeWidth={stroke.size}
                    fill={stroke.fill === 'transparent' ? undefined : stroke.fill}
                    opacity={stroke.opacity}
                />
            );
        }
        if (stroke.tool === 'line') {
            return (
                <Line
                    key={i}
                    points={stroke.points}
                    stroke={stroke.color}
                    strokeWidth={stroke.size}
                    opacity={stroke.opacity}
                />
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full bg-[#f0f0f2] overflow-hidden">
            <Stage
                width={window.innerWidth}
                height={window.innerHeight}
                name="background-stage"
                onMouseDown={handleMouseDown}
                onMousemove={handleMouseMove}
                onMouseup={handleMouseUp}
                onDblClick={(e) => {
                    console.log('Double click on stage background. Exit to workbench.');
                    if (e.target === stageRef.current || e.target.name() === 'background-stage') {
                        const thumbnail = getFlattenedCanvas();
                        saveCurrentToWorkbench(thumbnail);
                        setViewMode('WORKBENCH');
                    }
                }}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}
                ref={stageRef}
                scaleX={canvas.zoomLevel}
                scaleY={canvas.zoomLevel}
                x={canvas.panX}
                y={canvas.panY}
                draggable={toolSettings.activeTool === 'select'}
                onDragEnd={(e) => {
                    setPan(e.target.x(), e.target.y());
                }}
            >
                <KonvaLayer>
                    <Rect
                        width={canvas.width}
                        height={canvas.height}
                        fill={canvas.backgroundColor}
                        stroke="#dfdfdf"
                        strokeWidth={1 / canvas.zoomLevel}
                        shadowBlur={20}
                        shadowColor="rgba(0,0,0,0.1)"
                        shadowOffset={{ x: 0, y: 4 }}
                        name="bg-rect"
                    />

                </KonvaLayer>

                {project.layers.map((layer) => (
                    <KonvaLayer
                        key={layer.id}
                        id={layer.id}
                        visible={layer.visible}
                        opacity={layer.opacity / 100}
                        clipX={0}
                        clipY={0}
                        clipWidth={canvas.width}
                        clipHeight={canvas.height}
                    >
                        {layer.image && (
                            <URLImage
                                src={layer.image}
                                x={0}
                                y={0}
                                width={canvas.width}
                                height={canvas.height}
                            />
                        )}
                        {layer.strokes.map((stroke, i) => renderStroke(stroke, i))}
                    </KonvaLayer>
                ))}

                <KonvaLayer>
                    {previewShape && renderStroke(previewShape, -1)}
                </KonvaLayer>

                {previewingRender && (
                    <KonvaLayer
                        clipX={0}
                        clipY={0}
                        clipWidth={canvas.width}
                        clipHeight={canvas.height}
                    >
                        <URLImage
                            src={previewingRender}
                            x={0}
                            y={0}
                            width={canvas.width}
                            height={canvas.height}
                        />
                    </KonvaLayer>
                )}

            </Stage>

            {contextMenu && (
                <ToolContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    tool={toolSettings.activeTool}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
};

export default CanvasViewport;
