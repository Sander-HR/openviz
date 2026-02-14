"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Workspace {
    id: string;
    name: string;
    slug: string;
    role: string;
}

interface WorkspaceContextType {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    setCurrentWorkspace: (workspace: Workspace) => void;
    isLoading: boolean;
    refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchWorkspaces = async () => {
        if (!session?.user?.id) return;
        setIsLoading(true);
        try {
            const res = await fetch("/api/workspaces");
            if (res.ok) {
                const data = await res.json();
                setWorkspaces(data);

                // If we don't have a current workspace, or the current one is not in the list, set default
                if (data.length > 0) {
                    // Try to find the previously selected workspace from localStorage? 
                    // For now, just default to the first one if current is null or invalid
                    if (!currentWorkspace || !data.find((w: Workspace) => w.id === currentWorkspace.id)) {
                        setCurrentWorkspace(data[0]);
                    }
                } else {
                    setCurrentWorkspace(null);
                }
            }
        } catch (error) {
            console.error("Failed to fetch workspaces", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.id) {
            fetchWorkspaces();
        } else {
            setWorkspaces([]);
            setCurrentWorkspace(null);
            setIsLoading(false);
        }
    }, [session?.user?.id]);

    return (
        <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, setCurrentWorkspace, isLoading, refreshWorkspaces: fetchWorkspaces }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error("useWorkspace must be used within a WorkspaceProvider");
    }
    return context;
}
