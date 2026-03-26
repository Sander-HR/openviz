"use client";

import { useState, useMemo } from "react";

import { SideNav } from "@/components/dashboard/SideNav";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { FilterDropdown } from "@/components/dashboard/FilterDropdown";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Plus, LayoutGrid, List, FolderPlus, ChevronRight, Home } from "lucide-react";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { CreateFolderModal } from "@/components/dashboard/CreateFolderModal";
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

type PageMode = "recents" | "myFiles";
type ViewMode = "grid" | "list";

interface FolderPath {
    id: string;
    name: string;
}

interface Folder {
    id: string;
    name: string;
    parentId: string | null;
    createdAt: Date;
}

interface FolderItem {
    id: string;
    name: string;
}

export default function DashboardPage() {
    const { projects, isLoading, createProject, isCreating } = useProjects();
    const { workspaces, currentWorkspace } = useWorkspace();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [sortBy, setSortBy] = useState("lastViewed");
    const [ownerFilter, setOwnerFilter] = useState("anyone");
    const [pageMode, setPageModeState] = useState<PageMode>("recents");
    const [viewMode, setViewModeState] = useState<ViewMode>("grid");
    const [folderPath, setFolderPath] = useState<FolderPath[]>([]);
    const [createdFolders, setCreatedFolders] = useState<Folder[]>([]);
    const setViewMode = useStore((state) => state.setViewMode);
    const router = useRouter();

    // Reset to grid view when switching to My Files
    const handlePageModeChange = (mode: PageMode | ((prev: PageMode) => PageMode)) => {
        const newMode = typeof mode === "function" ? mode(pageMode) : mode;
        setPageModeState(newMode);
        if (newMode === "myFiles") {
            setViewModeState("grid");
            setFolderPath([]);
        }
    };

    // Get current parent folder ID from path
    const currentParentId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;

    // Combine workspaces and created folders, filter by current parent
    const allFolders: FolderItem[] = [
        ...workspaces
            .filter(ws => ws.id !== workspaces[0]?.id)
            .map(ws => ({ id: ws.id, name: ws.name })),
        ...createdFolders
            .filter(f => f.parentId === currentParentId)
            .map(f => ({ id: f.id, name: f.name }))
    ];

    const filteredProjects = useMemo(() => {
        const sorted = [...projects];

        // Sort projects
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
    }, [projects, sortBy, ownerFilter]);

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
                    setViewMode(mode);
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

    const handleFolderClick = (folderId: string) => {
        const folder = workspaces.find(ws => ws.id === folderId);
        if (folder) {
            setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
        }
    };

    const handleBreadcrumbClick = (folderId: string | null) => {
        if (folderId === null) {
            setFolderPath([]);
        } else {
            const index = folderPath.findIndex(f => f.id === folderId);
            if (index >= 0) {
                setFolderPath(folderPath.slice(0, index + 1));
            }
        }
    };

    const handleCreateFolder = (name: string) => {
        const newFolder: Folder = {
            id: `folder-${Date.now()}`,
            name,
            parentId: currentParentId,
            createdAt: new Date(),
        };
        setCreatedFolders(prev => [...prev, newFolder]);
        setIsCreateFolderOpen(false);
    };

    // Build title with breadcrumbs
    const renderTitle = () => {
        if (pageMode === "recents") {
            return <h2 className="text-sm font-semibold">Recents</h2>;
        }

        return (
            <div className="flex items-center gap-1 text-sm">
                <button
                    onClick={() => setFolderPath([])}
                    className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
                >
                    <Home size={14} />
                    <span className="font-semibold">My Files</span>
                </button>
                {folderPath.map((folder, index) => (
                    <button
                        key={folder.id}
                        onClick={() => handleBreadcrumbClick(index === folderPath.length - 1 ? null : folder.id)}
                        className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
                    >
                        <ChevronRight size={14} className="text-zinc-600" />
                        <span className={index === folderPath.length - 1 ? "font-semibold" : "text-zinc-400"}>
                            {folder.name}
                        </span>
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-[#0F0F0F] text-white w-full">
            <SideNav pageMode={pageMode} onPageModeChange={handlePageModeChange} />

            <main className="flex-1 flex flex-col overflow-hidden w-full">
                {/* Top Header */}
                <header className="h-14 border-b border-[#1A1A1A] flex items-center justify-between px-6 shrink-0 w-full">
                    <div className="flex items-center gap-4">
                        {renderTitle()}
                    </div>

                    <div className="flex items-center gap-2">
                        <FilterDropdown
                            label="Sort"
                            options={sortOptions}
                            value={sortBy}
                            onChange={setSortBy}
                        />
                        <FilterDropdown
                            label="Anyone"
                            options={ownerOptions}
                            value={ownerFilter}
                            onChange={setOwnerFilter}
                        />

                        <div className="w-[1px] h-4 bg-[#2A2A2A] mx-2" />

                        <div className="flex bg-[#1A1A1A] rounded-lg p-0.5 border border-[#2A2A2A]">
                            <button
                                onClick={() => setViewModeState("grid")}
                                className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-[#2A2A2A] text-white" : "text-zinc-500 hover:text-white"}`}
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button
                                onClick={() => setViewModeState("list")}
                                className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-[#2A2A2A] text-white" : "text-zinc-500 hover:text-white"}`}
                            >
                                <List size={14} />
                            </button>
                        </div>

                        {pageMode === "myFiles" && (
                            <button
                                onClick={() => setIsCreateFolderOpen(true)}
                                className="flex items-center gap-2 px-4 py-1.5 bg-[#1A1A1A] hover:bg-[#252525] border border-[#2A2A2A] rounded-lg text-xs font-medium transition-all"
                            >
                                <FolderPlus size={14} />
                                Create Folder
                            </button>
                        )}

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
                    {viewMode === "grid" ? (
                        <ProjectGrid
                            projects={filteredProjects}
                            isLoading={isLoading}
                            showFolders={pageMode === "myFiles"}
                            folders={allFolders}
                            onFolderClick={handleFolderClick}
                        />
                    ) : (
                        <ProjectList
                            projects={filteredProjects}
                            isLoading={isLoading}
                            showFolders={pageMode === "myFiles"}
                            workspaces={allFolders}
                            onFolderClick={handleFolderClick}
                            folderPath={folderPath}
                            onBreadcrumbClick={handleBreadcrumbClick}
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

            <CreateFolderModal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                onConfirm={handleCreateFolder}
                parentPath={folderPath.map(f => f.name).join(" / ")}
            />
        </div>
    );
}
