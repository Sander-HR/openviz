import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preloadSpy = vi.fn();

vi.mock("@/lib/viewImports", () => ({
    studioModule: Promise.resolve({ Studio: () => null }),
    workbenchModule: Promise.resolve({ Workbench: () => null }),
    preloadViewAssets: (...args: unknown[]) => preloadSpy(...args),
}));

type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
};

async function loadPreloader() {
    // Fresh module registry per test so the once-per-session flag resets.
    vi.resetModules();
    const mod = await import("./AppAssetPreloader");
    return mod.AppAssetPreloader;
}

function stubConnection(connection: { saveData?: boolean; effectiveType?: string } | undefined) {
    Object.defineProperty(navigator, "connection", {
        value: connection,
        configurable: true,
    });
}

describe("AppAssetPreloader", () => {
    let idleCallbacks: Array<{ cb: () => void; timeout?: number }>;

    beforeEach(() => {
        preloadSpy.mockClear();
        idleCallbacks = [];
        const win = window as IdleWindow;
        win.requestIdleCallback = vi.fn((cb: () => void, opts?: { timeout?: number }) => {
            const id = idleCallbacks.length + 1;
            idleCallbacks.push({ cb, timeout: opts?.timeout });
            return id;
        });
        win.cancelIdleCallback = vi.fn();
    });

    afterEach(() => {
        stubConnection(undefined);
        // Keep the cancelIdleCallback stub defined: React may flush the
        // component's passive unmount effects after this hook runs, and the
        // cleanup references window.cancelIdleCallback.
        (window as IdleWindow).cancelIdleCallback = vi.fn();
    });

    it("preloads view assets when the browser goes idle", async () => {
        const AppAssetPreloader = await loadPreloader();
        render(<AppAssetPreloader />);

        expect(preloadSpy).not.toHaveBeenCalled();
        expect(idleCallbacks).toHaveLength(1);
        expect(idleCallbacks[0].timeout).toBe(5000);

        idleCallbacks[0].cb();
        expect(preloadSpy).toHaveBeenCalledTimes(1);
    });

    it("does not preload when Save-Data is enabled", async () => {
        stubConnection({ saveData: true });
        const AppAssetPreloader = await loadPreloader();
        render(<AppAssetPreloader />);

        expect(idleCallbacks).toHaveLength(0);
        if (idleCallbacks[0]) idleCallbacks[0].cb();
        expect(preloadSpy).not.toHaveBeenCalled();
    });

    it("does not preload on a 2g connection", async () => {
        stubConnection({ effectiveType: "2g" });
        const AppAssetPreloader = await loadPreloader();
        render(<AppAssetPreloader />);

        expect(idleCallbacks).toHaveLength(0);
        if (idleCallbacks[0]) idleCallbacks[0].cb();
        expect(preloadSpy).not.toHaveBeenCalled();
    });

    it("preloads only once across remounts", async () => {
        const AppAssetPreloader = await loadPreloader();
        const first = render(<AppAssetPreloader />);
        idleCallbacks[0]?.cb();
        expect(preloadSpy).toHaveBeenCalledTimes(1);

        first.unmount();
        idleCallbacks.length = 0;
        render(<AppAssetPreloader />);
        idleCallbacks[0]?.cb();
        expect(preloadSpy).toHaveBeenCalledTimes(1);
    });
});
