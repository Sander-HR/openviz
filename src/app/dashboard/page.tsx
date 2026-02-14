"use client";

import { useState } from "react";

import { SideNav } from "@/components/dashboard/SideNav";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { useProjects } from "@/hooks/useProjects";
import { Plus, LayoutGrid, List, ChevronDown } from "lucide-react";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { projects, isLoading, createProject, isCreating } = useProjects();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const setViewMode = useStore((state) => state.setViewMode);
    const router = useRouter();

    const handleCreateProject = () => {
        setIsModalOpen(true);
    };

    const handleConfirmCreate = (name: string, mode: 'STUDIO' | 'WORKBENCH') => {
        createProject(
            { name },
            {
                onSuccess: (data) => {
                    setViewMode(mode);
                    setIsModalOpen(false);
                    router.push(`/projects/${data.id}`);
                },
            }
        );
    };

    return (
        <div className="flex h-screen bg-[#0F0F0F] text-white w-full">
            <SideNav />

            <main className="flex-1 flex flex-col overflow-hidden w-full">
                {/* Top Header */}
                <header className="h-14 border-b border-[#1A1A1A] flex items-center justify-between px-6 shrink-0 w-full">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-semibold">Recents</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 p-1.5 px-3 text-xs font-medium bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] hover:bg-[#2A2A2A] transition-colors">
                            Last viewed <ChevronDown size={14} />
                        </button>
                        <button className="flex items-center gap-2 p-1.5 px-3 text-xs font-medium bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] hover:bg-[#2A2A2A] transition-colors">
                            All locations <ChevronDown size={14} />
                        </button>
                        <button className="flex items-center gap-2 p-1.5 px-3 text-xs font-medium bg-[#1A1A1A] rounded-lg border border-[#2A2A2A] hover:bg-[#2A2A2A] transition-colors">
                            Anyone <ChevronDown size={14} />
                        </button>

                        <div className="w-[1px] h-4 bg-[#2A2A2A] mx-2" />

                        <div className="flex bg-[#1A1A1A] rounded-lg p-0.5 border border-[#2A2A2A]">
                            <button className="p-1 rounded bg-[#2A2A2A] text-white">
                                <LayoutGrid size={14} />
                            </button>
                            <button className="p-1 rounded text-zinc-500 hover:text-white">
                                <List size={14} />
                            </button>
                        </div>

                        <button
                            onClick={handleCreateProject}
                            disabled={isCreating}
                            className="ml-4 flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {isCreating ? "Creating..." : (
                                <>
                                    <Plus size={14} />
                                    Create new file
                                </>
                            )}
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    <ProjectGrid projects={projects} isLoading={isLoading} />
                </div>
            </main>

            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmCreate}
                isCreating={isCreating}
            />
        </div>
    );
}
