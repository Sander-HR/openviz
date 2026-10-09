import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useRememberBrowserView } from "./useRememberBrowserView";
import { getPreferredBrowserView, type BrowserView } from "@/lib/browserLanding";

describe("useRememberBrowserView", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("remembers the view on mount", () => {
        renderHook(() => useRememberBrowserView("files"));
        expect(getPreferredBrowserView()).toBe("files");
    });

    it("updates the remembered view when the view changes", () => {
        const { rerender } = renderHook(
            ({ view }: { view: BrowserView }) => useRememberBrowserView(view),
            { initialProps: { view: "recents" as BrowserView } },
        );
        expect(getPreferredBrowserView()).toBe("recents");
        rerender({ view: "files" });
        expect(getPreferredBrowserView()).toBe("files");
    });
});
