import { useCallback, useState, useRef, useEffect } from 'react';
import { OnNodesChange, OnConnect, Connection, Node, useReactFlow } from '@xyflow/react';
import { useStore } from '../../../store/useStore';
import { WorkbenchNode } from '../../../types';

export const useWorkbench = () => {
    const {
        workbenchNodes,
        connections,
        updateWorkbenchNode,
        addWorkbenchNode,
        removeWorkbenchNode,
        duplicateWorkbenchNode,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        openNodeInStudio,
        activeNodeId,
        setActiveNodeId,
        selectedNodeIds,
        setSelectedNodeIds,
        addConnection,
        createSketchWithFormat,
    } = useStore();

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
    const [showFormatDropdown, setShowFormatDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [basicBlocksMenu, setBasicBlocksMenu] = useState<{ visible: boolean; x: number; y: number; sourceNodeId: string } | null>(null);
    const connectionStart = useRef<{ nodeId: string; handleType: string } | null>(null);

    const sketchFormats = [
        { label: '1:1 Square', width: 1024, height: 1024 },
        { label: '2:3 Portrait', width: 682, height: 1024 },
        { label: '3:2 Landscape', width: 1024, height: 682 },
        { label: '16:9 Wide', width: 1024, height: 576 },
        { label: '9:16 Tall', width: 576, height: 1024 },
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Element)) {
                setShowFormatDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFormatSelect = (width: number, height: number) => {
        createSketchWithFormat(width, height);
        setShowFormatDropdown(false);
    };

    const mousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        const newSelection: string[] = [...selectedNodeIds];
        let selectionChanged = false;

        changes.forEach((change) => {
            if (change.type === 'position' && change.position) {
                updateWorkbenchNode(change.id, {
                    x: change.position.x,
                    y: change.position.y,
                });
            } else if (change.type === 'select') {
                const index = newSelection.indexOf(change.id);
                if (change.selected && index === -1) {
                    newSelection.push(change.id);
                    selectionChanged = true;
                } else if (!change.selected && index !== -1) {
                    newSelection.splice(index, 1);
                    selectionChanged = true;
                }
            } else if (change.type === 'remove') {
                removeWorkbenchNode(change.id);
            }
        });

        if (selectionChanged) {
            setSelectedNodeIds(newSelection);
        }

        return changes;
    }, [updateWorkbenchNode, removeWorkbenchNode, setSelectedNodeIds, selectedNodeIds]);

    const { screenToFlowPosition } = useReactFlow();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const isMod = e.ctrlKey || e.metaKey;

            if (isMod && e.key === 'c') {
                copyToClipboard();
            } else if (isMod && e.key === 'v') {
                const pos = screenToFlowPosition({ x: mousePos.current.x, y: mousePos.current.y });
                pasteFromClipboard(pos);
            } else if (isMod && e.key === 'd') {
                e.preventDefault();
                duplicateWorkbenchNode();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNodeIds.length > 0) {
                    removeWorkbenchNode();
                }
            } else if (e.key === '[') {
                if (activeNodeId) reorderWorkbenchNode(activeNodeId, 'back');
            } else if (e.key === ']') {
                if (activeNodeId) reorderWorkbenchNode(activeNodeId, 'front');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        copyToClipboard, 
        pasteFromClipboard, 
        duplicateWorkbenchNode, 
        removeWorkbenchNode, 
        reorderWorkbenchNode, 
        activeNodeId, 
        selectedNodeIds, 
        screenToFlowPosition
    ]);

    const handleConnect: OnConnect = useCallback((params: Connection) => {
        if (params.source && params.target) {
            addConnection(params.source, params.target);
        }
    }, [addConnection]);

    const onConnectStart = useCallback((_: any, { nodeId, handleType }: any) => {
        connectionStart.current = { nodeId, handleType };
    }, []);

    const onConnectEnd = useCallback((event: any) => {
        if (!connectionStart.current) return;
        const nodeElement = event.target.closest('.react-flow__node');
        if (nodeElement) {
            const targetNodeId = nodeElement.getAttribute('data-id');
            const targetNode = workbenchNodes.find((n: any) => n.id === targetNodeId);
            if (targetNode?.type === 'image' && connectionStart.current.handleType === 'target') {
                addConnection(targetNode.id, connectionStart.current.nodeId);
            }
        }
        connectionStart.current = null;
    }, [workbenchNodes, addConnection]);

    const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
        const workbenchNode = workbenchNodes.find((n: any) => n.id === node.id);
        if (workbenchNode?.type === 'image') {
            openNodeInStudio(node.id);
        }
    }, [workbenchNodes, openNodeInStudio]);

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    }, []);

    const handlePaneClick = useCallback(() => {
        setActiveNodeId(null);
        setBasicBlocksMenu(null);
    }, [setActiveNodeId]);

    const handleSourceClick = useCallback((nodeId: string) => {
        const sourceNode = workbenchNodes.find((n: any) => n.id === nodeId);
        if (sourceNode) {
            const rect = document.querySelector(`[data-id="${nodeId}"]`)?.getBoundingClientRect();
            if (rect) {
                setBasicBlocksMenu({
                    visible: true,
                    x: rect.right + 15,
                    y: rect.top + rect.height / 2,
                    sourceNodeId: nodeId,
                });
            }
        }
    }, [workbenchNodes]);

    const handleBlockSelect = useCallback((type: 'modify' | 'animate' | 'variate' | 'render') => {
        if (!basicBlocksMenu || (type !== 'animate' && type !== 'render')) {
            setBasicBlocksMenu(null);
            return;
        }

        const sourceNode = workbenchNodes.find((n: any) => n.id === basicBlocksMenu.sourceNodeId);
        if (!sourceNode) {
            setBasicBlocksMenu(null);
            return;
        }

        if (type === 'render') {
            const newNodeId = crypto.randomUUID();
            const newNode = {
                id: newNodeId,
                type: 'render',
                x: sourceNode.x + sourceNode.width + 100,
                y: sourceNode.y,
                width: 320,
                height: 500,
                data: {
                    prompt: '',
                    stylePreset: 'Photorealistic',
                    drawingInfluence: 0.65,
                    numImages: 1,
                },
            };
            addWorkbenchNode(newNode as WorkbenchNode);
            addConnection(basicBlocksMenu.sourceNodeId, newNodeId);
            setBasicBlocksMenu(null);
            return;
        }

        const newNodeId = crypto.randomUUID();
        const newNode = {
            id: newNodeId,
            type: 'animate',
            x: sourceNode.x + sourceNode.width + 100,
            y: sourceNode.y + (sourceNode.height - 320) / 2,
            width: 320,
            height: 320,
            data: {
                prompt: '',
                frames: { start: sourceNode.id },
                settings: { model: 'default', duration: '2s' },
            },
        };
        addWorkbenchNode(newNode as WorkbenchNode);
        addConnection(basicBlocksMenu.sourceNodeId, newNodeId);
        setBasicBlocksMenu(null);
    }, [basicBlocksMenu, workbenchNodes, addWorkbenchNode, addConnection]);

    const handleResize = useCallback((nodeId: string, width: number, height: number) => {
        updateWorkbenchNode(nodeId, { width, height });
    }, [updateWorkbenchNode]);

    return {
        workbenchNodes,
        connections,
        activeNodeId,
        selectedNodeIds,
        contextMenu,
        setContextMenu,
        showFormatDropdown,
        setShowFormatDropdown,
        dropdownRef,
        basicBlocksMenu,
        sketchFormats,
        handleFormatSelect,
        handleNodesChange,
        handleConnect,
        onConnectStart,
        onConnectEnd,
        handleNodeDoubleClick,
        handleNodeContextMenu,
        handlePaneClick,
        handleSourceClick,
        handleBlockSelect,
        handleResize,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode
    };
};
