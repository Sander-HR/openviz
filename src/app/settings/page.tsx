"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { 
    LayoutGrid, 
    Users, 
    Users2, 
    Palette,
    Cpu,
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
import { AIComputeSettings } from "@/components/settings/AIComputeSettings";

type View = "general" | "ai-compute" | "members" | "teams" | "styles" | "billing" | "recovered" | "profile" | "changelog";

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
                { id: "ai-compute", label: "AI & Compute", icon: Cpu, disabled: false },
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

    // Mobile tab bar only offers live views; the desktop sidebar keeps the full list.
    const mobileNavItems = navItems.flatMap((group) => group.items).filter((item) => !item.disabled);

    return (
        <div className="flex h-dvh w-full bg-[#0A0A0A] text-zinc-400">
            {/* Sidebar — desktop only */}
            <div className="hidden w-64 shrink-0 flex-col border-r border-[#1A1A1A] bg-[#0A0A0A] p-4 md:flex">
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

            {/* Content column */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Mobile header + tab bar */}
                <header className="border-b border-[#1A1A1A] bg-[#0A0A0A] md:hidden">
                    <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                        <button
                            onClick={() => router.back()}
                            aria-label="Go back"
                            className="-ml-1 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-[#1A1A1A] hover:text-white"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-lg font-bold text-white">Settings</h1>
                    </div>
                    <nav
                        aria-label="Settings sections"
                        className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {mobileNavItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveView(item.id as View)}
                                    aria-current={activeView === item.id ? "page" : undefined}
                                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeView === item.id
                                            ? "border-violet-500/40 bg-[#1A1A1A] text-white"
                                            : "border-[#2A2A2A] text-zinc-400 hover:text-white"
                                    }`}
                                >
                                    <Icon size={13} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto bg-[#0A0A0A]">
                    <div className="px-4 py-6 sm:px-8 md:px-12 md:py-12">
                        {activeView === "general" && <GeneralSettings workspace={currentWorkspace} />}
                        {activeView === "ai-compute" && <AIComputeSettings />}
                        {activeView === "profile" && <ProfileSettings user={session?.user} />}
                    </div>
                </main>
            </div>
        </div>
    );
}
