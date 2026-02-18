import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useCurrentProject } from '../../hooks/useCurrentProject';

interface ProjectHeaderProps {
    className?: string;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ className }) => {
    const router = useRouter();
    const currentProjectId = useStore((state) => state.currentProjectId);
    const { project: dbProject, updateProjectName, isUpdating } = useCurrentProject(currentProjectId);
    const localProject = useStore((state) => state.project);
    const setLocalName = useStore((state) => state.setName);

    // Use database project name if available, otherwise fall back to local store
    const project = dbProject || localProject;

    const [isEditing, setIsEditing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [editValue, setEditValue] = useState(project.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(project.name);
    }, [project.name]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        setIsEditing(true);
    };

    const handleSave = () => {
        if (editValue.trim() && editValue.trim() !== project.name) {
            // Update both database and local store
            if (currentProjectId && dbProject) {
                updateProjectName(editValue.trim());
            } else {
                setLocalName(editValue.trim());
            }
        } else {
            setEditValue(project.name);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(project.name);
            setIsEditing(false);
        }
    };

    return (
        <div
            className={`flex items-center gap-2 pointer-events-auto ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                if (isEditing) {
                    handleSave();
                }
            }}
        >
            {/* Home Button */}
            <button
                onClick={() => router.push('/dashboard')}
                className="w-9 h-9 flex items-center justify-center bg-panel border border-panel-border rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 text-text-secondary hover:text-white transition-all group"
                title="Go Home (Dashboard)"
            >
                <Home size={16} className="group-hover:scale-110 transition-transform" />
            </button>

            {/* Project Name Display/Editor */}
            <div className="relative">
                {!isEditing ? (
                    <button
                        onClick={handleStartEdit}
                        disabled={isUpdating}
                        className={`px-3 py-2 text-sm font-medium text-black transition-all duration-200 ${isHovered
                                ? 'bg-white/90 border border-gray-200 rounded-lg shadow-lg backdrop-blur-md'
                                : 'bg-transparent'
                            } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                        title="Click to edit project name"
                    >
                        {project.name}
                    </button>
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="px-3 py-2 text-sm font-medium text-black bg-white/90 border border-gray-200 rounded-lg shadow-lg backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[200px]"
                        placeholder="Project name"
                    />
                )}
            </div>
        </div>
    );
};
