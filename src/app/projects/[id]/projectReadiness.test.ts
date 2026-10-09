import { describe, expect, it } from "vitest";
import { shouldHydrateFromServer, shouldPaintFromCache } from "./projectReadiness";

describe("shouldPaintFromCache", () => {
    const base = {
        lastOpenedProjectId: "p-1",
        persistHydrated: true,
        workbenchNodeCount: 3,
        collabSessionActive: false,
    };

    it("paints when the persisted store holds nodes for this project", () => {
        expect(shouldPaintFromCache(base, "p-1")).toBe(true);
    });

    it("waits for IndexedDB rehydration to finish", () => {
        expect(shouldPaintFromCache({ ...base, persistHydrated: false }, "p-1")).toBe(false);
    });

    it("never paints from cache while a collab session owns the scene", () => {
        expect(shouldPaintFromCache({ ...base, collabSessionActive: true }, "p-1")).toBe(false);
    });

    it("does not paint when the persisted nodes belong to another project", () => {
        expect(shouldPaintFromCache({ ...base, lastOpenedProjectId: "p-2" }, "p-1")).toBe(false);
    });

    it("does not paint an empty cache", () => {
        expect(shouldPaintFromCache({ ...base, workbenchNodeCount: 0 }, "p-1")).toBe(false);
    });
});

describe("shouldHydrateFromServer", () => {
    it("never hydrates while collab owns the scene", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: false, collabOwnsScene: true, localVersion: 1, serverVersion: 2 })
        ).toBe(false);
    });

    it("always hydrates on a fresh load (no cache paint)", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: false, collabOwnsScene: false, localVersion: 99, serverVersion: 1 })
        ).toBe(true);
    });

    it("keeps local state when the local version is strictly newer", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 8, serverVersion: 7 })
        ).toBe(false);
    });

    it("hydrates when the server version equals or exceeds local", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 7, serverVersion: 7 })
        ).toBe(true);
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 7, serverVersion: 9 })
        ).toBe(true);
    });

    it("hydrates when either version is unknown", () => {
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: null, serverVersion: 3 })
        ).toBe(true);
        expect(
            shouldHydrateFromServer({ paintedFromCache: true, collabOwnsScene: false, localVersion: 3, serverVersion: null })
        ).toBe(true);
    });
});

import { resolveSceneHydration } from "./projectReadiness";

// Sprint 2 behavior matrix: lite readiness + parallel collab join.
describe("resolveSceneHydration (Sprint 2 readiness matrix)", () => {
    it("collab up + cache hit → paints from cache, lite fetch only", () => {
        expect(resolveSceneHydration({ payloadKind: "lite", collabOutcome: "active", paintedFromCache: true })).toBe("skip");
        expect(resolveSceneHydration({ payloadKind: "lite", collabOutcome: "pending", paintedFromCache: true })).toBe("skip");
    });

    it("collab up + no cache → lite fetch, join syncs the doc; nothing to hydrate yet", () => {
        expect(resolveSceneHydration({ payloadKind: "lite", collabOutcome: "active", paintedFromCache: false })).toBe("skip");
        expect(resolveSceneHydration({ payloadKind: "lite", collabOutcome: "pending", paintedFromCache: false })).toBe("skip");
    });

    it("collab down + cache hit → keeps the cache paint (single-user), no full fetch", () => {
        expect(resolveSceneHydration({ payloadKind: "lite", collabOutcome: "unavailable", paintedFromCache: true })).toBe("skip");
    });

    it("collab down + no cache → fallback full fetch, then hydrate", () => {
        expect(resolveSceneHydration({ payloadKind: "lite", collabOutcome: "unavailable", paintedFromCache: false })).toBe("fallback-fetch");
        // The arriving full scene hydrates when collab is unavailable…
        expect(resolveSceneHydration({ payloadKind: "full", collabOutcome: "unavailable", paintedFromCache: false })).toBe("hydrate");
        // …but never while the live document owns the scene.
        expect(resolveSceneHydration({ payloadKind: "full", collabOutcome: "active", paintedFromCache: false })).toBe("skip");
        expect(resolveSceneHydration({ payloadKind: "full", collabOutcome: "pending", paintedFromCache: false })).toBe("hydrate");
    });
});

import { settleCollabOutcome } from "./projectReadiness";

describe("settleCollabOutcome (Sprint 2 bounded wait)", () => {
    it("keeps a live session active", () => {
        expect(settleCollabOutcome("active", false)).toBe("active");
        expect(settleCollabOutcome("active", true)).toBe("active");
    });

    it("keeps a terminal outcome as-is", () => {
        expect(settleCollabOutcome("unavailable", false)).toBe("unavailable");
        expect(settleCollabOutcome("unavailable", true)).toBe("unavailable");
    });

    it("treats a pending join as unavailable only after the bounded wait elapses", () => {
        // While the join is still trying, readiness must not fall back yet —
        // the live document may sync any moment.
        expect(settleCollabOutcome("pending", false)).toBe("pending");
        // After the wait, a still-pending join is treated as unavailable so the
        // single-user fallback fires (the join keeps retrying in the background).
        expect(settleCollabOutcome("pending", true)).toBe("unavailable");
    });
});
