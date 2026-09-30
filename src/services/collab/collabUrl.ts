const DEFAULT_COLLAB_PORT = '1234';

interface BrowserLocation {
    protocol: string;
    hostname: string;
}

/**
 * Resolves the collaboration WebSocket endpoint for the current browser.
 *
 * The collab server runs on its own port, so an unset public URL must use the
 * page's hostname rather than localhost. This is important when the app is
 * opened through a LAN address, Tailscale, or another remote host.
 */
export function resolveCollabServerUrl(
    configuredUrl?: string,
    browserLocation?: BrowserLocation,
): string {
    if (configuredUrl) return configuredUrl;

    const location = browserLocation ?? (typeof window !== 'undefined' ? window.location : undefined);
    if (!location) return `ws://localhost:${DEFAULT_COLLAB_PORT}`;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.hostname}:${DEFAULT_COLLAB_PORT}`;
}
