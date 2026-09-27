import { saveAs } from 'file-saver';

import type { LucideIcon } from 'lucide-react';
import {
    ChevronDown,
    ChevronsUp,
    Copy,
    CopyPlus,
    Download,
    Eraser,
    FileOutput,
    Frame,
    ImagePlus,
    Link,
    Library,
    RotateCcw,
    Square,
    Trash2,
} from 'lucide-react';

import type { WorkbenchNode } from '@/types';

/**
 * Data-driven "more" menu action registry (ui-translation §3.3).
 *
 * Groups in order: image / library / organization / clipboard / danger.
 * Per research R11, actions without an existing backend are disabled WITH a
 * reason so the UI surfaces them honestly instead of faking success.
 * Multi-selection enables only whole-selection-valid actions (§5).
 */

export type NodeMoreMenuGroup = 'image' | 'library' | 'organization' | 'clipboard' | 'danger';

export interface NodeMoreMenuAction {
    id: string;
    label: string;
    icon: LucideIcon;
    group: NodeMoreMenuGroup;
    shortcut?: string;
    enabled: boolean;
    disabledReason?: string;
    danger?: boolean;
    onClick?: () => void;
}

export interface UseNodeMoreMenuActionsOptions {
    nodes: WorkbenchNode[];
    reorderWorkbenchNode: (id: string, position: 'front' | 'back') => void;
    copyToClipboard: (id?: string) => void;
    duplicateWorkbenchNode: (id?: string) => void;
    removeWorkbenchNode: (id?: string) => void;
}

const NO_BACKEND = 'Not available yet';
const MULTI_ONLY = 'Select a single node to use this action';

/** Best-effort image source for download / copy-raw actions. */
function imageSourceOf(node: WorkbenchNode): string | null {
    if (node.type === 'image' || node.type === 'video') {
        return node.project?.thumbnail ?? null;
    }
    if (node.type === 'media') {
        return node.data.src;
    }
    return null;
}

function nodeNameOf(node: WorkbenchNode): string {
    if (node.type === 'image' || node.type === 'video') {
        return node.name;
    }
    if (node.type === 'media') {
        return node.data.alt || 'media';
    }
    return 'image';
}

async function downloadImage(url: string, fallbackName: string): Promise<void> {
    const response = await fetch(url);
    const blob = await response.blob();
    const extension = url.split('.').pop()?.split('?')[0] || 'png';
    saveAs(blob, `${fallbackName}_${Date.now()}.${extension}`);
}

async function copyRawImage(url: string): Promise<void> {
    const response = await fetch(url);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
}

export function useNodeMoreMenuActions(options: UseNodeMoreMenuActionsOptions): NodeMoreMenuAction[] {
    const { nodes, reorderWorkbenchNode, copyToClipboard, duplicateWorkbenchNode, removeWorkbenchNode } = options;

    const single = nodes.length === 1 ? nodes[0] : null;
    const source = single ? imageSourceOf(single) : null;
    const hasSelection = nodes.length > 0;
    // No image source: multi-selection is a per-node-only limitation, a
    // single node simply has nothing to download/copy.
    const noImageReason = nodes.length > 1 ? MULTI_ONLY : 'No image to download';

    // Whole-selection actions operate on the selection as a unit: pass the id
    // for a single node, `undefined` (the whole selection) otherwise.
    const targetId = single ? single.id : undefined;

    return [
        // ── Image ────────────────────────────────────────────────────────────
        {
            id: 'remove-background',
            label: 'Remove Background',
            icon: Eraser,
            group: 'image',
            enabled: false,
            disabledReason: NO_BACKEND,
        },
        {
            id: 'download',
            label: 'Download',
            icon: Download,
            group: 'image',
            enabled: Boolean(source),
            disabledReason: source ? undefined : noImageReason,
            onClick: source && single ? () => { void downloadImage(source, nodeNameOf(single)); } : undefined,
        },
        {
            id: 'export',
            label: 'Export…',
            icon: FileOutput,
            group: 'image',
            enabled: false,
            disabledReason: NO_BACKEND,
        },
        {
            id: 'copy-raw-image',
            label: 'Copy raw image',
            icon: Copy,
            group: 'image',
            enabled: Boolean(source),
            disabledReason: source ? undefined : noImageReason,
            onClick: source && single ? () => { void copyRawImage(source); } : undefined,
        },

        // ── Library & references ─────────────────────────────────────────────
        {
            id: 'add-to-library',
            label: 'Add to library',
            icon: Library,
            group: 'library',
            enabled: false,
            disabledReason: NO_BACKEND,
        },
        {
            id: 'add-to-reference-images',
            label: 'Add to reference images',
            icon: ImagePlus,
            group: 'library',
            enabled: false,
            disabledReason: NO_BACKEND,
        },
        {
            id: 'set-as-thumbnail',
            label: 'Set as thumbnail',
            icon: Square,
            group: 'library',
            enabled: false,
            disabledReason: NO_BACKEND,
        },
        {
            id: 'restore-default-thumbnail',
            label: 'Restore default thumbnail',
            icon: RotateCcw,
            group: 'library',
            enabled: false,
            disabledReason: NO_BACKEND,
        },

        // ── Organization ─────────────────────────────────────────────────────
        {
            id: 'wrap-in-section',
            label: 'Wrap in section',
            icon: Frame,
            group: 'organization',
            enabled: false,
            disabledReason: NO_BACKEND,
        },
        {
            id: 'bring-to-front',
            label: 'Bring to front',
            icon: ChevronsUp,
            group: 'organization',
            shortcut: ']',
            enabled: Boolean(single),
            disabledReason: single ? undefined : MULTI_ONLY,
            onClick: single ? () => reorderWorkbenchNode(single.id, 'front') : undefined,
        },
        {
            id: 'send-to-back',
            label: 'Send to back',
            icon: ChevronDown,
            group: 'organization',
            shortcut: '[',
            enabled: Boolean(single),
            disabledReason: single ? undefined : MULTI_ONLY,
            onClick: single ? () => reorderWorkbenchNode(single.id, 'back') : undefined,
        },

        // ── Clipboard ────────────────────────────────────────────────────────
        {
            id: 'copy-link',
            label: 'Copy link to selection',
            icon: Link,
            group: 'clipboard',
            shortcut: '⌘L',
            enabled: false,
            disabledReason: NO_BACKEND,
        },
        {
            id: 'copy',
            label: 'Copy',
            icon: Copy,
            group: 'clipboard',
            shortcut: '⌘C',
            enabled: hasSelection,
            disabledReason: hasSelection ? undefined : 'Nothing selected',
            onClick: () => copyToClipboard(targetId),
        },
        {
            id: 'duplicate',
            label: 'Duplicate',
            icon: CopyPlus,
            group: 'clipboard',
            shortcut: '⌘D',
            enabled: hasSelection,
            disabledReason: hasSelection ? undefined : 'Nothing selected',
            onClick: () => duplicateWorkbenchNode(targetId),
        },

        // ── Danger ───────────────────────────────────────────────────────────
        {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            group: 'danger',
            shortcut: 'Del',
            danger: true,
            enabled: hasSelection,
            disabledReason: hasSelection ? undefined : 'Nothing selected',
            onClick: () => removeWorkbenchNode(targetId),
        },
    ];
}

/** Group order used by the menu renderer to insert separators. */
export const MORE_MENU_GROUP_ORDER: NodeMoreMenuGroup[] = [
    'image',
    'library',
    'organization',
    'clipboard',
    'danger',
];
