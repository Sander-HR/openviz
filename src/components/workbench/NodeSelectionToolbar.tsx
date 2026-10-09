import React, { useState } from 'react';

import { ChevronDown, MoreHorizontal, Pencil, Ratio } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { NodeMoreMenuAction } from './hooks/useNodeMoreMenuActions';

/**
 * Floating node selection toolbar (ui-translation §3.2): Edit button,
 * aspect-ratio chip, quick actions and the "more" trigger. The overlay layer
 * positions it centered above the anchor node with enough clearance for the
 * media title; the component owns its own `translate(-50%, -100%)`.
 */

export interface NodeSelectionToolbarProps {
    /** Screen coordinates of the anchor node's top-center. */
    anchor: { screenX: number; screenY: number };
    aspectRatio: string;
    actions: NodeMoreMenuAction[];
    onEdit: () => void;
    onAspectRatioChange: (ratio: string) => void;
    onOpenMore: () => void;
}

/** Exact ratio list from ui-translation §3.2 — no more, no less. */
const ASPECT_RATIOS = ['1:1', '4:5', '5:4', '2:3', '3:2', '9:16', '16:9'];

function actionById(actions: NodeMoreMenuAction[], id: string): NodeMoreMenuAction | undefined {
    return actions.find((action) => action.id === id);
}

export const NodeSelectionToolbar: React.FC<NodeSelectionToolbarProps> = ({
    anchor,
    aspectRatio,
    actions,
    onEdit,
    onAspectRatioChange,
    onOpenMore,
}) => {
    const [ratioMenuOpen, setRatioMenuOpen] = useState(false);

    const quickActions: Array<{ id: string; title: string }> = [
        { id: 'download', title: 'Download' },
        { id: 'copy-raw-image', title: 'Copy raw image' },
        { id: 'add-to-library', title: 'Add to library' },
    ];

    return (
        <div
            className="nodrag nopan pointer-events-auto absolute z-30 flex items-center gap-1 rounded-xl2 border border-viz-border bg-viz-panel px-1.5 py-1 shadow-viz"
            style={{
                left: `${anchor.screenX}px`,
                top: `${anchor.screenY - 24}px`,
                transform: 'translate(-50%, -100%)',
            }}
        >
            <button
                type="button"
                title="Edit"
                onClick={onEdit}
                className="rounded-lg p-1.5 text-viz-muted hover:bg-viz-surface hover:text-white"
            >
                <Pencil size={14} />
            </button>

            <DropdownMenu open={ratioMenuOpen} onOpenChange={setRatioMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-viz-surface"
                    >
                        <Ratio size={14} className="text-viz-muted" />
                        {aspectRatio}
                        <ChevronDown size={12} className="text-viz-muted" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" sideOffset={8}>
                    {ASPECT_RATIOS.map((ratio) => (
                        <DropdownMenuItem key={ratio} onClick={() => onAspectRatioChange(ratio)}>
                            {ratio}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {quickActions.map(({ id, title }) => {
                const action = actionById(actions, id);
                const Icon = action?.icon;
                return (
                    <button
                        key={id}
                        type="button"
                        title={title}
                        disabled={!action?.enabled}
                        onClick={action?.onClick}
                        className={cn(
                            'rounded-lg p-1.5 text-viz-muted hover:bg-viz-surface hover:text-white',
                            !action?.enabled && 'pointer-events-none opacity-40',
                        )}
                    >
                        {Icon ? <Icon size={14} /> : null}
                    </button>
                );
            })}

            <button
                type="button"
                title="More"
                onClick={onOpenMore}
                className="rounded-lg p-1.5 text-viz-muted hover:bg-viz-surface hover:text-white"
            >
                <MoreHorizontal size={14} />
            </button>
        </div>
    );
};
