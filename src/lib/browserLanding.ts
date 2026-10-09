/**
 * Remembers which top-level browser view ("My Files" or "Recents") the user
 * was last in, so returning to the dashboard can land them where they left
 * off. New or unrecognized state always falls back to Recents.
 */

export type BrowserView = "files" | "recents";

const STORAGE_KEY = "openviz:last-browser-view";

/**
 * The view the browser should land on: only returns to Files when the user
 * was last in Files; otherwise (first visit, stale value) lands on Recents.
 */
export function getPreferredBrowserView(): BrowserView {
    if (typeof window === "undefined") return "recents";
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "files" ? "files" : "recents";
    } catch {
        return "recents";
    }
}

export function rememberBrowserView(view: BrowserView): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, view);
    } catch {
        // Storage can be unavailable (private mode, quota) — landing then
        // simply falls back to the Recents default.
    }
}
