import React from 'react';
import {
    Clapperboard,
    CopyPlus,
    Eye,
    Pencil,
    Plus,
    Scissors,
    Smartphone,
    SquareStack,
    StickyNote,
    Type,
    Upload,
    Video,
    Wand2,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Canonical kind list lives with the creation routing (T035) so the menu and
// the node-creation plan can never drift apart.
export type { AddNodeKind } from './hooks/workbenchAddNodeCreationLogic';
import type { AddNodeKind } from './hooks/workbenchAddNodeCreationLogic';

/**
 * The add-node menu (ui-translation §3.1): the first toolbar button opens a
 * w-[222px] panel with an upload group (Kbd hints I /) and a two-column icon
 * grid of every non-legacy creatable type. Legacy types are excluded from v1
 * (FR-004); the existing render node is labeled "Instant Render".
 */

export interface AddNodeMenuProps {
    onUploadImage: () => void;
    onUploadFromPhone: () => void;
    onCreateNode: (kind: AddNodeKind) => void;
}

const GRID_ITEMS: Array<{ label: string; kind: AddNodeKind; icon: LucideIcon }> = [
    { label: 'Sketch', kind: 'sketch', icon: Pencil },
    { label: 'Instant Render', kind: 'render', icon: Zap },
    { label: 'Animate', kind: 'animate', icon: Clapperboard },
    { label: 'Modify', kind: 'modify', icon: Wand2 },
    { label: 'Variate', kind: 'variate', icon: CopyPlus },
    { label: 'Extract', kind: 'extract', icon: Scissors },
    { label: 'New View', kind: 'new-view', icon: Eye },
    { label: 'Text', kind: 'text', icon: Type },
    { label: 'Sticky Note', kind: 'note', icon: StickyNote },
    { label: 'Section', kind: 'section', icon: SquareStack },
    { label: 'Media/Video', kind: 'media', icon: Video },
];

const uploadRowClass =
    'flex h-[30px] cursor-pointer select-none items-center gap-2 rounded-lg px-2 text-xs text-foreground outline-none data-[highlighted]:bg-viz-surface';

const gridItemClass =
    'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground outline-none data-[highlighted]:bg-viz-surface';

export const AddNodeMenu: React.FC<AddNodeMenuProps> = ({ onUploadImage, onUploadFromPhone, onCreateNode }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    title="Add node"
                    aria-label="Add node"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white"
                >
                    <Plus size={16} strokeWidth={2} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                sideOffset={8}
                className={cn('w-[222px] rounded-xl2 border border-viz-border bg-viz-panel p-1.5 shadow-viz')}
            >
                {/* Upload group (full-width rows with shortcut hints). */}
                <DropdownMenuItem onSelect={onUploadImage} className={uploadRowClass}>
                    <Upload size={14} className="shrink-0 text-viz-muted" />
                    <span className="flex-1 truncate">Upload an image</span>
                    <Kbd>I</Kbd>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onUploadFromPhone} className={uploadRowClass}>
                    <Smartphone size={14} className="shrink-0 text-viz-muted" />
                    <span className="flex-1 truncate">Upload from phone</span>
                    <Kbd>/</Kbd>
                </DropdownMenuItem>

                <Separator decorative={false} className="my-1.5 bg-viz-border" />

                {/* Two-column icon grid of creatable node types. */}
                <div className="grid grid-cols-2 gap-0.5">
                    {GRID_ITEMS.map(({ label, kind, icon: Icon }) => (
                        <DropdownMenuItem key={kind} onSelect={() => onCreateNode(kind)} className={gridItemClass}>
                            <Icon size={14} className="shrink-0 text-viz-muted" />
                            <span className="truncate">{label}</span>
                        </DropdownMenuItem>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
