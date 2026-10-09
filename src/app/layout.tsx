import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers/QueryProvider";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { AgentationWrapper } from "@/components/AgentationWrapper";
import { AppAssetPreloader } from "@/components/perf/AppAssetPreloader";

export const metadata: Metadata = {
    title: "OpenViz - AI Powered Design",
    description: "Transform sketches into photorealistic renders",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="font-sans antialiased">
                {/* Hoisted to <head>: start the Inter variable fonts before CSS
                    parse so text never blocks on a 728KB late font download. */}
                <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/fonts/Inter-Variable.woff2" />
                <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/fonts/Inter-Italic-Variable.woff2" />
                <Providers>
                    <WorkspaceProvider>
                        {children}
                        <AgentationWrapper />
                        <AppAssetPreloader />
                    </WorkspaceProvider>
                </Providers>
            </body>
        </html>
    );
}
