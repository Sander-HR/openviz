import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process';

// Function to get the Windows host IP from WSL
const getWindowsHostIp = () => {
    try {
        // This is the most reliable way to get the host IP in WSL2
        return execSync("ip route show | grep default | awk '{print $3}'").toString().trim();
    } catch (e) {
        return '127.0.0.1';
    }
}

const hostIp = getWindowsHostIp();
const targetUrl = `http://localhost:9191`;
const targetUrlSecondary = `http://localhost:9191`;

console.log(`📡 WSL Proxy: Targeting Windows host at ${targetUrl} and ${targetUrlSecondary}`);

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/comfy-api-secondary': {
                target: targetUrlSecondary,
                changeOrigin: true,
                secure: false,
                ws: true,
                rewrite: (path) => path.replace(/^\/comfy-api-secondary/, ''),
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        console.log('❌ Secondary Proxy Error:', err);
                    });
                    proxy.on('proxyReq', (proxyReq, req, _res) => {
                        // Spoof origin and referer to match target to bypass ComfyUI security checks
                        proxyReq.setHeader('Origin', targetUrlSecondary);
                        proxyReq.setHeader('Referer', `${targetUrlSecondary}/`);
                        console.log('📤 Sending Request to Secondary:', req.method, req.url);
                    });
                    proxy.on('proxyRes', (proxyRes, req, _res) => {
                        console.log('📥 Received Response from Secondary:', proxyRes.statusCode, req.url);
                    });
                },
            },
            '/comfy-api': {
                target: targetUrl,
                changeOrigin: true,
                secure: false,
                ws: true,
                rewrite: (path) => path.replace(/^\/comfy-api/, ''),
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        console.log('❌ Proxy Error:', err);
                    });
                    proxy.on('proxyReq', (proxyReq, req, _res) => {
                        // Spoof origin and referer to match target to bypass ComfyUI security checks
                        // IMPORTANT: ComfyUI must be started with --listen to allow cross-network connections from WSL
                        proxyReq.setHeader('Origin', targetUrl);
                        proxyReq.setHeader('Referer', `${targetUrl}/`);
                        console.log('📤 Sending Request to:', req.method, req.url);
                    });
                    proxy.on('proxyRes', (proxyRes, req, _res) => {
                        console.log('📥 Received Response:', proxyRes.statusCode, req.url);
                    });
                },
            }
        }
    }
})
