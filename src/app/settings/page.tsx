"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { 
    LayoutGrid, 
    Users, 
    Users2, 
    Palette, 
    CreditCard, 
    FileText, 
    User, 
    Rocket,
    ChevronLeft
} from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";

// View Components
import { GeneralSettings } from "./GeneralSettings";
import { ProfileSettings } from "./ProfileSettings";

type View = "general" | "members" | "teams" | "styles" | "billing" | "recovered" | "profile" | "changelog";

export default function SettingsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [activeView, setActiveView] = useState<View>("general");
    const { currentWorkspace } = useWorkspace();

    const navItems = [
        {
            category: "Workspace",
            items: [
                { id: "general", label: "General", icon: LayoutGrid, disabled: false },
                { id: "members", label: "Members", icon: Users, disabled: true },
                { id: "teams", label: "Teams", icon: Users2, disabled: true },
                { id: "styles", label: "Styles", icon: Palette, disabled: true },
                { id: "billing", label: "Plans & Billing", icon: CreditCard, disabled: true },
                { id: "recovered", label: "Recovered Files", icon: FileText, disabled: true },
            ]
        },
        {
            category: "Account",
            items: [
                { id: "profile", label: "Profile", icon: User, disabled: false },
            ]
        },
        {
            category: "App",
            items: [
                { id: "changelog", label: "Changelog", icon: Rocket, disabled: true },
            ]
        }
    ];

    return (
        <div className="flex h-screen w-full bg-[#0A0A0A] text-zinc-400 font-sans">
            {/* Sidebar */}
            <div className="w-64 border-r border-[#1A1A1A] flex flex-col p-4 bg-[#0A0A0A]">
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
                    >
                        <ChevronLeft size={16} />
                        Back
                    </button>
                    <h1 className="text-xl font-bold text-white px-2">Settings</h1>
                </div>

                <div className="space-y-6 overflow-y-auto flex-1">
                    {navItems.map((group, idx) => (
                        <div key={idx}>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-2">
                                {group.category}
                            </h2>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => !item.disabled && setActiveView(item.id as View)}
                                            disabled={item.disabled}
                                            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                                                activeView === item.id
                                                    ? "bg-[#1A1A1A] text-white font-medium"
                                                    : item.disabled
                                                    ? "opacity-50 cursor-not-allowed text-zinc-600"
                                                    : "text-zinc-400 hover:bg-[#1A1A1A] hover:text-white"
                                            }`}
                                        >
                                            <Icon size={16} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-[#0A0A0A]">
                <div className="py-12 px-12">
                    {activeView === "general" && <GeneralSettings workspace={currentWorkspace} />}
                    {activeView === "profile" && <ProfileSettings user={session?.user} />}
                </div>
            </div>
        </div>
    );
}
