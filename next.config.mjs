/** @type {import('next').NextConfig} */
const nextConfig = {
    // Disable experimental CSS optimization to reduce memory usage
    experimental: {
        optimizeCss: false,
    },
    // Disable type checking during build (run separately with tsc)
    typescript: {
        ignoreBuildErrors: true,
    },
    // Disable eslint during build (run separately with npm run lint)
    eslint: {
        ignoreDuringBuilds: true,
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
