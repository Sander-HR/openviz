import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

/**
 * Next.js (dev/Turbopack) rewrites `req.url` to the internal loopback address
 * (e.g. http://localhost:3001/...), while the real host is preserved in the
 * Host / x-forwarded-host headers. Auth.js derives its origin from `req.url`,
 * so auth redirects would always point at localhost even when the app is
 * reached through a remote URL (e.g. Tailscale).
 *
 * This helper rewrites the request URL to match the incoming host header, so
 * all generated auth URLs/redirects use the origin the browser actually used.
 */
function withRequestHost(req: NextRequest): NextRequest {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!host) return req;

    try {
        const url = new URL(req.url);
        if (url.host === host) return req;

        const proto = (req.headers.get("x-forwarded-proto") ?? "http")
            .split(",")[0]
            .trim();
        url.protocol = `${proto}:`;
        url.host = host;
        return new NextRequest(url.toString(), req);
    } catch {
        return req;
    }
}

export async function GET(req: NextRequest) {
    return handlers.GET(withRequestHost(req));
}

export async function POST(req: NextRequest) {
    return handlers.POST(withRequestHost(req));
}
