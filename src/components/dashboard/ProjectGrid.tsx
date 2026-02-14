"use client";

import { MoreHorizontal, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Project } from "@/lib/schemas/base";
import Image from "next/image";


import { useStore } from "@/store/useStore";

export function ProjectGrid({ projects, isLoading }: { projects: Project[], isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6 p-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-video bg-[#1A1A1A] animate-pulse rounded-xl border border-[#2A2A2A]" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6 p-6 overflow-y-auto max-h-[calc(100vh-120px)]">
            {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
            ))}
        </div>
    );
}

function ProjectCard({ project }: { project: Project }) {
    const router = useRouter();
    const workbenchNodes = useStore((state) => state.workbenchNodes);

    // Fallback logic: 1. DB Thumbnail -> 2. Local Workbench Node Thumbnail -> 3. Placeholder
    let thumbnail = project.thumbnailUrl;

    if (!thumbnail) {
        const matchingNode = workbenchNodes.find(n =>
            (n.type === 'image' || n.type === 'video') && n.project.id === project.id
        );
        if (matchingNode && (matchingNode.type === 'image' || matchingNode.type === 'video')) {
            thumbnail = matchingNode.project.thumbnail;
        }
    }

    return (
        <div
            className="group cursor-pointer space-y-3"
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

            <div className="flex items-start justify-between px-1">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
                        <FileText size={14} className="text-zinc-500" />
                        {project.name}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                        Edited · {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                </div>
                <button className="p-1 text-zinc-500 hover:text-white hover:bg-[#2A2A2A] rounded transition-all opacity-0 group-hover:opacity-100">
                    <MoreHorizontal size={14} />
                </button>
            </div>
        </div>
    );
}

