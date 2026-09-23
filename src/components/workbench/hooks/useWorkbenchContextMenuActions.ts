import type { ContextMenuAction } from '@/components/ContextMenu';

type ContextMenuState = { x: number; y: number; nodeId: string } | null;

interface UseWorkbenchContextMenuActionsOptions {
    contextMenu: ContextMenuState;
    reorderWorkbenchNode: (id: string, position: 'front' | 'back') => void;
    copyToClipboard: (id: string) => void;
    pasteFromClipboard: (pos: { x: number; y: number }) => void;
    duplicateWorkbenchNode: (id: string) => void;
    removeWorkbenchNode: (id: string) => void;
}

/**
 * Builds the node context-menu action list for a given menu state.
 * (T028: extracted from the Workbench view to keep it under the 300-line
 * constitution limit.)
 */
export function useWorkbenchContextMenuActions({
    contextMenu,
    reorderWorkbenchNode,
    copyToClipboard,
    pasteFromClipboard,
    duplicateWorkbenchNode,
    removeWorkbenchNode,
}: UseWorkbenchContextMenuActionsOptions): ContextMenuAction[] {
    if (!contextMenu) {
        return [];
    }

    return [
        { label: 'Wrap in section', onClick: () => console.log('Wrap in section'), divider: true },
        { label: 'Bring to front', shortcut: ']', onClick: () => reorderWorkbenchNode(contextMenu.nodeId, 'front') },
        { label: 'Send to back', shortcut: '[', onClick: () => reorderWorkbenchNode(contextMenu.nodeId, 'back'), divider: true },
        {
            label: 'Copy link to selection', shortcut: 'Ctrl+L', onClick: () => {
                navigator.clipboard.writeText(window.location.href);
            }, divider: true
        },
        { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => copyToClipboard(contextMenu.nodeId) },
        {
            label: 'Paste', shortcut: 'Ctrl+V', onClick: () => {
                const pos = { x: 100, y: 100 };
                pasteFromClipboard(pos);
            }
        },
        { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: () => duplicateWorkbenchNode(contextMenu.nodeId), divider: true },
        { label: 'Delete', shortcut: 'Del', onClick: () => removeWorkbenchNode(contextMenu.nodeId), type: 'danger' as const },
    ];
}
