"use client";

import { useEffect } from "react";
import { rememberBrowserView, type BrowserView } from "@/lib/browserLanding";

/**
 * Remembers the top-level browser view the user is currently in so the
 * dashboard can land them back here next time they arrive.
 */
export function useRememberBrowserView(view: BrowserView) {
    useEffect(() => {
        rememberBrowserView(view);
    }, [view]);
}
