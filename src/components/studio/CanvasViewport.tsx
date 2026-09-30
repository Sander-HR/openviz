import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { Stage, Layer as KonvaLayer, Line, Rect, Circle, Image as KonvaImage, Transformer, Group } from 'react-konva';
import { useStore } from '../../store/useStore';
import useImage from 'use-image';
import { ToolContextMenu } from './ToolContextMenu';
import { useCanvasViewport } from '../hooks/useCanvasViewport';
import type { Layer } from '../../types';
import { createAdjustmentsFilter, hasAdjustments } from '../../types/adjustments';
import { completeImageCanvasTransition } from '@/services/workbench/imageCanvasTransition';

interface URLImageProps {
    src: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
}

const URLImage = ({ src, x, y, width, height }: URLImageProps) => {
    const [image] = useImage(src, "anonymous");
    return <KonvaImage image={image} x={x} y={y} width={width} height={height} />;
};

const RenderStroke = ({ stroke, i }: { stroke: any, i: number }) => {
    if (stroke.tool === 'brush' || stroke.tool === 'eraser') {
        return (
            <Line
                key={i}
                points={stroke.points}
                stroke={stroke.color}
                strokeWidth={Math.max(0.1, stroke.size * Math.pow(stroke.hardness / 100, 1.5))}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={stroke.tool === 'eraser' ? 'destination-out' : 'source-over'}
                opacity={stroke.opacity}
                shadowColor={stroke.color}
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

interface LayerGroupProps {
    layer: Layer;
    activeLayerId: string | null;
    activeTool: string;
    previewShape: any | null;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    canvasWidth: number;
    canvasHeight: number;
}

const LayerGroup = ({ layer, activeLayerId, activeTool, previewShape, updateLayer, canvasWidth, canvasHeight }: LayerGroupProps) => {
    const groupRef = useRef<Konva.Group>(null);
    const width = layer.width ?? canvasWidth;
    const height = layer.height ?? canvasHeight;
    const filterEnabled = layer.id === activeLayerId && layer.adjustmentsEnabled !== false && hasAdjustments(layer.adjustments);

    useEffect(() => {
        const group = groupRef.current;
        if (!group) return;
        group.clearCache();
        group.filters(filterEnabled && layer.adjustments ? [createAdjustmentsFilter(layer.adjustments)] : []);
        if (filterEnabled) group.cache({ x: 0, y: 0, width, height, pixelRatio: 1 });
        group.getLayer()?.batchDraw();
    }, [filterEnabled, height, layer.adjustments, width]);

    return (
        <Group
            ref={groupRef}
            id={layer.id}
            x={layer.x}
            y={layer.y}
            width={width}
            height={height}
            rotation={layer.rotation}
            scaleX={layer.scaleX}
            scaleY={layer.scaleY}
            draggable={activeTool === 'select' && activeLayerId === layer.id}
            onDragEnd={(event) => {
                updateLayer(layer.id, { x: event.target.x(), y: event.target.y() });
                setTimeout(() => (window as unknown as { updateLayerThumbnail?: (id: string) => void }).updateLayerThumbnail?.(layer.id), 100);
            }}
            onTransformEnd={(event) => {
                const node = event.target;
                updateLayer(layer.id, { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
                setTimeout(() => (window as unknown as { updateLayerThumbnail?: (id: string) => void }).updateLayerThumbnail?.(layer.id), 100);
            }}
        >
            {layer.image && <URLImage src={layer.image} x={0} y={0} width={width} height={height} />}
            {layer.strokes.map((stroke, index) => <RenderStroke key={index} stroke={stroke} i={index} />)}
            {previewShape && activeLayerId === layer.id && <RenderStroke stroke={previewShape} i={-1} />}
        </Group>
    );
};

interface CanvasViewportProps {
    onRasterizeReady?: (rasterize: () => boolean) => void;
}

export const CanvasViewport = ({ onRasterizeReady }: CanvasViewportProps) => {
    const {
        project,
        toolSettings,
        setPan,
        previewingRender,
        isPreviewVisible,
        activeLayerId,
        updateLayer,
        setActiveLayer
    } = useStore();

    const {
        stageRef,
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
        rasterizeActiveLayer,
        fitToScreen
    } = useCanvasViewport();

    useEffect(() => {
        const revealTimer = window.setTimeout(completeImageCanvasTransition, 220);
        return () => window.clearTimeout(revealTimer);
    }, []);

    useEffect(() => {
        onRasterizeReady?.(rasterizeActiveLayer);
    }, [onRasterizeReady, rasterizeActiveLayer]);

    const transformerRef = useRef<any>(null);

    useEffect(() => {
        fitToScreen();
        window.addEventListener('resize', fitToScreen);
        return () => window.removeEventListener('resize', fitToScreen);
    }, [fitToScreen]);

    useEffect(() => {
        if (toolSettings.activeTool === 'select' && activeLayerId && transformerRef.current) {
            const stage = stageRef.current?.getStage();
            // Search for the Group by ID (which is the layer ID)
            const selectedNode = stage?.findOne('#' + activeLayerId);
            if (selectedNode) {
                transformerRef.current.nodes([selectedNode]);
                transformerRef.current.getLayer()?.batchDraw();
            } else {
                 transformerRef.current.nodes([]);
            }
        } else {
             transformerRef.current?.nodes([]);
        }
    }, [activeLayerId, toolSettings.activeTool, project.layers]);

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
                    const target = e.target;
                    // If double clicked on the stage background (the void), exit studio
                    if (target === stageRef.current || target.name() === 'background-stage') {
                        handleExitStudio();
                    }
                }}
                onClick={(e) => {
                    const target = e.target;
                    
                    // If clicked on the stage background (the void)
                    if (target === stageRef.current || target.name() === 'background-stage') {
                        // If tool is select, deselect active layer
                        if (toolSettings.activeTool === 'select') {
                            setActiveLayer(null);
                        }
                        return;
                    }

                    // If tool is select, handle layer selection
                    if (toolSettings.activeTool === 'select') {
                        // If clicked on the canvas background (bg-rect), deselect
                        if (target.name() === 'bg-rect') {
                            setActiveLayer(null);
                        } else {
                            // If clicked on a layer content, find the parent Group which holds the Layer ID
                            const group = target.getParent();
                            if (group && group.id()) {
                                setActiveLayer(group.id());
                            }
                        }
                    }
                }}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}
                ref={stageRef}
                scaleX={canvas.zoomLevel}
                scaleY={canvas.zoomLevel}
                x={canvas.panX}
                y={canvas.panY}
                draggable={toolSettings.activeTool === 'select' && !activeLayerId} // Only pan if no layer selected? Or use middle click?
                onDragEnd={(e) => {
                    // Only update pan if dragging stage
                    if (e.target === stageRef.current) {
                        setPan(e.target.x(), e.target.y());
                    }
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
                        visible={layer.visible}
                        opacity={layer.opacity / 100}
                        clipX={0}
                        clipY={0}
                        clipWidth={canvas.width}
                        clipHeight={canvas.height}
                    >
                        <LayerGroup
                            layer={layer}
                            activeLayerId={activeLayerId}
                            activeTool={toolSettings.activeTool}
                            previewShape={previewShape}
                            updateLayer={updateLayer}
                            canvasWidth={canvas.width}
                            canvasHeight={canvas.height}
                        />
                    </KonvaLayer>
                ))}

                <KonvaLayer>
                    <Transformer
                        ref={transformerRef}
                        boundBoxFunc={(oldBox, newBox) => {
                            if (newBox.width < 5 || newBox.height < 5) {
                                return oldBox;
                            }
                            return newBox;
                        }}
                        enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                        keepRatio={true}
                    />
                </KonvaLayer>

                {previewingRender && isPreviewVisible && (
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
