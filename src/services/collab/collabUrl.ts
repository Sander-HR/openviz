const DEFAULT_COLLAB_PORT = '1234';

interface BrowserLocation {
    protocol: string;
    hostname: string;
}

export interface CollabServerConfig {
    /** Single endpoint applied to every browser (legacy `NEXT_PUBLIC_COLLAB_URL`). */
    url?: string;
    /** Exact page-hostname → endpoint overrides, parsed from `NEXT_PUBLIC_COLLAB_URLS`. */
    byHost?: Record<string, string>;
}

/**
 * Parses a comma-separated list of `host=url` pairs into a hostname map.
 * Hosts are lower-cased (hostnames are case-insensitive). Malformed entries
 * (no `=`, empty host or URL) are skipped so one bad pair cannot break the
 * whole list.
 */
export function parseCollabUrlMap(raw?: string): Record<string, string> {
    const map: Record<string, string> = {};
    if (!raw) return map;
    for (const entry of raw.split(',')) {
        const trimmed = entry.trim();
        const separator = trimmed.indexOf('=');
        if (separator <= 0) continue;
        const host = trimmed.slice(0, separator).trim().toLowerCase();
        const url = trimmed.slice(separator + 1).trim();
        if (host && url) map[host] = url;
    }
    return map;
}

/**
 * Resolves the collaboration WebSocket endpoint for the current browser.
 *
 * Resolution order:
 * 1. Exact hostname match in `byHost` — lets each deployment domain dial its
 *    own server (e.g. localhost direct, a devtunnel for remote clients).
 * 2. The single configured `url`, when set.
 * 3. Derived from the page location: same host as the app with port 1234, so
 *    LAN/Tailscale/remote hosts work without configuration. Azure Dev Tunnels
 *    are special-cased: their subdomain already encodes the forwarded port
 *    (`<id>-1234.<region>.devtunnels.ms`), so no explicit port is appended.
 */
export function resolveCollabServerUrl(
    config: CollabServerConfig = {},
    browserLocation?: BrowserLocation,
): string {
    const location = browserLocation ?? (typeof window !== 'undefined' ? window.location : undefined);
    if (!location) return config.url ?? `ws://localhost:${DEFAULT_COLLAB_PORT}`;

    const byHost = config.byHost;
    if (byHost) {
        const match = byHost[location.hostname.toLowerCase()];
        if (match) return match;
    }
    if (config.url) return config.url;
    return deriveFromLocation(location);
}

function deriveFromLocation(location: BrowserLocation): string {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (location.hostname.endsWith('.devtunnels.ms')) {
        // The tunnel subdomain names the forwarded port (e.g. `-1234`);
        // appending a port would dial a closed port on the tunnel host.
        return `${protocol}//${location.hostname}`;
    }
    return `${protocol}//${location.hostname}:${DEFAULT_COLLAB_PORT}`;
}
