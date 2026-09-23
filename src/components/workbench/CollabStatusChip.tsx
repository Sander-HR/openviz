import type { CollabPresencePeer, CollabSessionStatus } from '@/types/collab.types';

export interface CollabStatusChipProps {
    status: CollabSessionStatus;
    /** Remote peers currently in the room (keyed by user id). */
    peers?: Record<string, CollabPresencePeer>;
}

const CHIP_COPY: Record<Exclude<CollabSessionStatus, 'idle'>, { label: string; dot: string }> = {
    connected: { label: 'Live', dot: 'bg-emerald-500' },
    'offline-queued': { label: 'Offline — changes queued', dot: 'bg-amber-500' },
    connecting: { label: 'Connecting…', dot: 'bg-slate-400' },
    failed: { label: 'Connection failed', dot: 'bg-red-500' },
    denied: { label: 'Access denied', dot: 'bg-red-500' },
};

/**
 * Connection-state chip for an active collaboration session (US3 / SC-004).
 * While offline the chip says edits are QUEUED — it never claims a durable
 * save, because queued edits only become shared after the next sync.
 *
 * While connected, hovering (or focusing) the pill reveals who is live in the
 * room: every remote peer plus the local user. The list is intentionally not
 * shown while offline — awareness entries are then stale, not "live".
 */
export function CollabStatusChip({ status, peers = {} }: CollabStatusChipProps): JSX.Element | null {
    if (status === 'idle') return null;

    const { label, dot } = CHIP_COPY[status];
    const peerList = Object.values(peers);
    const liveCount = peerList.length + 1; // + the local user

    return (
        <div className="group relative">
            <div
                role="status"
                tabIndex={0}
                className="flex cursor-default items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-black/5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                {label}
            </div>

            {status === 'connected' && (
                <div
                    role="tooltip"
                    className="invisible absolute right-0 top-full z-30 mt-2 hidden w-44 rounded-lg bg-slate-900/95 p-2 text-white shadow-lg ring-1 ring-black/20 group-hover:visible group-hover:block group-focus-within:visible group-focus-within:block"
                >
                    <p className="mb-1.5 px-1 text-[11px] font-semibold text-slate-300">
                        {liveCount} live {liveCount === 1 ? 'collaborator' : 'collaborators'}
                    </p>
                    <ul className="space-y-1">
                        {peerList.map((peer) => (
                            <li key={peer.userId} className="flex items-center gap-2 px-1 text-xs">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: peer.color ?? '#94a3b8' }}
                                />
                                <span className="truncate">{peer.userName ?? 'Guest'}</span>
                            </li>
                        ))}
                        <li className="flex items-center gap-2 px-1 text-xs">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                            <span className="truncate">You</span>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}
