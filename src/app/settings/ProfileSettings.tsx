"use client";

import { useState } from "react";
import { User } from "next-auth";
import { Loader2 } from "lucide-react";

interface ProfileSettingsProps {
    user: User | undefined;
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
    const [name, setName] = useState(user?.name || "");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const res = await fetch("/api/user", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });

            if (res.ok) {
                // Ideally, we should refresh the session or user data here
                window.location.reload(); 
            }
        } catch (error) {
            console.error("Failed to update profile", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
        
        setIsDeleting(true);
        try {
            const res = await fetch("/api/user", {
                method: "DELETE",
            });

            if (res.ok) {
                window.location.href = "/login";
            }
        } catch (error) {
            console.error("Failed to delete account", error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!user) return <div>Loading profile...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Profile</h2>
                <p className="text-zinc-400 text-sm">Manage your account profile</p>
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-white">Email</label>
                <div className="max-w-2xl bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-2 px-3 text-zinc-500 text-sm">
                    {user.email}
                </div>
            </div>

            {/* Name */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-white">Name</label>
                <div className="max-w-2xl bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-none text-white px-3 py-1.5 focus:outline-none text-sm placeholder:text-zinc-600"
                        placeholder="Your Name"
                    />
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || name === user.name}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                    >
                        {isSaving && <Loader2 size={14} className="animate-spin" />}
                        Save
                    </button>
                    {name !== user.name && (
                        <button
                            onClick={() => setName(user.name || "")}
                            className="px-4 py-2 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            <div className="h-px bg-[#1A1A1A]" />

            {/* Password */}
            <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium text-white">Password</h3>
                <p className="text-sm text-zinc-400 max-w-xl">
                    To add a password to your account, please follow the password reset flow.
                </p>
                <button
                    className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] border border-[#2A2A2A] text-white text-sm font-medium rounded-md transition-colors"
                >
                    Reset Password
                </button>
            </div>

            <div className="h-px bg-[#1A1A1A]" />

            {/* Delete Account */}
            <div className="space-y-4 pt-2">
                <h3 className="text-lg font-medium text-white">Delete account</h3>
                <p className="text-sm text-zinc-400 max-w-xl">
                    Deleting your account will permanently remove all your data. This action is irreversible.
                </p>
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                >
                    {isDeleting && <Loader2 size={14} className="animate-spin" />}
                    Delete Account
                </button>
            </div>
        </div>
    );
}
