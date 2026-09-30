"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { useStore } from "@/store/useStore";

export function Providers({ children }: { children: React.ReactNode }) {
    const viewMode = useStore((state) => state.viewMode);
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        retry: 1,
                    },
                },
            })
    );

    return (
        <SessionProvider>
            <QueryClientProvider client={queryClient}>
                {children}
                {/* Hidden in workbench mode to keep the canvas uncluttered */}
                {viewMode !== "WORKBENCH" && (
                    <ReactQueryDevtools initialIsOpen={false} />
                )}
            </QueryClientProvider>
        </SessionProvider>
    );
}
