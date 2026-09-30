import { useCallback, useState } from 'react';

import { WorkbenchNode } from '@/types';
import { generateUUID } from '@/utils/uuid';

import {
    createAnimateNodeFromSource,
    createModifyNodeFromSource,
    createRenderNodeFromSource,
} from './workbenchBlockCreationLogic';

export type BasicBlocksMenuState = {
    visible: boolean;
    x: number;
    y: number;
    sourceNodeId: string;
} | null;

type UseWorkbenchBlockCreationOptions = {
    workbenchNodes: WorkbenchNode[];
    addWorkbenchNode: (node: WorkbenchNode) => void;
    addConnection: (
        fromId: string,
        toId: string,
        sourceHandle?: string | null,
        targetHandle?: string | null
    ) => void;
};

export function useWorkbenchBlockCreation({
    workbenchNodes,
    addWorkbenchNode,
    addConnection,
}: UseWorkbenchBlockCreationOptions) {
    const [basicBlocksMenu, setBasicBlocksMenu] = useState<BasicBlocksMenuState>(null);

    const handleBlockSelect = useCallback((type: 'modify' | 'animate' | 'variate' | 'render') => {
        if (!basicBlocksMenu) {
            setBasicBlocksMenu(null);
            return;
        }

        const sourceNode = workbenchNodes.find((n) => n.id === basicBlocksMenu.sourceNodeId);
        if (!sourceNode) {
            setBasicBlocksMenu(null);
            return;
        }

        const newNodeId = generateUUID();

        if (type === 'render') {
            const newNode = createRenderNodeFromSource(sourceNode, newNodeId);
            addWorkbenchNode(newNode);
            addConnection(basicBlocksMenu.sourceNodeId, newNodeId, 'image-source', 'render-target-visible');
            setBasicBlocksMenu(null);
            return;
        }

        if (type === 'modify') {
            const newNode = createModifyNodeFromSource(sourceNode, newNodeId);
            addWorkbenchNode(newNode);
            addConnection(basicBlocksMenu.sourceNodeId, newNodeId, 'image-source', 'modify-target-visible');
            setBasicBlocksMenu(null);
            return;
        }

        if (type === 'variate') {
            const newNode = createModifyNodeFromSource(sourceNode, newNodeId);
            newNode.data.workflowId = 'material_study';
            addWorkbenchNode(newNode);
            addConnection(basicBlocksMenu.sourceNodeId, newNodeId, 'image-source', 'modify-target-visible');
            setBasicBlocksMenu(null);
            return;
        }

        const newNode = createAnimateNodeFromSource(sourceNode, newNodeId);
        addWorkbenchNode(newNode);
        addConnection(basicBlocksMenu.sourceNodeId, newNodeId, 'image-source', 'animate-target-visible');
        setBasicBlocksMenu(null);
    }, [basicBlocksMenu, workbenchNodes, addWorkbenchNode, addConnection]);

    return {
        basicBlocksMenu,
        setBasicBlocksMenu,
        handleBlockSelect,
    };
}
