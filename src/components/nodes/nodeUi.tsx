import { type CSSProperties, type ReactNode } from 'react';
import { Handle, Position, useConnection } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { LucideIcon } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// NodeCard shell (ui-translation §4, FR-014)
//
// Every node card shares one frame: 280px dark panel, 12px radius, token
// border, viz shadow, accent selection ring. Content nodes add a header row
// with the type icon + label; drawing primitives (arrow/freehand) use the
// frame classes only — a header would offset their SVG geometry.
// ---------------------------------------------------------------------------

/** Card frame: consistent padding/radius/border from the shared token set. */
export function nodeCardClass(selected: boolean, radiusClass = 'rounded-xl2'): string {
    return cn(
        `relative w-[280px] ${radiusClass} bg-viz-panel border shadow-viz overflow-visible`,
        selected ? 'border-2 border-viz-accent ring-2 ring-viz-accent' : 'border border-viz-border',
    );
}

/** Header row: 14px accent type icon + text-xs font-medium label. */
export function NodeCardHeader({
    icon: Icon,
    label,
    badge,
}: {
    icon: LucideIcon;
    label: string;
    badge?: ReactNode;
}) {
    return (
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-viz-border px-3">
            <Icon size={14} className="shrink-0 text-white" />
            <h3 className="truncate text-xs font-medium text-white">{label}</h3>
            {badge ? <span className="ml-auto shrink-0">{badge}</span> : null}
        </div>
    );
}

/** Body wrapper: consistent padding + vertical rhythm. */
export function nodeCardBodyClass(): string {
    return 'space-y-3 p-3';
}

/** Shared receiving connector for cards that accept image connections. */
export function NodeTargetHandle({ id, selected }: { id: string; selected: boolean }) {
    const connection = useConnection();
    const isDropTarget = connection.inProgress && connection.fromNode?.type === 'imageNode';
    const showVisibleHandle = selected || isDropTarget;

    return (
        <>
            <Handle
                type="target"
                position={Position.Left}
                id={id}
                isConnectable={isDropTarget}
                isConnectableStart={false}
                style={{
                    ...imageLikeHandleStyle,
                    left: 0,
                    top: '50%',
                    zIndex: 11000,
                    opacity: showVisibleHandle ? 1 : 0,
                    pointerEvents: showVisibleHandle ? 'auto' : 'none',
                    cursor: 'pointer',
                }}
            >
                <Plus size={16} color="white" strokeWidth={3} className="pointer-events-none" />
            </Handle>
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isDropTarget}
                isConnectableStart={false}
                style={{
                    ...elevatedFullNodeTargetHandleStyle,
                    pointerEvents: isDropTarget ? 'auto' : 'none',
                    cursor: isDropTarget ? 'crosshair' : 'default',
                }}
            />
        </>
    );
}

// Media nodes (image/video) use a headerless frame: the media title floats
// above the card when selected (pre-shell behavior), so an inline header is
// not added — it would shrink the media area and duplicate the title.
/** Headerless card frame for media nodes (fills its sized wrapper). */
export function mediaNodeFrameClass(selected: boolean): string {
    return cn(
        'h-full w-full rounded bg-viz-panel shadow-viz overflow-hidden box-border',
        selected ? 'border-2 border-viz-accent ring-2 ring-viz-accent' : 'border border-white',
    );
}

export const resizeHandleClassName = 'resize-handle !border-viz-accent';

/** Floating title rendered above a media node while selected. */
export function mediaNodeTitleClass(): string {
    return 'absolute -top-4 left-0 right-0 truncate px-1 text-left text-xs text-viz-accent';
}

// Handles restyled to the token set (bg-viz-panel, 2px viz-border).
export const imageLikeHandleStyle: CSSProperties = {
    background: '#4C4CEF',
    width: '26px',
    height: '26px',
    border: '2px solid #161616',
    cursor: 'pointer',
    transformOrigin: 'center',
    transition: 'opacity 300ms ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

export const fullNodeTargetHandleStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'transparent',
    border: 'none',
};

export const elevatedFullNodeTargetHandleStyle: CSSProperties = {
    ...fullNodeTargetHandleStyle,
    zIndex: 10000,
};
