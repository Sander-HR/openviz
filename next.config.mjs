import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Allow remote dev access (e.g. Tailscale IP) so HMR websocket and
    // cross-origin dev resource requests from that host are not blocked.
    allowedDevOrigins: ['100.77.89.74'],
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
                destination: 'http://localhost:9191/:path*',
            },
            {
                source: '/comfy-api-secondary/:path*',
                destination: 'http://localhost:9191/:path*',
            },
        ];
    },
};

export default nextConfig;
