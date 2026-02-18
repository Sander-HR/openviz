"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Loader2 } from "lucide-react";

interface GeneralSettingsProps {
    workspace: any;
}

export function GeneralSettings({ workspace }: GeneralSettingsProps) {
    const { refreshWorkspaces } = useWorkspace();
    const [name, setName] = useState(workspace?.name || "");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (workspace) {
            setName(workspace.name);
        }
    }, [workspace]);

    const handleSave = async () => {
        if (!workspace) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/workspaces/${workspace.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });

            if (res.ok) {
                await refreshWorkspaces();
            }
        } catch (error) {
            console.error("Failed to update workspace", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!workspace) return;
        if (!confirm("Are you sure you want to delete this workspace? This action cannot be undone.")) return;
        
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/workspaces/${workspace.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                window.location.href = "/dashboard"; // Redirect to dashboard or another workspace
            }
        } catch (error) {
            console.error("Failed to delete workspace", error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!workspace) return <div>Loading workspace...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">General</h2>
                <p className="text-zinc-400 text-sm">Manage your workspace settings</p>
            </div>

            {/* Workspace Name */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-white">Workspace name</label>
                <div className="max-w-2xl bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-none text-white px-3 py-1.5 focus:outline-none text-sm placeholder:text-zinc-600"
                        placeholder="Workspace Name"
                    />
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || name === workspace.name}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                    >
                        {isSaving && <Loader2 size={14} className="animate-spin" />}
                        Save
                    </button>
                    {name !== workspace.name && (
                        <button
                            onClick={() => setName(workspace.name)}
                            className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            <div className="h-px bg-[#1A1A1A]" />

            {/* Workspace Logo */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-white">Workspace logo</label>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#2A2A2A] rounded-lg flex items-center justify-center text-xl font-bold text-[#A1A1AA] uppercase border border-[#333]">
                        {name?.[0] || "W"}
                    </div>
                    <button className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] border border-[#2A2A2A] text-white text-sm font-medium rounded-md transition-colors">
                        Upload logo
                    </button>
                </div>
                <p className="text-xs text-zinc-500">Recommended size is 256×256px</p>
            </div>

            <div className="h-px bg-[#1A1A1A]" />

            {/* Delete Workspace */}
            <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium text-white">Delete workspace</h3>
                <p className="text-sm text-zinc-400 max-w-xl">
                    Deleting a workspace will permanently delete all of its data, including all files and folders. This action is irreversible.
                </p>
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                >
                    {isDeleting && <Loader2 size={14} className="animate-spin" />}
                    Delete "{workspace.name}"
                </button>
            </div>
        </div>
    );
}
