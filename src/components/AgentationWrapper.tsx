"use client";

import { Agentation } from "agentation";

export function AgentationWrapper() {
    if (process.env.NODE_ENV !== "development") return null;

    // Only connect to a sync server when one is explicitly configured; without
    // an endpoint Agentation runs in local-only mode. Hardcoding
    // http://localhost:4747 made every page load log a failed session fetch
    // ("Failed to initialize session, using local storage") for anyone not
    // running the Agentation server.
    const endpoint = process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || undefined;

    return (
        <Agentation
            className="agentation-bottom-left"
            endpoint={endpoint}
            onSessionCreated={(sessionId) => {
                console.log("Session started:", sessionId);
            }}
        />
    );
}
