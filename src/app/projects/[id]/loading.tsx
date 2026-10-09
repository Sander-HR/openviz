/**
 * Loading boundary for /projects/[id]/* routes.
 *
 * Two jobs:
 * 1. Unlocks Next.js prefetching of dynamic project routes (dynamic routes
 *    are only prefetched up to the first loading boundary).
 * 2. Shows a lightweight skeleton while RSC streams, instead of a blank page.
 *
 * Keep this free of heavy imports — it must not pull canvas code into the
 * route chunk.
 */
export default function ProjectLoading() {
    return (
        <div className="h-screen w-screen overflow-hidden bg-[#0F0F0F] flex flex-col">
            <div className="flex items-center gap-3 p-4">
                <div className="h-8 w-64 max-w-[50vw] rounded-lg bg-zinc-800/80 animate-pulse" />
                <div className="h-8 w-24 rounded-lg bg-zinc-800/50 animate-pulse" />
            </div>
            <div className="flex-1 m-4 mt-0 rounded-xl border border-zinc-800/60 bg-zinc-900/60 animate-pulse" />
        </div>
    );
}
