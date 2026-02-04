import React, { useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Image as KonvaImage, Path, Circle } from 'react-konva';
import { useStore } from '../store/useStore';
import useImage from 'use-image';
import { Plus } from 'lucide-react';
import AnimateNode from './nodes/AnimateNode';
import BasicBlocksMenu from './nodes/BasicBlocksMenu';
import ContextMenu from './ContextMenu';
import { ImageNode, AnimateNode as AnimateNodeType } from '../types';


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
    const { workbenchNodes, connections, openNodeInStudio, updateWorkbenchNode, createNewSketch, addWorkbenchNode, addConnection } = useStore();
    const stageRef = useRef<any>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [gridPattern, setGridPattern] = useState<HTMLImageElement | null>(null);
    const [activeMenuNodeId, setActiveMenuNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);

    const {
        removeWorkbenchNode,
        duplicateWorkbenchNode,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        clipboard
    } = useStore();

    const imageNodes = workbenchNodes.filter(n => n.type === 'image') as ImageNode[];
    const animateNodes = workbenchNodes.filter(n => n.type === 'animate') as AnimateNodeType[];

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
        const minorColor = "#dcdcdcff";

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

        if (!node) return;

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
            setActiveMenuNodeId(null);
        }
    };

    const handlePlusClick = (e: any, nodeId: string) => {
        e.cancelBubble = true;
        setActiveMenuNodeId(activeMenuNodeId === nodeId ? null : nodeId);
    };

    const handleMenuSelect = (type: string) => {
        if (!activeMenuNodeId) return;
        const sourceNode = workbenchNodes.find(n => n.id === activeMenuNodeId);
        if (!sourceNode) return;

        if (type === 'animate') {
            const newNodeId = Math.random().toString(36).substr(2, 9);
            const newNode: AnimateNodeType = {
                id: newNodeId,
                type: 'animate',
                x: sourceNode.x + sourceNode.width + 100,
                y: sourceNode.y,
                width: 320,
                height: 400,
                data: {
                    prompt: '',
                    frames: { start: sourceNode.type === 'image' ? (sourceNode as ImageNode).project.thumbnail : undefined },
                    settings: { model: 'Standard v2', duration: '5 sec' }
                }
            };

            addWorkbenchNode(newNode);
            addConnection(sourceNode.id, newNodeId);
            setActiveMenuNodeId(null);
        }
    };

    const handleContextMenu = (e: any, nodeId: string) => {
        if (e.evt) e.evt.preventDefault();
        else e.preventDefault();

        // e.evt is present for Konva events, for HTML events use e
        const event = e.evt || e;
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            nodeId
        });
        setSelectedNodeId(nodeId);
    };

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if no input is focused
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNodeId) removeWorkbenchNode(selectedNodeId);
            } else if (e.key === ']') {
                if (selectedNodeId) reorderWorkbenchNode(selectedNodeId, 'front');
            } else if (e.key === '[') {
                if (selectedNodeId) reorderWorkbenchNode(selectedNodeId, 'back');
            } else if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'c':
                        if (selectedNodeId) copyToClipboard(selectedNodeId);
                        break;
                    case 'v':
                        if (clipboard) {
                            // Paste at cursor or center
                            const stage = stageRef.current;
                            if (stage) {
                                const pointer = stage.getPointerPosition() || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                                const pos = {
                                    x: (pointer.x - position.x) / scale,
                                    y: (pointer.y - position.y) / scale
                                };
                                pasteFromClipboard(pos);
                            }
                        }
                        break;
                    case 'd':
                        e.preventDefault();
                        if (selectedNodeId) duplicateWorkbenchNode(selectedNodeId);
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeId, clipboard, scale, position, removeWorkbenchNode, duplicateWorkbenchNode, reorderWorkbenchNode, copyToClipboard, pasteFromClipboard]);

    const contextMenuActions = contextMenu ? [
        { label: 'Wrap in section', onClick: () => console.log('Wrap in section'), divider: true },
        { label: 'Bring to front', shortcut: ']', onClick: () => reorderWorkbenchNode(contextMenu.nodeId, 'front') },
        { label: 'Send to back', shortcut: '[', onClick: () => reorderWorkbenchNode(contextMenu.nodeId, 'back'), divider: true },
        {
            label: 'Copy link to selection', shortcut: 'Ctrl+L', onClick: () => {
                // Just copy current URL for now as placeholder
                navigator.clipboard.writeText(window.location.href);
            }, divider: true
        },
        { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => copyToClipboard(contextMenu.nodeId) },
        {
            label: 'Paste', shortcut: 'Ctrl+V', onClick: () => {
                const stage = stageRef.current;
                if (stage) {
                    const pointer = stage.getPointerPosition() || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                    const pos = {
                        x: (pointer.x - position.x) / scale,
                        y: (pointer.y - position.y) / scale
                    };
                    pasteFromClipboard(pos);
                }
            }
        },
        { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: () => duplicateWorkbenchNode(contextMenu.nodeId), divider: true },
        { label: 'Delete', shortcut: 'Del', onClick: () => removeWorkbenchNode(contextMenu.nodeId), type: 'danger' as const },
    ] : [];

    const renderConnections = () => {
        return connections.map(conn => {
            const fromNode = workbenchNodes.find(n => n.id === conn.from);
            const toNode = workbenchNodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return null;

            const fromX = fromNode.x + fromNode.width;
            const fromY = fromNode.y + fromNode.height / 2;
            const toX = toNode.x;
            const toY = toNode.y + 70; // Connect to roughly the header area

            return (
                <ViewOnlyConnection
                    key={conn.id}
                    fromX={fromX}
                    fromY={fromY}
                    toX={toX}
                    toY={toY}
                />
            );
        });
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
                    {renderConnections()}
                    {imageNodes.map((node) => (
                        <Group
                            key={node.id}
                            x={node.x}
                            y={node.y}
                            draggable
                            onDragMove={(e) => handleDragMove(node.id, e)}
                            onDragEnd={(e) => handleDragMove(node.id, e)}
                            onContextMenu={(e) => handleContextMenu(e, node.id)}
                            onDblClick={() => openNodeInStudio(node.id)}
                            onTap={() => {
                                setSelectedNodeId(node.id);
                                // If already selected, double tap opens
                                if (selectedNodeId === node.id) openNodeInStudio(node.id);
                            }}
                            onClick={() => setSelectedNodeId(node.id)}
                            onMouseDown={() => setSelectedNodeId(node.id)}
                            onMouseEnter={(e) => {
                                setHoveredNodeId(node.id);
                                const container = e.target.getStage()?.container();
                                if (container && (selectedNodeId === node.id || hoveredNodeId === node.id)) {
                                    container.style.cursor = 'move';
                                }
                            }}
                            onMouseLeave={(e) => {
                                setHoveredNodeId(null);
                                const container = e.target.getStage()?.container();
                                if (container) container.style.cursor = 'default';
                            }}
                        >
                            {/* Paper Background */}
                            <Rect
                                width={node.width}
                                height={node.height}
                                fill="white"
                                stroke={(selectedNodeId === node.id || hoveredNodeId === node.id) ? "#3b82f6" : "transparent"}
                                strokeWidth={(hoveredNodeId === node.id) ? 6 / scale : 2 / scale}
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

                            {/* Plus Button - Only when selected */}
                            {selectedNodeId === node.id && (
                                <Group
                                    x={node.width}
                                    y={node.height / 2}
                                    onClick={(e) => handlePlusClick(e, node.id)}
                                    onMouseEnter={(e) => {
                                        const container = e.target.getStage()?.container();
                                        if (container) container.style.cursor = 'pointer';
                                    }}
                                    onMouseLeave={(e) => {
                                        const container = e.target.getStage()?.container();
                                        if (container) container.style.cursor = 'default';
                                    }}
                                >
                                    <Circle radius={12} fill="#6366f1" />
                                    <Path data="M-4 0 L4 0 M0 -4 L0 4" stroke="white" strokeWidth={2} x={0} y={0} />
                                </Group>
                            )}
                        </Group>
                    ))}
                    {animateNodes.map((node) => (
                        <Group // Transparent hit area for dragging Animate nodes
                            key={`hit-${node.id}`}
                            x={node.x}
                            y={node.y}
                            draggable
                            onDragMove={(e) => handleDragMove(node.id, e)}
                            onDragEnd={(e) => handleDragMove(node.id, e)}
                            onContextMenu={(e) => handleContextMenu(e, node.id)}
                            onClick={() => setSelectedNodeId(node.id)}
                            onMouseDown={() => setSelectedNodeId(node.id)}
                            onMouseEnter={(e) => {
                                setHoveredNodeId(node.id);
                                const container = e.target.getStage()?.container();
                                if (container) container.style.cursor = 'move';
                            }}
                            onMouseLeave={(e) => {
                                setHoveredNodeId(null);
                                const container = e.target.getStage()?.container();
                                if (container) container.style.cursor = 'default';
                            }}
                        >
                            <Rect
                                width={node.width}
                                height={node.height}
                                fill="transparent"
                            />
                        </Group>
                    ))}
                </Layer>
            </Stage>

            {/* Scale/Pan Overlay Layer for HTML Nodes */}
            <div
                className="absolute top-0 left-0 w-full h-full pointer-events-none origin-top-left"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                }}
            >
                {animateNodes.map(node => (
                    <div
                        key={node.id}
                        className="absolute pointer-events-none"
                        style={{
                            left: node.x,
                            top: node.y,
                            width: node.width,
                            height: node.height
                        }}
                    >
                        <AnimateNode
                            node={node}
                            selected={selectedNodeId === node.id}
                            updateNode={updateWorkbenchNode}
                        />
                    </div>
                ))}

                {activeMenuNodeId && (
                    <div
                        className="absolute pointer-events-auto"
                        style={{
                            left: (workbenchNodes.find(n => n.id === activeMenuNodeId)?.x || 0) + (workbenchNodes.find(n => n.id === activeMenuNodeId)?.width || 0) + 20,
                            top: (workbenchNodes.find(n => n.id === activeMenuNodeId)?.y || 0) + (workbenchNodes.find(n => n.id === activeMenuNodeId)?.height || 0) / 2 - 100
                        }}
                    >
                        <BasicBlocksMenu onSelect={handleMenuSelect} />
                    </div>
                )}
            </div>

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

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    actions={contextMenuActions}
                />
            )}
        </div >
    );
};

const ViewOnlyConnection = ({ fromX, fromY, toX, toY }: { fromX: number, fromY: number, toX: number, toY: number }) => {
    // Bezier curve
    const controlPointOffset = Math.abs(toX - fromX) * 0.5;

    return (
        <>
            <Path
                data={`M ${fromX} ${fromY} C ${fromX + controlPointOffset} ${fromY}, ${toX - controlPointOffset} ${toY}, ${toX} ${toY}`}
                stroke="#ccc"
                strokeWidth={2}
                fill="transparent"
                listening={false}
            />
            <Circle x={fromX} y={fromY} radius={4} fill="#6366f1" />
            <Circle x={toX} y={toY} radius={4} fill="#6366f1" />
        </>
    );
};

export default Workbench;
