import type { CollabPresencePeer } from '@/types/collab.types';

export interface PresenceIndicatorProps {
    /** Remote peers keyed by user id (derived from awareness). */
    presence: Record<string, CollabPresencePeer>;
}

/**
 * Avatar chips for every other user currently in the collaboration room.
 * Replaces the SSE-derived presence chip once wired into the workbench shell
 * (spec US2 / SC-003).
 */
export function PresenceIndicator({ presence }: PresenceIndicatorProps): JSX.Element | null {
    const peers = Object.values(presence);
    if (peers.length === 0) return null;

    return (
        <div
            className="flex items-center gap-1.5"
            role="status"
            aria-label={`${peers.length} other ${peers.length === 1 ? 'person' : 'people'} editing`}
        >
            {peers.map((peer) => (
                <span
                    key={peer.userId}
                    className="flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-black/5"
                >
                    <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: peer.color ?? '#64748b' }}
                    />
                    {peer.userName ?? peer.userId}
                </span>
            ))}
        </div>
    );
}
