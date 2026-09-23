import { useShallow } from 'zustand/react/shallow';

import { useStore } from '@/store/useStore';

export function useWorkbenchStore() {
    return useStore(
        useShallow((state) => ({
            workbenchNodes: state.workbenchNodes,
            currentProjectId: state.currentProjectId,
            connections: state.connections,
            canUndoWorkbench: state.workbenchHistoryIndex > 0 && !state.activeWorkbenchGesture,
            canRedoWorkbench: state.workbenchHistoryIndex < state.workbenchHistory.length - 1 && !state.activeWorkbenchGesture,
            updateWorkbenchNode: state.updateWorkbenchNode,
            updateWorkbenchNodeTransient: state.updateWorkbenchNodeTransient,
            beginWorkbenchGesture: state.beginWorkbenchGesture,
            commitWorkbenchGesture: state.commitWorkbenchGesture,
            cancelWorkbenchGesture: state.cancelWorkbenchGesture,
            addWorkbenchNode: state.addWorkbenchNode,
            createOneShotNode: state.createOneShotNode,
            removeWorkbenchNode: state.removeWorkbenchNode,
            duplicateWorkbenchNode: state.duplicateWorkbenchNode,
            reorderWorkbenchNode: state.reorderWorkbenchNode,
            copyToClipboard: state.copyToClipboard,
            pasteFromClipboard: state.pasteFromClipboard,
            openNodeInStudio: state.openNodeInStudio,
            activeNodeId: state.activeNodeId,
            setActiveNodeId: state.setActiveNodeId,
            selectedNodeIds: state.selectedNodeIds,
            setSelectedNodeIds: state.setSelectedNodeIds,
            addConnection: state.addConnection,
            createSketchWithFormat: state.createSketchWithFormat,
            isDrawMode: state.isDrawMode,
            activeWorkbenchTool: state.activeWorkbenchTool,
            setDrawMode: state.setDrawMode,
            toggleDrawMode: state.toggleDrawMode,
            setActiveWorkbenchTool: state.setActiveWorkbenchTool,
            freehandColor: state.freehandColor,
            setFreehandColor: state.setFreehandColor,
            freehandStrokeWidth: state.freehandStrokeWidth,
            setFreehandStrokeWidth: state.setFreehandStrokeWidth,
            undoLastFreehandNode: state.undoLastFreehandNode,
            undoWorkbench: state.undoWorkbench,
            redoWorkbench: state.redoWorkbench,
        }))
    );
}
