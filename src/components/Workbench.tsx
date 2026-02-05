import React, { useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Image as KonvaImage, Line, Circle, Path } from 'react-konva';

const SNAP_THRESHOLD = 5;

interface SnapLine {
    vertical: boolean;
    guide: number;
    offset: number; // The offset of the node edge from the node's top-left
    start: number; // For visual line drawing
    end: number;
    snappedTo: string[]; // IDs of nodes we snapped to
}
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

const ScaleHandle = ({ x, y, cursor, onDragMove, scale }: { x: number; y: number; cursor: string; onDragMove: (e: any) => void }) => (
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
        onDragEnd={(e) => {
            e.cancelBubble = true;
        }}
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

// --- Snapping Helper Functions ---

const getLineGuideStops = (skipId: string, nodes: any[]) => {
    const vertical: any[] = [];
    const horizontal: any[] = [];

    // "Stops" are the lines we can snap to (from other nodes)
    nodes.forEach((node) => {
        if (node.id === skipId) return;

        // Vertical Stops (x-axis)
        // Left, Center, Right
        vertical.push({ guide: node.x, snap: 'start', id: node.id });
        vertical.push({ guide: node.x + node.width / 2, snap: 'center', id: node.id });
        vertical.push({ guide: node.x + node.width, snap: 'end', id: node.id });

        // Horizontal Stops (y-axis)
        // Top, Center, Bottom
        horizontal.push({ guide: node.y, snap: 'start', id: node.id });
        horizontal.push({ guide: node.y + node.height / 2, snap: 'center', id: node.id });
        horizontal.push({ guide: node.y + node.height, snap: 'end', id: node.id });
    });

    return { vertical, horizontal };
};

const getObjectSnappingEdges = (node: any) => {
    // "Edges" are the lines on the DRAGGED node that want to snap
    return {
        vertical: [
            { guide: node.x, offset: 0, snap: 'start' },
            { guide: node.x + node.width / 2, offset: node.width / 2, snap: 'center' },
            { guide: node.x + node.width, offset: node.width, snap: 'end' },
        ],
        horizontal: [
            { guide: node.y, offset: 0, snap: 'start' },
            { guide: node.y + node.height / 2, offset: node.height / 2, snap: 'center' },
            { guide: node.y + node.height, offset: node.height, snap: 'end' },
        ],
    };
};

const getGuides = (lineGuideStops: any, itemBounds: any) => {
    const resultV: any[] = [];
    const resultH: any[] = [];

    // Check vertical snaps
    lineGuideStops.vertical.forEach((stop: any) => {
        itemBounds.vertical.forEach((bound: any) => {
            if (Math.abs(stop.guide - bound.guide) < SNAP_THRESHOLD) {
                resultV.push({
                    lineGuide: stop.guide,
                    diff: stop.guide - bound.guide,
                    snap: bound.snap,
                    offset: bound.offset,
                    snappedTo: stop.id
                });
            }
        });
    });

    // Check horizontal snaps
    lineGuideStops.horizontal.forEach((stop: any) => {
        itemBounds.horizontal.forEach((bound: any) => {
            if (Math.abs(stop.guide - bound.guide) < SNAP_THRESHOLD) {
                resultH.push({
                    lineGuide: stop.guide,
                    diff: stop.guide - bound.guide,
                    snap: bound.snap,
                    offset: bound.offset,
                    snappedTo: stop.id
                });
            }
        });
    });

    // Find best snap (closest)
    const minV = resultV.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0];
    const minH = resultH.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0];

    return { resultV: minV, resultH: minH };
};

const Workbench: React.FC = () => {
    const {
        workbenchNodes,
        connections,
        openNodeInStudio,
        updateWorkbenchNode,
        createNewSketch,
        activeNodeId,
        setActiveNodeId,
        removeWorkbenchNode,
        duplicateWorkbenchNode,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        addWorkbenchNode,
        addConnection
    } = useStore();

    const stageRef = useRef<any>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [gridPattern, setGridPattern] = useState<HTMLImageElement | null>(null);
    const [activeMenuNodeId, setActiveMenuNodeId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);

    const imageNodes = workbenchNodes.filter(n => n.type === 'image') as ImageNode[];
    const animateNodes = workbenchNodes.filter(n => n.type === 'animate') as AnimateNodeType[];

    // Snapping state
    const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
    const [snappedNodeIds, setSnappedNodeIds] = useState<string[]>([]);

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
        const majorColor = "#858585ff";
        const minorColor = "#b6b6b6ff";

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

    const handleNodeDragMove = (e: any, id: string) => {
        setSnapLines([]);
        setSnappedNodeIds([]);

        const node = e.target;
        // Group x/y are the current dragged positions
        const currentNode = workbenchNodes.find(n => n.id === id);
        if (!currentNode) return;

        const draggedNode = {
            id: id,
            x: node.x(),
            y: node.y(),
            width: currentNode.width,
            height: currentNode.height
        };

        const stops = getLineGuideStops(id, workbenchNodes);
        const edges = getObjectSnappingEdges(draggedNode);
        const guides = getGuides(stops, edges);

        const newSnapLines: SnapLine[] = [];
        const snappedIds: string[] = [];

        if (guides.resultV) {
            const snap = guides.resultV;
            node.x(snap.lineGuide - snap.offset);
            newSnapLines.push({
                vertical: true,
                guide: snap.lineGuide,
                offset: snap.offset,
                start: -10000,
                end: 10000,
                snappedTo: [snap.snappedTo]
            });
            snappedIds.push(snap.snappedTo);
        }

        if (guides.resultH) {
            const snap = guides.resultH;
            node.y(snap.lineGuide - snap.offset);
            newSnapLines.push({
                vertical: false,
                guide: snap.lineGuide,
                offset: snap.offset,
                start: -10000,
                end: 10000,
                snappedTo: [snap.snappedTo]
            });
            snappedIds.push(snap.snappedTo);
        }

        setSnapLines(newSnapLines);
        setSnappedNodeIds(snappedIds);
    };

    const handleNodeDragEnd = (id: string, e: any) => {
        // Clear guides
        setSnapLines([]);
        setSnappedNodeIds([]);

        // Ensure we only update if the Group itself is being dragged
        // For Animate nodes it might be a Rect or Group depending on how they are hit-tested
        // But the main draggable element is usually a Group
        updateWorkbenchNode(id, {
            x: e.target.x(),
            y: e.target.y(),
        });
    };

    // Handle scale change should keep aspect ratio of image
    const handleScaleMove = (id: string, corner: 'tl' | 'tr' | 'bl' | 'br', e: any) => {
        const node = workbenchNodes.find(n => n.id === id);
        if (!node) return;

        const pos = e.target.position(); // Relative to Group origin
        const aspectRatio = node.width / node.height;
        const minSize = 100;

        let newWidth = node.width;
        let newHeight = node.height;
        let newX = node.x;
        let newY = node.y;

        // Simplify scaling: Anchor the opposite corner and drive everything by the drag width
        if (corner === 'br') {
            // Anchor is (x, y)
            newWidth = Math.max(minSize, pos.x + 6);
            newHeight = newWidth / aspectRatio;
            e.target.x(newWidth - 6);
            e.target.y(newHeight - 6);
        } else if (corner === 'tr') {
            // Anchor is (x, y + h)
            const anchorY = node.y + node.height;
            newWidth = Math.max(minSize, pos.x + 6);
            newHeight = newWidth / aspectRatio;
            newY = anchorY - newHeight;
            e.target.x(newWidth - 6);
            e.target.y(-6);
        } else if (corner === 'bl') {
            // Anchor is (x + w, y)
            const anchorX = node.x + node.width;
            newWidth = Math.max(minSize, node.width - (pos.x + 6));
            newX = anchorX - newWidth;
            newHeight = newWidth / aspectRatio;
            e.target.x(-6);
            e.target.y(newHeight - 6);
        } else if (corner === 'tl') {
            // Anchor is (x + w, y + h)
            const anchorX = node.x + node.width;
            const anchorY = node.y + node.height;
            newWidth = Math.max(minSize, node.width - (pos.x + 6));
            newX = anchorX - newWidth;
            newHeight = newWidth / aspectRatio;
            newY = anchorY - newHeight;
            e.target.x(-6);
            e.target.y(-6);
        }

        updateWorkbenchNode(id, { x: newX, y: newY, width: newWidth, height: newHeight });
    };

    const handleStageClick = (e: any) => {
        // if click on empty area - deselect all
        if (e.target === stageRef.current) {
            setActiveNodeId(null);
            setSelectedNodeId(null);
        }
    };

    const handlePlusClick = (e: any, id: string) => {
        e.cancelBubble = true;
        setActiveMenuNodeId(id);
    };

    const handleMenuSelect = (type: string) => {
        if (!activeMenuNodeId) return;

        const fromNode = workbenchNodes.find(n => n.id === activeMenuNodeId);
        if (!fromNode) return;

        const newNodeId = Math.random().toString(36).substr(2, 9);
        const newNode: AnimateNodeType = {
            id: newNodeId,
            type: 'animate',
            x: fromNode.x + fromNode.width + 100,
            y: fromNode.y,
            width: 320,
            height: 180,
            data: {
                prompt: '',
                frames: {},
                settings: {
                    model: 'stable-video-diffusion',
                    duration: '4s'
                }
            }
        };

        addWorkbenchNode(newNode);
        addConnection(activeMenuNodeId, newNodeId);
        setActiveMenuNodeId(null);
    };

    const handleContextMenu = (e: any, id: string) => {
        if (e.evt) e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (pointer) {
            setContextMenu({
                x: pointer.x,
                y: pointer.y,
                nodeId: id
            });
        }
    };

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

    const renderSnapLines = () => {
        if (snapLines.length === 0) return null;

        // Viewport dimensions for infinite lines
        const startX = -position.x / scale;
        const startY = -position.y / scale;
        const viewportWidth = window.innerWidth / scale;
        const viewportHeight = window.innerHeight / scale;

        return (
            <Group listening={false}>
                {snapLines.map((line, i) => {
                    const points = line.vertical
                        ? [line.guide, startY, line.guide, startY + viewportHeight]
                        : [startX, line.guide, startX + viewportWidth, line.guide];

                    return (
                        <Line
                            key={i}
                            points={points}
                            stroke="#ff0000"
                            strokeWidth={1 / scale}
                            dash={[4 / scale, 4 / scale]}
                        />
                    );
                })}
            </Group>
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
                            onDragMove={(e) => handleNodeDragMove(e, node.id)}
                            onDragEnd={(e) => handleNodeDragEnd(node.id, e)}
                            onDblClick={() => openNodeInStudio(node.id)}
                            onTap={() => {
                                setActiveNodeId(node.id);
                                // If already selected, double tap opens
                                if (activeNodeId === node.id) openNodeInStudio(node.id);
                            }}
                            onClick={() => setActiveNodeId(node.id)}
                            onMouseDown={() => setActiveNodeId(node.id)}
                        >
                            {/* Paper Background */}
                            <Rect
                                width={node.width}
                                height={node.height}
                                fill="white"
                                stroke={
                                    activeNodeId === node.id
                                        ? "#3b82f6"
                                        : snappedNodeIds.includes(node.id)
                                            ? "#ff0000" // Highlight snapped target
                                            : "transparent"
                                }
                                strokeWidth={activeNodeId === node.id ? 5 / scale : snappedNodeIds.includes(node.id) ? 3 / scale : 0}
                                shadowBlur={15}
                                shadowColor="rgba(0,0,0,0.1)"
                                shadowOffset={{ x: 0, y: 5 }}
                                cornerRadius={4}
                            />
                            {/* Project Content / Thumbnail */}
                            <NodeImage
                                key={node.id + (node.project.thumbnail || '')}
                                src={node.project.thumbnail}
                                width={node.width}
                                height={node.height}
                            />
                            {/* Label - Only show when selected */}
                            {activeNodeId === node.id && (
                                <Text
                                    text={node.project.name}
                                    y={node.height + 8}
                                    width={node.width}
                                    align="left"
                                    fontSize={14}
                                    fontFamily="Inter, sans-serif"
                                    fill="#3682ebff"
                                />
                            )}

                            {/* Resize Handles (4 corners) - Only show when selected */}
                            {activeNodeId === node.id && (
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
                            onDragMove={(e) => handleNodeDragMove(e, node.id)}
                            onDragEnd={(e) => handleNodeDragEnd(node.id, e)}
                            onContextMenu={(e) => handleContextMenu(e, node.id)}
                            onClick={() => setSelectedNodeId(node.id)}
                            onMouseDown={() => setSelectedNodeId(node.id)}
                            onMouseEnter={(e: any) => {
                                const stage = e.target.getStage();
                                if (stage) {
                                    const container = stage.container();
                                    container.style.cursor = 'move';
                                }
                            }}
                            onMouseLeave={(e: any) => {
                                const stage = e.target.getStage();
                                if (stage) {
                                    const container = stage.container();
                                    container.style.cursor = 'default';
                                }
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
                <Layer>
                    {renderSnapLines()}
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
