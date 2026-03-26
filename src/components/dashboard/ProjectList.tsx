"use client";

import { MoreHorizontal, FileText, Folder, Pencil, ArrowRightLeft, Trash2, ExternalLink, Copy as CopyIcon, User, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Project } from "@/lib/schemas/base";
import { useState, useRef, useEffect } from "react";
import { RenameProjectModal } from "./RenameProjectModal";
import { MoveProjectModal } from "./MoveProjectModal";
import { useProjects } from "@/hooks/useProjects";
import { useProjectPreview } from "@/hooks/useProjectPreview";

interface FolderPath {
    id: string;
    name: string;
}

interface ProjectListProps {
    projects: Project[];
    isLoading: boolean;
    showFolders?: boolean;
    workspaces?: Array<{ id: string; name: string }>;
    onFolderClick?: (workspaceId: string) => void;
    onCreateFolder?: () => void;
    folderPath?: FolderPath[];
    onBreadcrumbClick?: (folderId: string | null) => void;
}

export function ProjectList({ 
    projects, 
    isLoading, 
    showFolders = false, 
    workspaces = [], 
    onFolderClick,
    folderPath = [],
    onBreadcrumbClick
}: ProjectListProps) {
    if (isLoading) {
        return (
            <div className="p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-14 mb-2 bg-[#1A1A1A] animate-pulse rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Folders section */}
            {showFolders && workspaces.length > 0 && (
                <div className="px-6 pt-4 pb-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Folders</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {workspaces.map((ws) => (
                            <button
                                key={ws.id}
                                onClick={() => onFolderClick?.(ws.id)}
                                className="flex items-center gap-3 p-3 bg-[#1A1A1A] hover:bg-[#252525] rounded-lg border border-[#2A2A2A] hover:border-[#3A3A3A] transition-all text-left"
                            >
                                <Folder size={20} className="text-yellow-500" />
                                <span className="text-sm text-white truncate">{ws.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Files section */}
            <div className="flex-1 overflow-auto">
                <div className="px-6 pt-4 pb-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        {showFolders ? 'Files' : 'Projects'}
                    </div>
                </div>

                {/* Table Header */}
                <div className="px-6 sticky top-0 bg-[#0F0F0F] z-10">
                    <div className="grid grid-cols-12 gap-4 px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-[#1A1A1A]">
                        <div className="col-span-4">Name</div>
                        <div className="col-span-3">Created by</div>
                        <div className="col-span-3">Last edited</div>
                        <div className="col-span-2"></div>
                    </div>
                </div>

                {/* Table Body */}
                <div className="px-6">
                    {projects.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500">
                            No projects found
                        </div>
                    ) : (
                        projects.map((project) => (
                            <ProjectRow key={project.id} project={project} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function ProjectRow({ project }: { project: Project }) {
    const router = useRouter();
    const { updateProject, deleteProject } = useProjects();
    const { thumbnails: allThumbnails } = useProjectPreview(project.id);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this project?")) {
            deleteProject(project.id);
        }
        setIsMenuOpen(false);
    };

    const handleRename = (newName: string) => {
        updateProject({ id: project.id, data: { name: newName } });
    };

    const handleMove = (workspaceId: string) => {
        updateProject({ id: project.id, data: { workspaceId } });
    };

    const handleDuplicate = () => {
        // TODO: Implement duplicate functionality
        setIsMenuOpen(false);
    };

    // Get thumbnail URL
    const thumbnailUrls = (allThumbnails as any[])
        .map(n => n.project?.thumbnail)
        .filter(Boolean);
    const thumbnail = project.thumbnailUrl || thumbnailUrls[0];

    return (
        <>
            <div
                className="grid grid-cols-12 gap-4 items-center px-3 py-3 hover:bg-[#1A1A1A] rounded-lg cursor-pointer transition-colors group border-b border-[#1A1A1A]/50 last:border-0"
                onDoubleClick={() => router.push(`/projects/${project.id}`)}
            >
                {/* Name (merged preview + filename) */}
                <div className="col-span-4 flex items-center gap-3">
                    <div className="w-24 h-24 bg-white rounded border border-[#2A2A2A] overflow-hidden shrink-0">
                        {thumbnail ? (
                            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <FileText size={36} className="text-zinc-400" />
                            </div>
                        )}
                    </div>
                    <span className="text-sm text-white truncate">{project.name}</span>
                </div>

                {/* Created by */}
                <div className="col-span-3">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-300">
                            <User size={12} className="text-zinc-500" />
                            <span>You</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                            {new Date(project.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Last edited */}
                <div className="col-span-3">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-300">
                            <User size={12} className="text-zinc-500" />
                            <span>You</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                            {new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end">
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(!isMenuOpen);
                            }}
                            className={`p-1.5 text-zinc-500 hover:text-white hover:bg-[#2A2A2A] rounded transition-all ${isMenuOpen ? 'opacity-100 bg-[#2A2A2A] text-white' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                            <MoreHorizontal size={14} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 bottom-8 z-20 w-48 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-bottom-right">
                                <div className="p-1 space-y-0.5">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            router.push(`/projects/${project.id}`);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-[#252525] transition-colors"
                                    >
                                        <ExternalLink size={12} />
                                        Open
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            window.open(`/projects/${project.id}`, '_blank');
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-[#252525] transition-colors"
                                    >
                                        <ExternalLink size={12} />
                                        Open in new window
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDuplicate();
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-[#252525] transition-colors"
                                    >
                                        <CopyIcon size={12} />
                                        Duplicate
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            setIsMoveModalOpen(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-[#252525] transition-colors"
                                    >
                                        <ArrowRightLeft size={12} />
                                        Move
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            setIsRenameModalOpen(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-[#252525] transition-colors"
                                    >
                                        <Pencil size={12} />
                                        Rename
                                    </button>
                                    <div className="h-px bg-[#2A2A2A] my-1" />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete();
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-red-400 hover:bg-[#252525] transition-colors"
                                    >
                                        <Trash2 size={12} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <RenameProjectModal
                isOpen={isRenameModalOpen}
                onClose={() => setIsRenameModalOpen(false)}
                onConfirm={handleRename}
                currentName={project.name}
            />

            <MoveProjectModal
                isOpen={isMoveModalOpen}
                onClose={() => setIsMoveModalOpen(false)}
                onConfirm={handleMove}
                currentWorkspaceId={project.workspaceId}
            />
        </>
    );
}
