import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shortcut hint chip for menu items and tooltips (ui-translation §2).
 * Renders right-aligned when placed in a flex row (`ml-auto`).
 */
export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <kbd
            className={cn(
                "ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded border border-viz-border bg-viz-panel px-1 font-mono text-[10px] leading-none text-viz-muted",
                className,
            )}
        >
            {children}
        </kbd>
    );
}
