"use client";

import { useEffect } from "react";
import { preloadViewAssets } from "@/lib/viewImports";

type ConnectionLike = {
    saveData?: boolean;
    effectiveType?: string;
};

type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
};

let preloadedThisSession = false;

/**
 * Warms the Studio + Workbench view chunks during browser idle time so that
 * entering a project (or switching views) never waits on chunk downloads.
 *
 * - Runs once per page session (module-level flag).
 * - Skipped when the user has Save-Data enabled or is on a 2g connection.
 * - Renders nothing.
 */
export function AppAssetPreloader() {
    useEffect(() => {
        if (preloadedThisSession) return;

        const connection: ConnectionLike | undefined = (
            navigator as Navigator & { connection?: ConnectionLike }
        ).connection;
        if (connection?.saveData || connection?.effectiveType === "2g") return;

        preloadedThisSession = true;

        const run = () => preloadViewAssets();
        const win = window as IdleWindow;

        if (win.requestIdleCallback) {
            const idleId = win.requestIdleCallback(run, { timeout: 5000 });
            return () => win.cancelIdleCallback?.(idleId);
        }

        const timerId = setTimeout(run, 2000);
        return () => clearTimeout(timerId);
    }, []);

    return null;
}
