"use client";

import { MoreHorizontal, FileText, Pencil, ArrowRightLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Project } from "@/lib/schemas/base";
import { useStore } from "@/store/useStore";
import { useState, useRef, useEffect } from "react";
import { RenameProjectModal } from "./RenameProjectModal";
import { MoveProjectModal } from "./MoveProjectModal";
import { useProjects } from "@/hooks/useProjects";

export function ProjectGrid({ projects, isLoading }: { projects: Project[], isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-video bg-[#1A1A1A] animate-pulse rounded-xl border border-[#2A2A2A]" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6 overflow-y-auto max-h-[calc(100vh-120px)]">
            {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
            ))}
        </div>
    );
}

function ProjectCard({ project }: { project: Project }) {
    const router = useRouter();
    const workbenchNodes = useStore((state) => state.workbenchNodes);
    const { updateProject, deleteProject } = useProjects();

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

    // Fallback logic: 1. DB Thumbnail -> 2. Local Workbench Node Thumbnail -> 3. Placeholder
    let thumbnail = project.thumbnailUrl;

    if (!thumbnail) {
        // Find matching workbench node (image or video) for this project
        const matchingNode = workbenchNodes.find(n =>
            (n.type === 'image' || n.type === 'video') && n.project?.id === project.id
        );

        if (matchingNode && (matchingNode.type === 'image' || matchingNode.type === 'video')) {
            // Use the project thumbnail from the workbench node
            thumbnail = matchingNode.project?.thumbnail;
        }
    }

    return (
        <>
            <div
                className="group cursor-pointer space-y-3 relative"
                onDoubleClick={() => router.push(`/projects/${project.id}`)}
            >
                <div className="aspect-square bg-white rounded-lg shadow-lg border-2 border-transparent hover:border-[#6366f1] transition-all duration-200 relative overflow-hidden">
                    {thumbnail ? (
                        <img
                            src={thumbnail}
                            alt={project.name}
                            className="w-full h-full object-cover"
                            draggable={false}
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-zinc-400">
                            <FileText size={48} />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                </div>

                <div className="flex items-start justify-between px-1 relative">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
                            <FileText size={14} className="text-zinc-500" />
                            {project.name}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                            Edited · {new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                    </div>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMenuOpen(!isMenuOpen);
                            }}
                            className={`p-1 text-zinc-500 hover:text-white hover:bg-[#2A2A2A] rounded transition-all ${isMenuOpen ? 'opacity-100 bg-[#2A2A2A] text-white' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                            <MoreHorizontal size={14} />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 bottom-6 z-20 w-40 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-bottom-right">
                                <div className="p-1 space-y-0.5">
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
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMenuOpen(false);
                                            setIsMoveModalOpen(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-[#252525] transition-colors"
                                    >
                                        <ArrowRightLeft size={12} />
                                        Move to...
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

