import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useWorkspacePreviews } from "./useWorkspacePreviews";

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

describe("useWorkspacePreviews", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
    });

    it("issues exactly one batched request for all project ids", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            expect(url).toContain("/api/projects/previews?ids=");
            return new Response(
                JSON.stringify({ "p-1": [{ id: "n-1", thumbnail: "t.webp", lastModifiedAt: 5 }] }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        });
        vi.stubGlobal("fetch", fetchMock);

        const { result } = renderHook(() => useWorkspacePreviews(["p-1", "p-2", "p-3"]), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(result.current["p-1"]?.[0]?.thumbnail).toBe("t.webp"));
        expect(result.current["p-2"]).toBeUndefined();
    });

    it("does not fetch when there are no project ids", async () => {
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useWorkspacePreviews([]), {
            wrapper: makeWrapper(),
        });
        expect(result.current).toEqual({});
        await new Promise((r) => setTimeout(r, 0));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses a stable query key regardless of id order (no refetch on resort)", async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
        );
        vi.stubGlobal("fetch", fetchMock);

        const wrapper = makeWrapper();
        const first = renderHook(() => useWorkspacePreviews(["p-1", "p-2"]), { wrapper });
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        // Same set, different order → served from cache, no second request.
        const second = renderHook(() => useWorkspacePreviews(["p-2", "p-1"]), { wrapper });
        await waitFor(() => expect(second.result.current).toEqual({}));
        expect(fetchMock).toHaveBeenCalledTimes(1);

        first.unmount();
        second.unmount();
    });

    it("returns an empty map when the request fails", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useWorkspacePreviews(["p-1"]), {
            wrapper: makeWrapper(),
        });
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        await waitFor(() => expect(result.current).toEqual({}));
    });
});
