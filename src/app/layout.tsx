import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/QueryProvider";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { AgentationWrapper } from "@/components/AgentationWrapper";

const inter = Inter({ subsets: ["latin"] });

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
            <body className={inter.className}>
                <Providers>
                    <WorkspaceProvider>
                        {children}
                        <AgentationWrapper />
                    </WorkspaceProvider>
                </Providers>
            </body>
        </html>
    );
}
