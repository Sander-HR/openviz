import React, { useCallback, useState } from 'react';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useStore } from '@/store/useStore';
import type { AspectRatio, WorkbenchNode } from '@/types';
import { NodeMoreMenu } from './NodeMoreMenu';
import { NodeSelectionToolbar } from './NodeSelectionToolbar';
import { useNodeMoreMenuActions } from './hooks/useNodeMoreMenuActions';
import { useOverlayAnchoring } from './hooks/useOverlayAnchoring';

/**
 * Single floating overlay layer for the workbench (ui-translation §5): the
 * node selection toolbar (§3.2) and its "more" menu (§3.3), anchored to the
 * active (last-clicked) node through the viewport transform, plus the
 * right-click more menu (replaces the legacy PositionedMenu). The root is
 * `pointer-events-none`; each panel opts back in with `pointer-events-auto`.
 */

export interface WorkbenchOverlayLayerProps {
    /** Right-click state from the node handlers. */
    contextMenu: { x: number; y: number; nodeId: string } | null;
    onCloseContextMenu: () => void;
    /** Nodes the right-click menu should act on (selection-aware). */
    contextNodes: WorkbenchNode[];
    /** Paste handler for the right-click menu's extra row. */
    onPaste: () => void;
}

const RATIO_LABELS = ['1:1', '4:5', '5:4', '2:3', '3:2', '9:16', '16:9'];

/**
 * The floating toolbar is a media-node surface (user refinement): it renders
 * for image/video/media nodes only. Generation nodes (render/modify/animate/
 * variate/new-view/extract) get the right-click more menu instead — their
 * prompt entry moves to the attached prompt panel in US4.
 */
const TOOLBAR_NODE_TYPES = new Set(['image', 'video', 'media']);

function isToolbarNode(node: WorkbenchNode | undefined): boolean {
    return Boolean(node && TOOLBAR_NODE_TYPES.has(node.type));
}

/** Nearest toolbar ratio label for a node's canvas dimensions. */
function currentAspectRatio(node: WorkbenchNode | undefined): string {
    if (!node) return '1:1';
    if ((node.type === 'image' || node.type === 'video') && node.project?.canvas) {
        const canvas = node.project.canvas;
        if (canvas.width > 0 && canvas.height > 0) {
            const ratio = canvas.width / canvas.height;
            return RATIO_LABELS.map((label) => {
                const [w, h] = label.split(':').map(Number);
                return { label, distance: Math.abs(w / h - ratio) };
            }).sort((a, b) => a.distance - b.distance)[0].label;
        }
    }
    return '1:1';
}

export const WorkbenchOverlayLayer: React.FC<WorkbenchOverlayLayerProps> = ({
    contextMenu,
    onCloseContextMenu,
    contextNodes,
    onPaste,
}) => {
    const anchor = useOverlayAnchoring();
    const [moreOpen, setMoreOpen] = useState(false);

    const workbenchNodes = useStore((state) => state.workbenchNodes);
    const reorderWorkbenchNode = useStore((state) => state.reorderWorkbenchNode);
    const copyToClipboard = useStore((state) => state.copyToClipboard);
    const duplicateWorkbenchNode = useStore((state) => state.duplicateWorkbenchNode);
    const removeWorkbenchNode = useStore((state) => state.removeWorkbenchNode);
    const updateWorkbenchNode = useStore((state) => state.updateWorkbenchNode);
    const openNodeInStudio = useStore((state) => state.openNodeInStudio);

    const anchorNodes = anchor
        ? workbenchNodes.filter((node) => node.id === anchor.nodeId)
        : [];
    const actions = useNodeMoreMenuActions({
        nodes: anchorNodes,
        reorderWorkbenchNode,
        copyToClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode,
    });

    const contextActions = useNodeMoreMenuActions({
        nodes: contextNodes,
        reorderWorkbenchNode,
        copyToClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode,
    });

    const handleEdit = useCallback(() => {
        if (anchor) openNodeInStudio(anchor.nodeId);
    }, [anchor, openNodeInStudio]);

    const handleAspectRatioChange = useCallback(
        (ratio: string) => {
            if (!anchor) return;
            const node = workbenchNodes.find((candidate) => candidate.id === anchor.nodeId);
            if ((node?.type === 'image' || node?.type === 'video') && node.project) {
                updateWorkbenchNode(anchor.nodeId, {
                    project: { ...node.project, canvas: { ...node.project.canvas, aspectRatio: ratio as AspectRatio } },
                });
            }
        },
        [anchor, updateWorkbenchNode, workbenchNodes],
    );

    const handleAction = useCallback(
        (id: string) => {
            actions.find((action) => action.id === id)?.onClick?.();
            setMoreOpen(false);
        },
        [actions],
    );

    return (
        <div className="pointer-events-none absolute inset-0 z-30">
            {anchor && isToolbarNode(anchorNodes[0]) && (
                <>
                    <NodeSelectionToolbar
                        anchor={{ screenX: anchor.screenX, screenY: anchor.screenY }}
                        aspectRatio={currentAspectRatio(anchorNodes[0])}
                        actions={actions}
                        onEdit={handleEdit}
                        onAspectRatioChange={handleAspectRatioChange}
                        onOpenMore={() => setMoreOpen((open) => !open)}
                    />
                    {/* Controlled dropdown: the toolbar's More button drives open
                        state; the hidden trigger pins content near the anchor. */}
                    <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
                        <DropdownMenuTrigger asChild>
                            <span className="fixed block h-px w-px" style={{ left: anchor.screenX, top: anchor.screenY - 8 }} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" side="top" sideOffset={44} collisionPadding={10}>
                            <NodeMoreMenu actions={actions} onAction={handleAction} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            )}

            {contextMenu && (
                <DropdownMenuPrimitive.Root open onOpenChange={(open) => !open && onCloseContextMenu()}>
                    <DropdownMenuPrimitive.Trigger asChild>
                        {/* Dynamic coordinates require inline positioning; static styling is in classes. */}
                        <span className="fixed block h-px w-px" style={{ left: contextMenu.x, top: contextMenu.y }} />
                    </DropdownMenuPrimitive.Trigger>
                    <DropdownMenuPrimitive.Portal>
                        <DropdownMenuPrimitive.Content
                            sideOffset={0}
                            collisionPadding={10}
                            align="start"
                            side="bottom"
                            className="z-[1000] nowheel"
                        >
                            <NodeMoreMenu
                                actions={contextActions}
                                onAction={(id) => {
                                    contextActions.find((action) => action.id === id)?.onClick?.();
                                    onCloseContextMenu();
                                }}
                                extraActions={[
                                    { label: 'Paste', shortcut: '⌘V', onClick: () => { onPaste(); onCloseContextMenu(); } },
                                ]}
                            />
                        </DropdownMenuPrimitive.Content>
                    </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
            )}
        </div>
    );
};
