"use client";

import { useEffect } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { currentWorkspace } = useWorkspace();
    const router = useRouter();

    useEffect(() => {
        if (currentWorkspace?.id) {
            router.replace(`/files/${currentWorkspace.id}`);
        }
    }, [currentWorkspace?.id, router]);

    return (
        <div className="flex h-screen bg-[#0F0F0F] text-white w-full items-center justify-center">
            <div className="text-zinc-400">Loading...</div>
        </div>
    );
}
