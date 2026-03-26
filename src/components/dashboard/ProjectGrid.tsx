"use client";

import { MoreHorizontal, FileText, Pencil, ArrowRightLeft, Trash2, Folder } from "lucide-react";
import { useRouter } from "next/navigation";
import { Project } from "@/lib/schemas/base";
import { useState, useRef, useEffect } from "react";
import { RenameProjectModal } from "./RenameProjectModal";
import { MoveProjectModal } from "./MoveProjectModal";
import { useProjects } from "@/hooks/useProjects";
import { useProjectPreview } from "@/hooks/useProjectPreview";

interface FolderItem {
    id: string;
    name: string;
}

interface ProjectGridProps {
    projects: Project[];
    isLoading: boolean;
    showFolders?: boolean;
    folders?: FolderItem[];
    onFolderClick?: (folderId: string) => void;
}

export function ProjectGrid({ 
    projects, 
    isLoading, 
    showFolders = false, 
    folders = [], 
    onFolderClick 
}: ProjectGridProps) {
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
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-120px)]">
            {/* Folders section */}
            {showFolders && folders.length > 0 && (
                <div className="mb-8">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Folders</div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {folders.map((folder) => (
                            <FolderCard 
                                key={folder.id} 
                                folder={folder} 
                                onClick={() => onFolderClick?.(folder.id)} 
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Files section */}
            <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                    {showFolders ? 'Files' : 'Projects'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.length === 0 ? (
                        <div className="col-span-3 py-12 text-center text-zinc-500">
                            No projects found
                        </div>
                    ) : (
                        projects.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function FolderCard({ folder, onClick }: { folder: FolderItem; onClick: () => void }) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <button
            onClick={onClick}
            onDoubleClick={() => router.push(`/dashboard?folder=${folder.id}`)}
            draggable
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                const projectId = e.dataTransfer.getData('projectId');
                if (projectId) {
                    console.log('Move project', projectId, 'to folder', folder.id);
                }
            }}
            className="group cursor-pointer text-left relative"
        >
            <div className="aspect-square bg-[#1A1A1A] rounded-lg border-2 border-[#2A2A2A] hover:border-[#6366f1] transition-all duration-200 flex items-center justify-center">
                <Folder size={48} className="text-yellow-500/80" />
            </div>
            <div className="flex items-center gap-2 px-1 mt-2">
                <Folder size={14} className="text-yellow-500 shrink-0" />
                <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors truncate">
                    {folder.name}
                </span>
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className={`p-1 text-zinc-500 hover:text-white hover:bg-[#2A2A2A] rounded transition-all ${isMenuOpen ? 'opacity-100 bg-[#2A2A2A] text-white' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                        <MoreHorizontal size={14} />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 top-6 z-20 w-40 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                            <div className="p-1 space-y-0.5">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMenuOpen(false);
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
                                        setIsMenuOpen(false);
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
        </button>
    );
}

function ProjectCard({ project }: { project: Project }) {
    const router = useRouter();
    const { updateProject, deleteProject } = useProjects();
    const { thumbnails: allThumbnails, triggerFetch } = useProjectPreview(project.id);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const thumbnailRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Make project draggable
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('projectId', project.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    // Intersection Observer for lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                triggerFetch(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [triggerFetch]);

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

    // Get thumbnail URLs from the hook's returned nodes
    const thumbnailUrls = (allThumbnails as any[])
        .map(n => n.project?.thumbnail)
        .filter(Boolean);

    // Fallback logic: 1. DB Thumbnail -> 2. Last Edited Workbench Image -> 3. Placeholder
    let thumbnail = project.thumbnailUrl || thumbnailUrls[0];

    // Determine which thumbnail to show based on hover
    const displayThumbnail = hoverIndex !== null && thumbnailUrls[hoverIndex]
        ? thumbnailUrls[hoverIndex]
        : thumbnail;

    // Handle mouse move to determine which zone is being hovered
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (thumbnailUrls.length <= 1) return;

        const rect = thumbnailRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const zoneWidth = rect.width / thumbnailUrls.length;
        const index = Math.floor(x / zoneWidth);

        setHoverIndex(Math.min(index, thumbnailUrls.length - 1));
    };

    const handleMouseLeave = () => {
        setHoverIndex(null);
    };

    return (
        <>
            <div
                ref={containerRef}
                className="group cursor-pointer space-y-3 relative scale-50 origin-top-left"
                onDoubleClick={() => router.push(`/projects/${project.id}`)}
            >
                <div
                    ref={thumbnailRef}
                    className="aspect-[4/3] bg-white rounded-lg shadow-lg border-2 border-transparent hover:border-[#6366f1] transition-all duration-200 relative overflow-hidden flex items-center justify-center"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    {displayThumbnail ? (
                        <img
                            src={displayThumbnail}
                            alt={project.name}
                            className="w-full h-full object-cover transition-opacity duration-150"
                            draggable={false}
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-zinc-400">
                            <FileText size={48} />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

                    {/* Hover zone indicators - only show when there are multiple images */}
                    {thumbnailUrls.length > 1 && (
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {thumbnailUrls.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${(hoverIndex !== null ? hoverIndex : 0) === idx
                                        ? 'bg-white w-4'
                                        : 'bg-white/50'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
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
