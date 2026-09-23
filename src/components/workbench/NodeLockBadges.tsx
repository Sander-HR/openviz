import { Lock } from 'lucide-react';
import type { NodeLockState } from '@/types';
import type { FlowViewport } from './CursorOverlay';

/** Minimal structural shape of a flow node — positions are world coordinates. */
export interface LockBadgeNode {
    id: string;
    position: { x: number; y: number };
    /** Node size in world units (set by useWorkbenchGraph). */
    width?: number;
    height?: number;
}

export interface NodeLockBadgesProps {
    /** Current React Flow nodes (positions are in world coordinates). */
    nodes: LockBadgeNode[];
    /** Remote soft locks keyed by node id. */
    nodeLocks: Record<string, NodeLockState>;
    /** Current React Flow viewport — used to convert world → screen coordinates. */
    viewport: FlowViewport;
}

/** Matches the default node size used by useWorkbenchGraph. */
const FALLBACK_SIZE = 256;

/**
 * Pointer-events-free overlay that marks every node another collaborator
 * currently holds (spec FR-015): a dark blue border around the node, a dark
 * background over it, and a centered lock icon with the holder's name below.
 * The overlay box AND its content scale with the viewport zoom so the badge
 * always keeps proportion to the node. The badge is informational —
 * enforcement happens via `selectable/draggable=false` and action guards.
 */
export function NodeLockBadges({ nodes, nodeLocks, viewport }: NodeLockBadgesProps): JSX.Element {
    const byId = new Map(nodes.map((node) => [node.id, node]));

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
            {Object.values(nodeLocks).map((lock) => {
                const node = byId.get(lock.nodeId);
                if (!node) return null;
                const worldWidth = typeof node.width === 'number' && node.width > 0 ? node.width : FALLBACK_SIZE;
                const worldHeight = typeof node.height === 'number' && node.height > 0 ? node.height : FALLBACK_SIZE;
                const left = node.position.x * viewport.zoom + viewport.x;
                const top = node.position.y * viewport.zoom + viewport.y;
                return (
                    <div
                        key={lock.nodeId}
                        data-lock-node={lock.nodeId}
                        title={`${lock.userName ?? lock.userId} is editing this`}
                        className="absolute flex items-center justify-center rounded-lg border-2 border-blue-900 bg-slate-900/60"
                        style={{ left, top, width: worldWidth * viewport.zoom, height: worldHeight * viewport.zoom }}
                    >
                        {/* Content scales with zoom so icon + name keep node proportion. */}
                        <div
                            data-lock-badge-content
                            className="flex flex-col items-center justify-center gap-1.5"
                            style={{ transform: `scale(${viewport.zoom})` }}
                        >
                            <Lock size={32} strokeWidth={2} className="shrink-0 text-slate-300" aria-hidden="true" />
                            <span className="max-w-full truncate px-2 text-xs font-semibold text-slate-300">
                                {lock.userName ?? lock.userId}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
