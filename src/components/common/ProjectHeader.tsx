import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Home, Moon, Settings, Sun } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useCurrentProject } from '../../hooks/useCurrentProject';
import { useWorkbenchThemeStore } from '../../store/slices/workbenchThemeSlice';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MenuItemRow } from '../workbench/menu/MenuItemRow';

interface ProjectHeaderProps {
    className?: string;
    mode?: 'studio' | 'workbench';
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ className, mode = 'workbench' }) => {
    const router = useRouter();
    const currentProjectId = useStore((state) => state.currentProjectId);
    const { project: dbProject, updateProjectName, isUpdating } = useCurrentProject(currentProjectId);
    const localProject = useStore((state) => state.project);
    const setLocalName = useStore((state) => state.setName);

    // FR-015: canvas theme preference (per-user, persisted client-side).
    const canvasTheme = useWorkbenchThemeStore((state) => state.canvasTheme);
    const setCanvasTheme = useWorkbenchThemeStore((state) => state.setCanvasTheme);

    // Studio mode uses local store project, workbench mode uses database with fallback
    const project = mode === 'studio' ? localProject : (dbProject || localProject);
    const displayName = project.name;
    const updateName = mode === 'studio' ? setLocalName : (currentProjectId && dbProject ? updateProjectName : setLocalName);

    const [isEditing, setIsEditing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [editValue, setEditValue] = useState(displayName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(displayName);
    }, [displayName]);

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
        if (editValue.trim() && editValue.trim() !== displayName) {
            updateName(editValue.trim());
        } else {
            setEditValue(displayName);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(displayName);
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
            {/* FR-015: application menu — canvas theme select (Light default / Dark optional) */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="h-8 px-2.5 flex items-center gap-1.5 bg-panel/95 border border-panel-border rounded-lg shadow-lg backdrop-blur-md text-xs font-medium text-studio-ink hover:bg-panel transition-colors"
                        title="OpenViz settings"
                    >
                        OpenViz
                        <ChevronDown size={12} className="text-text-secondary" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                    <DropdownMenuLabel>Canvas theme</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                        <MenuItemRow                            label="Light"
                            icon={Sun}
                            checked={canvasTheme === 'light'}
                            onClick={() => setCanvasTheme('light')}
                        />
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <MenuItemRow                            label="Dark"
                            icon={Moon}
                            checked={canvasTheme === 'dark'}
                            onClick={() => setCanvasTheme('dark')}
                        />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <MenuItemRow                            label="Settings"
                            icon={Settings}
                            onClick={() => router.push('/settings')}
                        />
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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
                        className={`px-3 py-2 text-sm font-medium text-studio-ink transition-all duration-200 min-w-[150px] max-w-[300px] truncate text-left border border-transparent ${isHovered
                                ? 'bg-panel/95 border-panel-border rounded-lg shadow-lg backdrop-blur-md'
                                : 'bg-transparent'
                            } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                        title="Click to edit project name"
                    >
                        {displayName}
                    </button>
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="px-3 py-2 text-sm font-medium text-studio-ink bg-panel/95 border border-panel-border rounded-lg shadow-lg backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[150px] max-w-[300px]"
                        placeholder="Project name"
                    />
                )}
            </div>
        </div>
    );
};
