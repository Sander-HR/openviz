"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const { data: session } = useSession();
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white">
            <div className="max-w-4xl mx-auto p-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="text-zinc-400 hover:text-white mb-4 flex items-center gap-2 text-sm"
                    >
                        ← Back
                    </button>
                    <h1 className="text-3xl font-bold">Settings</h1>
                    <p className="text-zinc-400 mt-2">Manage your account and preferences</p>
                </div>

                {/* Account Section */}
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Account</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-zinc-400">Name</label>
                            <div className="mt-1 text-white">{session?.user?.name || 'Not set'}</div>
                        </div>
                        <div>
                            <label className="text-sm text-zinc-400">Email</label>
                            <div className="mt-1 text-white">{session?.user?.email || 'Not set'}</div>
                        </div>
                    </div>
                </div>

                {/* Preferences Section */}
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Preferences</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium">Theme</div>
                                <div className="text-sm text-zinc-400">Currently using dark mode</div>
                            </div>
                            <div className="text-zinc-500 text-sm">Coming soon</div>
                        </div>
                        <div className="h-px bg-[#2A2A2A]" />
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium">Notifications</div>
                                <div className="text-sm text-zinc-400">Manage notification preferences</div>
                            </div>
                            <div className="text-zinc-500 text-sm">Coming soon</div>
                        </div>
                    </div>
                </div>

                {/* About Section */}
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4">About</h2>
                    <div className="space-y-2 text-sm text-zinc-400">
                        <div>OpenViz - AI Powered Design</div>
                        <div>Version 1.0.0</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
