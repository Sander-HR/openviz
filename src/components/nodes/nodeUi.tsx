import { type CSSProperties, type ReactNode } from 'react';
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
export function nodeCardClass(selected: boolean): string {
    return cn(
        'w-[280px] rounded-xl2 bg-viz-panel border border-viz-border shadow-viz overflow-hidden',
        selected && 'ring-2 ring-viz-accent',
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
            <Icon size={14} className="shrink-0 text-viz-accent" />
            <h3 className="truncate text-xs font-medium text-white">{label}</h3>
            {badge ? <span className="ml-auto shrink-0">{badge}</span> : null}
        </div>
    );
}

/** Body wrapper: consistent padding + vertical rhythm. */
export function nodeCardBodyClass(): string {
    return 'space-y-3 p-3';
}

// Handles restyled to the token set (bg-viz-panel, 2px viz-border).
export const imageLikeHandleStyle: CSSProperties = {
    background: '#242425',
    width: '26px',
    height: '26px',
    border: '2px solid #3C3C3E',
    cursor: 'hand',
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
