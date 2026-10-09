import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPreferredBrowserView, rememberBrowserView } from "./browserLanding";

describe("browser landing", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("defaults to recents when nothing has been remembered", () => {
        expect(getPreferredBrowserView()).toBe("recents");
    });

    it("returns files only when the user was last in files", () => {
        rememberBrowserView("files");
        expect(getPreferredBrowserView()).toBe("files");
    });

    it("returns recents when the user was last in recents", () => {
        rememberBrowserView("recents");
        expect(getPreferredBrowserView()).toBe("recents");
    });

    it("ignores unrecognized stored values and falls back to recents", () => {
        window.localStorage.setItem("openviz:last-browser-view", "folder/123");
        expect(getPreferredBrowserView()).toBe("recents");
    });

    it("does not throw when storage is unavailable", () => {
        const getItemSpy = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        const setItemSpy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
            throw new Error("denied");
        });
        try {
            expect(getPreferredBrowserView()).toBe("recents");
            expect(() => rememberBrowserView("files")).not.toThrow();
        } finally {
            getItemSpy.mockRestore();
            setItemSpy.mockRestore();
        }
    });
});
