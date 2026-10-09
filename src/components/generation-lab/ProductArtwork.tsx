interface ProductArtworkProps {
    variant?: 'reference' | 'rendered';
    className?: string;
}

export function ProductArtwork({ variant = 'reference', className }: ProductArtworkProps) {
    const isRendered = variant === 'rendered';

    return (
        <div
            className={`relative isolate overflow-hidden rounded-xl ${
                isRendered
                    ? 'bg-[radial-gradient(ellipse_at_50%_34%,#d7b08b_0%,#8f695b_42%,#34312f_100%)]'
                    : 'bg-[radial-gradient(ellipse_at_55%_30%,#c5c2af_0%,#777f72_40%,#313831_100%)]'
            } ${className ?? ''}`}
        >
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(135deg,transparent_0%,rgba(14,18,14,.6)_100%)]" aria-hidden="true" />
            <svg
                viewBox="0 0 180 180"
                className={`absolute inset-0 h-full w-full ${isRendered ? 'text-[#e4d3ba]' : 'text-[#d7d7c6]'}`}
                role="img"
                aria-label={isRendered ? 'Rendered sculptural desk lamp' : 'Reference image of an arc desk lamp'}
            >
                <ellipse cx="93" cy="151" rx="46" ry="8" className="fill-black/30" />
                <path d="M73 144h44c4 0 7 3 7 6v2H66v-2c0-3 3-6 7-6Z" className="fill-current" />
                <path d="M91 143 101 92" className="fill-none stroke-current" strokeWidth="8" strokeLinecap="round" />
                <path d="M99 97c-3-20 6-43 28-54" className="fill-none stroke-current" strokeWidth="7" strokeLinecap="round" />
                <path d="M117 37c3-5 9-8 16-7l17 4-8 20-17-4c-7-2-11-7-8-13Z" className="fill-current" />
                <path d="M133 38 146 41" className="stroke-[#f3d5a5]" strokeWidth="3" strokeLinecap="round" />
                <path d="M78 140c7-18 20-32 39-43" className="fill-none stroke-white/25" strokeWidth="1.5" />
                <circle cx="99" cy="96" r="4" className="fill-[#c97845]" />
            </svg>
            <div className="absolute bottom-2 left-2 rounded-md border border-white/20 bg-black/30 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">
                {isRendered ? 'Warm studio' : 'Ref · 01'}
            </div>
        </div>
    );
}
