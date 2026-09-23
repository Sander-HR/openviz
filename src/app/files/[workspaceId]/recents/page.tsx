"use client";

import { useState, useMemo } from "react";

import { SideNav } from "@/components/dashboard/SideNav";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { FilterDropdown } from "@/components/dashboard/FilterDropdown";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Plus, LayoutGrid, List } from "lucide-react";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";

const sortOptions = [
    { value: "lastViewed", label: "Last viewed" },
    { value: "created", label: "Created date" },
    { value: "name", label: "Name" },
    { value: "updated", label: "Last updated" },
];

const ownerOptions = [
    { value: "anyone", label: "Anyone" },
    { value: "me", label: "Created by me" },
];

type ViewMode = "grid" | "list";

export default function RecentsPage() {
    const { projects, isLoading, createProject, isCreating } = useProjects();
    const { currentWorkspace } = useWorkspace();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortBy, setSortBy] = useState("lastViewed");
    const [ownerFilter, setOwnerFilter] = useState("anyone");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const setViewModeStore = useStore((state) => state.setViewMode);
    const router = useRouter();

    const filteredProjects = useMemo(() => {
        const sorted = [...projects];

        switch (sortBy) {
            case "lastViewed":
                sorted.sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime());
                break;
            case "created":
                sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
            case "updated":
                sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                break;
            case "name":
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }

        return sorted;
    }, [projects, sortBy]);

    const handleCreateProject = () => {
        setIsModalOpen(true);
    };

    const handleConfirmCreate = (name: string, mode: 'STUDIO' | 'WORKBENCH') => {
        if (!currentWorkspace?.id) {
            alert("Please wait for the workspace to load or refresh the page.");
            return;
        }
        createProject(
            { name },
            {
                onSuccess: (data) => {
                    setViewModeStore(mode);
                    setIsModalOpen(false);
                    router.push(`/projects/${data.id}`);
                },
                onError: (error) => {
                    console.error("Failed to create project:", error);
                    alert("Failed to create project. Please try again.");
                },
            }
        );
    };

    return (
        <div className="flex h-screen bg-[#0F0F0F] text-white w-full">
            <SideNav pageMode="recents" />

            <main className="min-w-0 flex-1 flex flex-col overflow-hidden w-full">
                <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[#1A1A1A] px-4 py-3 pl-16 shrink-0 w-full md:h-14 md:px-6 md:py-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-semibold">Recents</h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden sm:block">
                        <FilterDropdown
                            label="Sort"
                            options={sortOptions}
                            value={sortBy}
                            onChange={setSortBy}
                        />
                        </div>
                        <div className="hidden sm:block">
                        <FilterDropdown
                            label="Anyone"
                            options={ownerOptions}
                            value={ownerFilter}
                            onChange={setOwnerFilter}
                        />
                        </div>

                        <div className="hidden h-4 w-[1px] bg-[#2A2A2A] mx-2 sm:block" />

                        <div className="hidden bg-[#1A1A1A] rounded-lg p-0.5 border border-[#2A2A2A] sm:flex">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-[#2A2A2A] text-white" : "text-zinc-500 hover:text-white"}`}
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-[#2A2A2A] text-white" : "text-zinc-500 hover:text-white"}`}
                            >
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
                                    <span className="hidden sm:inline">Create new file</span>
                                    <span className="sm:hidden">New</span>
                                </>
                            )}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden">
                    {viewMode === "grid" ? (
                        <ProjectGrid
                            projects={filteredProjects}
                            isLoading={isLoading}
                            showFolders={false}
                            folders={[]}
                            onFolderClick={() => {}}
                        />
                    ) : (
                        <ProjectList
                            projects={filteredProjects}
                            isLoading={isLoading}
                            showFolders={false}
                            workspaces={[]}
                            onFolderClick={() => {}}
                            folderPath={[]}
                            onBreadcrumbClick={() => {}}
                        />
                    )}
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