import React, { useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Image as KonvaImage } from 'react-konva';
import { useStore } from '../store/useStore';
import useImage from 'use-image';
import { Plus } from 'lucide-react';


const NodeImage = ({ src, width, height }: { src?: string; width: number; height: number }) => {
    const [image] = useImage(src || '');
    if (!src || !image) {
        return <Rect width={width} height={height} fill="#f3f4f6" />;
    }
    return <KonvaImage image={image} width={width} height={height} />;
};

const ScaleHandle = ({ x, y, cursor, onDragMove }: { x: number; y: number; cursor: string; onDragMove: (e: any) => void }) => (
    <Rect
        x={x - 6}
        y={y - 6}
        width={12}
        height={12}
        fill="#3b82f6"
        stroke="white"
        strokeWidth={2}
        cornerRadius={2}
        draggable
        onDragMove={onDragMove}
        onMouseEnter={(e: any) => {
            const container = e.target.getStage().container();
            container.style.cursor = cursor;
        }}
        onMouseLeave={(e: any) => {
            const container = e.target.getStage().container();
            container.style.cursor = 'default';
        }}
    />
);

const Workbench: React.FC = () => {
    const { workbenchNodes, openNodeInStudio, updateWorkbenchNode, createNewSketch } = useStore();
    const stageRef = useRef<any>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [gridPattern, setGridPattern] = useState<HTMLImageElement | null>(null);

    // Create grid pattern
    React.useMemo(() => {
        const MAJOR_GRID = 100;
        const FINE_GRID = 25;
        const showFineDots = scale > 0.5;

        const canvas = document.createElement('canvas');
        canvas.width = MAJOR_GRID;
        canvas.height = MAJOR_GRID;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Colors from user edit
        const majorColor = "#c5c5c5ff";
        const minorColor = "#e4e4e4ff";

        // Draw major dot
        ctx.fillStyle = majorColor;
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw fine dots if zoomed in
        if (showFineDots) {
            ctx.fillStyle = minorColor;
            for (let x = 0; x < MAJOR_GRID; x += FINE_GRID) {
                for (let y = 0; y < MAJOR_GRID; y += FINE_GRID) {
                    if (x === 0 && y === 0) continue; // Skip major dot
                    ctx.beginPath();
                    ctx.arc(x, y, 0.75, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        const img = new Image();
        img.src = canvas.toDataURL();
        img.onload = () => setGridPattern(img);
    }, [scale > 0.5]); // Only recreate when threshold is crossed

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
        newScale = Math.max(0.1, Math.min(2, newScale));

        setScale(newScale);
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        setPosition(newPos);
    };

    const handleDragMove = (id: string, e: any) => {
        updateWorkbenchNode(id, {
            x: e.target.x(),
            y: e.target.y(),
        });
    };

    const handleScaleMove = (id: string, corner: 'tl' | 'tr' | 'bl' | 'br', e: any) => {
        const node = workbenchNodes.find(n => n.id === id);
        if (!node) return;

        const stage = e.target.getStage();
        const transform = e.target.getParent().getAbsoluteTransform().copy().invert();
        const pos = e.target.position();

        let newX = node.x;
        let newY = node.y;
        let newWidth = node.width;
        let newHeight = node.height;

        const minSize = 100;

        if (corner === 'br') {
            newWidth = Math.max(minSize, pos.x + 6);
            newHeight = Math.max(minSize, pos.y + 6);
            e.target.x(newWidth - 6);
            e.target.y(newHeight - 6);
        } else if (corner === 'tr') {
            const deltaY = pos.y + 6;
            newWidth = Math.max(minSize, pos.x + 6);
            newHeight = Math.max(minSize, node.height - deltaY);
            if (newHeight > minSize) {
                newY = node.y + deltaY;
            }
            e.target.x(newWidth - 6);
            e.target.y(-6);
        } else if (corner === 'bl') {
            const deltaX = pos.x + 6;
            newWidth = Math.max(minSize, node.width - deltaX);
            newHeight = Math.max(minSize, pos.y + 6);
            if (newWidth > minSize) {
                newX = node.x + deltaX;
            }
            e.target.x(-6);
            e.target.y(newHeight - 6);
        } else if (corner === 'tl') {
            const deltaX = pos.x + 6;
            const deltaY = pos.y + 6;
            newWidth = Math.max(minSize, node.width - deltaX);
            newHeight = Math.max(minSize, node.height - deltaY);
            if (newWidth > minSize) newX = node.x + deltaX;
            if (newHeight > minSize) newY = node.y + deltaY;
            e.target.x(-6);
            e.target.y(-6);
        }

        updateWorkbenchNode(id, {
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
        });
    };

    const handleStageClick = (e: any) => {
        // if click on empty area - deselect all
        if (e.target === stageRef.current) {
            setSelectedNodeId(null);
        }
    };

    // Grid rendering logic - Dotted grid notebook style using pattern fill for performance
    const renderGrid = () => {
        if (!gridPattern) return null;

        // Calculate visible area in local coordinates
        const startX = -position.x / scale;
        const startY = -position.y / scale;
        const width = window.innerWidth / scale;
        const height = window.innerHeight / scale;

        return (
            <Rect
                x={startX}
                y={startY}
                width={width}
                height={height}
                fillPatternImage={gridPattern}
                fillPatternX={0}
                fillPatternY={0}
                listening={false}
            />
        );
    };

    return (
        <div className="relative w-screen h-screen bg-white overflow-hidden">
            <Stage
                width={window.innerWidth}
                height={window.innerHeight}
                draggable
                onWheel={handleWheel}
                onClick={handleStageClick}
                onTap={handleStageClick}
                ref={stageRef}
                scaleX={scale}
                scaleY={scale}
                x={position.x}
                y={position.y}
                onDragEnd={(e) => {
                    if (e.target === stageRef.current) {
                        setPosition({ x: e.target.x(), y: e.target.y() });
                    }
                }}
            >
                <Layer>
                    {renderGrid()}
                </Layer>
                <Layer>
                    {workbenchNodes.map((node) => (
                        <Group
                            key={node.id}
                            x={node.x}
                            y={node.y}
                            draggable
                            onDragEnd={(e) => handleDragMove(node.id, e)}
                            onDblClick={() => openNodeInStudio(node.id)}
                            onTap={() => {
                                setSelectedNodeId(node.id);
                                // If already selected, double tap opens
                                if (selectedNodeId === node.id) openNodeInStudio(node.id);
                            }}
                            onClick={() => setSelectedNodeId(node.id)}
                            onMouseDown={() => setSelectedNodeId(node.id)}
                        >
                            {/* Paper Background */}
                            <Rect
                                width={node.width}
                                height={node.height}
                                fill="white"
                                stroke={selectedNodeId === node.id ? "#3b82f6" : "transparent"}
                                strokeWidth={2 / scale}
                                shadowBlur={15}
                                shadowColor="rgba(0,0,0,0.1)"
                                shadowOffset={{ x: 0, y: 5 }}
                                cornerRadius={4}
                            />
                            {/* Project Content / Thumbnail */}
                            <Group clipX={0} clipY={0} clipWidth={node.width} clipHeight={node.height}>
                                <NodeImage
                                    src={node.project.thumbnail}
                                    width={node.width}
                                    height={node.height}
                                />
                            </Group>
                            {/* Label */}
                            <Text
                                text={node.name}
                                y={node.height + 14}
                                width={node.width}
                                align="center"
                                fontSize={14}
                                fontFamily="Inter, sans-serif"
                                fill="#4b5563"
                            />

                            {/* Resize Handles (4 corners) - Only show when selected */}
                            {selectedNodeId === node.id && (
                                <>
                                    <ScaleHandle
                                        x={0}
                                        y={0}
                                        cursor="nwse-resize"
                                        onDragMove={(e) => handleScaleMove(node.id, 'tl', e)}
                                    />
                                    <ScaleHandle
                                        x={node.width}
                                        y={0}
                                        cursor="nesw-resize"
                                        onDragMove={(e) => handleScaleMove(node.id, 'tr', e)}
                                    />
                                    <ScaleHandle
                                        x={0}
                                        y={node.height}
                                        cursor="nesw-resize"
                                        onDragMove={(e) => handleScaleMove(node.id, 'bl', e)}
                                    />
                                    <ScaleHandle
                                        x={node.width}
                                        y={node.height}
                                        cursor="nwse-resize"
                                        onDragMove={(e) => handleScaleMove(node.id, 'br', e)}
                                    />
                                </>
                            )}
                        </Group>
                    ))}
                </Layer>
            </Stage>

            {/* Floating UI */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
                <button
                    onClick={createNewSketch}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all font-medium text-lg"
                >
                    <Plus size={24} strokeWidth={2.5} />
                    New Sketch
                </button>
            </div>
        </div>
    );
};

export default Workbench;
