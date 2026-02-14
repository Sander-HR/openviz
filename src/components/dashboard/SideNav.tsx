"use client";

import {
    Clock,
    Files,
    GraduationCap,
    Trash2,
    Settings,
    HelpCircle,
    Plus,
    ChevronDown,
    Search,
    LogOut,
    Check
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";
import { useWorkspace } from "@/context/WorkspaceContext";

export function SideNav() {
    const router = useRouter();
    const { data: session } = useSession();
    const { workspaces, currentWorkspace, setCurrentWorkspace, refreshWorkspaces } = useWorkspace();
    const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const workspaceDropdownRef = useRef<HTMLDivElement>(null);
    const userDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
                setIsWorkspaceDropdownOpen(false);
            }
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
                setIsUserDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCreateWorkspace = async (name: string) => {
        try {
            const res = await fetch("/api/workspaces", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });

            if (res.ok) {
                await refreshWorkspaces();
                setIsCreateModalOpen(false);
                setIsWorkspaceDropdownOpen(false);
            }
        } catch (error) {
            console.error("Failed to create workspace", error);
        }
    };

    return (
        <div className="w-64 bg-[#0A0A0A] border-r border-[#1A1A1A] flex flex-col h-screen text-zinc-400">
            <div className="p-4 relative">
                {/* Workspace Selector */}
                <div
                    onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                    className="flex items-center justify-between p-2 hover:bg-[#1A1A1A] rounded-lg cursor-pointer transition-colors group"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 min-w-[32px] bg-zinc-800 rounded flex items-center justify-center text-xs font-bold text-white uppercase">
                            {currentWorkspace?.name?.[0] || 'W'}
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-semibold text-white truncate">
                                {currentWorkspace?.name || "Loading..."}
                            </div>
                        </div>
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isWorkspaceDropdownOpen ? 'rotate-180 text-white' : 'group-hover:text-white'}`} />
                </div>

                {/* Workspace Dropdown */}
                {isWorkspaceDropdownOpen && (
                    <div ref={workspaceDropdownRef} className="absolute left-4 right-4 top-16 z-20 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-2">
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 mb-1">
                                Your Workspaces
                            </div>
                            <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                {workspaces.map((ws) => (
                                    <div
                                        key={ws.id}
                                        onClick={() => {
                                            setCurrentWorkspace(ws);
                                            setIsWorkspaceDropdownOpen(false);
                                        }}
                                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-sm ${currentWorkspace?.id === ws.id ? 'bg-[#2A2A2A] text-white' : 'text-zinc-400 hover:text-white hover:bg-[#252525]'}`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <div className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center text-[10px] font-bold uppercase">
                                                {ws.name[0]}
                                            </div>
                                            <span className="truncate">{ws.name}</span>
                                        </div>
                                        {currentWorkspace?.id === ws.id && <Check size={14} className="text-indigo-500" />}
                                    </div>
                                ))}
                            </div>
                            <div className="h-px bg-[#2A2A2A] my-2" />
                            <div
                                onClick={() => {
                                    setIsCreateModalOpen(true);
                                    setIsWorkspaceDropdownOpen(false);
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm text-zinc-400 hover:text-white hover:bg-[#252525]"
                            >
                                <Plus size={14} />
                                <span>Create New Workspace</span>
                            </div>
                            <div className="h-px bg-[#2A2A2A] my-2" />
                            <div
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm text-red-400 hover:bg-[#252525]"
                            >
                                <LogOut size={14} />
                                <span>Log out</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="px-4 mb-4">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search all files"
                        className="w-full bg-[#1A1A1A] border-none rounded-lg py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <nav className="flex-1 px-2 space-y-0.5">
                <NavItem icon={<Clock size={16} />} label="Recents" active />
                <NavItem icon={<Files size={16} />} label="My Files" />
                <NavItem icon={<GraduationCap size={16} />} label="Learn" />

                <div className="pt-6 pb-2 px-4 flex items-center justify-between group">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Team</span>
                    <Plus size={14} className="cursor-pointer hover:text-white transition-colors" />
                </div>

                {currentWorkspace && (
                    <div className="flex items-center gap-3 px-3 py-2 text-sm text-white bg-[#1A1A1A] rounded-lg cursor-pointer">
                        <div className="w-4 h-4 bg-orange-600 rounded flex items-center justify-center text-[10px] font-bold uppercase">
                            {currentWorkspace.name[0]}
                        </div>
                        <span className="truncate">{currentWorkspace.name}</span>
                    </div>
                )}
            </nav>

            <div className="p-2 space-y-0.5 border-t border-[#1A1A1A]">
                <NavItem icon={<Trash2 size={16} />} label="Trash" />
                <div onClick={() => router.push('/settings')}>
                    <NavItem icon={<Settings size={16} />} label="Settings" />
                </div>
                <NavItem icon={<HelpCircle size={16} />} label="Help & feedback" />
            </div>

            <div className="p-4 border-t border-[#1A1A1A] relative">
                <div
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center gap-3 p-2 hover:bg-[#1A1A1A] rounded-lg cursor-pointer transition-colors"
                >
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {session?.user?.name?.[0] || 'S'}
                    </div>
                    <div className="overflow-hidden flex-1">
                        <div className="text-xs font-medium text-white truncate">{session?.user?.name || 'User'}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{session?.user?.email || 'user@example.com'}</div>
                    </div>
                </div>

                {/* User Dropdown */}
                {isUserDropdownOpen && (
                    <div ref={userDropdownRef} className="absolute left-4 right-4 bottom-20 z-20 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 slide-in-from-bottom-2">
                        <div className="p-2">
                            <div className="px-2 py-1.5 mb-1 border-b border-[#2A2A2A]">
                                <div className="text-sm font-medium text-white truncate">{session?.user?.name}</div>
                                <div className="text-xs text-zinc-500 truncate">{session?.user?.email}</div>
                            </div>
                            <div className="space-y-0.5">
                                <div
                                    onClick={() => router.push('/settings')}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm text-zinc-400 hover:text-white hover:bg-[#252525]"
                                >
                                    <Settings size={14} />
                                    <span>Settings</span>
                                </div>
                                <div
                                    onClick={() => signOut({ callbackUrl: "/login" })}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm text-red-400 hover:bg-[#252525]"
                                >
                                    <LogOut size={14} />
                                    <span>Log out</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <CreateWorkspaceModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onConfirm={handleCreateWorkspace}
            />
        </div>
    );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
    return (
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${active ? 'bg-[#1A1A1A] text-white' : 'hover:bg-[#1A1A1A] hover:text-white'}`}>
            {icon}
            <span>{label}</span>
        </div>
    );
}

