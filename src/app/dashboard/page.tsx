"use client";

import { useEffect } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { currentWorkspace, isLoading } = useWorkspace();
    const router = useRouter();

    useEffect(() => {
        if (currentWorkspace?.id) {
            router.replace(`/files/${currentWorkspace.id}`);
        }
    }, [currentWorkspace?.id, router]);

    if (isLoading) {
        return (
            <div className="flex h-screen bg-[#0F0F0F] text-white w-full items-center justify-center">
                <div className="text-zinc-400">Loading workspace...</div>
            </div>
        );
    }

    if (!currentWorkspace) {
        return (
            <div className="flex h-screen bg-[#0F0F0F] text-white w-full items-center justify-center px-6 text-center">
                <div>
                    <p className="text-zinc-300">No workspace is available for this account.</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                        Reload dashboard
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
