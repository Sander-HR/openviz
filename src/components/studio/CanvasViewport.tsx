import { useEffect } from 'react';
import { Stage, Layer as KonvaLayer, Line, Rect, Circle, Image as KonvaImage } from 'react-konva';
import { useStore } from '../../store/useStore';
import useImage from 'use-image';
import { ToolContextMenu } from './ToolContextMenu';
import { useCanvasViewport } from '../hooks/useCanvasViewport';

const URLImage = ({ src, x, y, width, height }: any) => {
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

export const CanvasViewport = () => {
    const {
        project,
        toolSettings,
        setPan,
        previewingRender,
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
        fitToScreen
    } = useCanvasViewport();

    useEffect(() => {
        fitToScreen();
        window.addEventListener('resize', fitToScreen);
        return () => window.removeEventListener('resize', fitToScreen);
    }, [fitToScreen]);

    return (
        <div className="w-full h-full bg-[#f0f0f2] overflow-hidden">
            <Stage
                width={window.innerWidth}
                height={window.innerHeight}
                name="background-stage"
                onMouseDown={handleMouseDown}
                onMousemove={handleMouseMove}
                onMouseup={handleMouseUp}
                onClick={(e) => {
                    if (e.target === stageRef.current || e.target.name() === 'background-stage') {
                        handleExitStudio();
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
                        {layer.strokes.map((stroke, i) => (
                            <RenderStroke key={i} stroke={stroke} i={i} />
                        ))}
                    </KonvaLayer>
                ))}

                <KonvaLayer>
                    {previewShape && <RenderStroke stroke={previewShape} i={-1} />}
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
