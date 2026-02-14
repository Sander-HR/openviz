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
    LogOut
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export function SideNav() {
    const { data: session } = useSession();

    return (
        <div className="w-64 bg-[#0A0A0A] border-r border-[#1A1A1A] flex flex-col h-screen text-zinc-400">
            <div className="p-4">
                <div className="flex items-center justify-between p-2 hover:bg-[#1A1A1A] rounded-lg cursor-pointer transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center text-xs font-bold text-white">
                            IPO
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-white">IPO Workspace</div>
                            <div className="text-[10px] text-zinc-500">Edu plan</div>
                        </div>
                    </div>
                    <ChevronDown size={14} className="group-hover:text-white" />
                </div>
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

                <div className="flex items-center gap-3 px-3 py-2 text-sm text-white bg-[#1A1A1A] rounded-lg cursor-pointer">
                    <div className="w-4 h-4 bg-orange-600 rounded flex items-center justify-center text-[10px] font-bold">I</div>
                    <span>IPO Workspace</span>
                </div>
            </nav>

            <div className="p-2 space-y-0.5 border-t border-[#1A1A1A]">
                <NavItem icon={<Trash2 size={16} />} label="Trash" />
                <NavItem icon={<Settings size={16} />} label="Settings" />
                <NavItem icon={<HelpCircle size={16} />} label="Help & feedback" />
                <div onClick={() => signOut({ callbackUrl: "/login" })}>
                    <NavItem icon={<LogOut size={16} />} label="Logout" />
                </div>
            </div>

            <div className="p-4 border-t border-[#1A1A1A]">
                <div className="flex items-center gap-3 p-2 hover:bg-[#1A1A1A] rounded-lg cursor-pointer transition-colors">
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {session?.user?.name?.[0] || 'S'}
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-xs font-medium text-white truncate">{session?.user?.name || 'Sander Homs'}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{session?.user?.email || 'homss@hr.nl'}</div>
                    </div>
                </div>
            </div>
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
