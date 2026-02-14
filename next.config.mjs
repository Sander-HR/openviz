/** @type {import('next').NextConfig} */
const nextConfig = {
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
