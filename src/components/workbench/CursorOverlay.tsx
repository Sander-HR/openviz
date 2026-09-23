import type { CollabRemoteCursorState } from '@/types/collab.types';

export interface FlowViewport {
    x: number;
    y: number;
    zoom: number;
}

export interface CursorOverlayProps {
    /** Remote cursors keyed by awareness client id (entries exist only while a peer's cursor is active). */
    remoteCursors: Record<string, CollabRemoteCursorState>;
    /** Current React Flow viewport — used to convert world → screen coordinates. */
    viewport: FlowViewport;
}

/**
 * Pointer-events-free overlay that draws every other user's cursor (with a
 * name label) inside the flow wrapper. World coordinates are converted with
 * `screen = world × zoom + viewport offset` (spec US2 / SC-003).
 */
function firstName(name?: string): string {
    if (!name?.trim()) return 'Guest';
    return name.trim().split(/\s+/)[0];
}

export function CursorOverlay({ remoteCursors, viewport }: CursorOverlayProps): JSX.Element {
    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
            {Object.entries(remoteCursors).map(([clientId, cursor]) => {
                const left = cursor.x * viewport.zoom + viewport.x;
                const top = cursor.y * viewport.zoom + viewport.y;
                return (
                    <div
                        key={clientId}
                        data-cursor-client={clientId}
                        className="absolute"
                        style={{ left, top }}
                    >
                        <svg width="14" height="16" viewBox="0 0 14 16" className="block drop-shadow-sm">
                            <path
                                d="M0 0 L14 6.5 L7.5 8.5 L5 16 Z"
                                fill={cursor.color ?? '#f97316'}
                                stroke="#ffffff"
                                strokeWidth="1"
                            />
                        </svg>
                        <span
                            className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                            style={{ backgroundColor: cursor.color ?? '#f97316' }}
                        >
                            {firstName(cursor.userName)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
