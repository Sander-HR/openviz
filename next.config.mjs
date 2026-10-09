import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const comfyUiUrl = process.env.COMFYUI_URL || 'http://localhost:8188';

// Extra origins for remote dev access (comma-separated), e.g. your LAN IP.
const extraDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Allow remote dev access (e.g. Tailscale IP, LAN IP) so HMR websocket and
    // cross-origin dev resource requests from those hosts are not blocked.
    allowedDevOrigins: ['100.77.89.74', ...extraDevOrigins],
    // Force Next/Turbopack to treat this folder as the project root.
    // Prevents dependency resolution from drifting to parent directories
    // when multiple lockfiles exist on the machine.
    turbopack: {
        root: projectRoot,
    },
    outputFileTracingRoot: projectRoot,
    // Disable experimental CSS optimization to reduce memory usage
    experimental: {
        optimizeCss: false,
    },
    // Disable type checking during build (run separately with tsc)
    typescript: {
        ignoreBuildErrors: true,
    },
    async rewrites() {
        return [
            {
                source: '/comfy-api/:path*',
                destination: `${comfyUiUrl}/:path*`,
            },
            {
                source: '/comfy-api-secondary/:path*',
                destination: `${comfyUiUrl}/:path*`,
            },
        ];
    },
    async headers() {
        return [
            {
                // Fonts are served from /public with no cache headers by
                // default (max-age=0) — 728KB re-downloaded on every page.
                // Cache one day, then revalidate while serving stale up to a
                // week so an updated font file can't be pinned for a year.
                source: '/fonts/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
