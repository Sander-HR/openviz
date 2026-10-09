import React, { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    Circle,
    Eraser,
    Import,
    LayoutDashboard,
    Minus,
    MousePointer2,
    Paintbrush,
    PaintBucket,
    Redo2,
    Square,
    Undo2,
    type LucideIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/store/useStore";
import { reportAssetUploadFailure, uploadBlobToAsset, uploadCanvasThumbnail } from "@/services/assetUpload";
import { ColorPicker } from "./ColorPicker";
import { ToolType } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ToolbarToolAction = {
    id: ToolType;
    icon: LucideIcon;
    label: string;
    shortcut: string;
};

type CanvasFlattenWindow = Window & {
    getFlattenedCanvas?: () => string;
};

const TOOL_ACTIONS: ToolbarToolAction[] = [
    { id: "select", icon: MousePointer2, label: "Select", shortcut: "S" },
    { id: "brush", icon: Paintbrush, label: "Brush", shortcut: "B" },
    { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
    { id: "circle", icon: Circle, label: "Circle", shortcut: "O" },
    { id: "rectangle", icon: Square, label: "Rectangle", shortcut: "R" },
    { id: "line", icon: Minus, label: "Line", shortcut: "L" },
    { id: "paintbucket", icon: PaintBucket, label: "Fill", shortcut: "G" },
];

function ToolSection({
    activeTool,
    onSelectTool,
}: {
    activeTool: ToolType;
    onSelectTool: (tool: ToolType) => void;
}) {
    return (
        <div className="flex items-center gap-0.5">
            {TOOL_ACTIONS.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => onSelectTool(tool.id)}
                    aria-label={`${tool.label} tool`}
                    aria-pressed={activeTool === tool.id}
                    className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150",
                        activeTool === tool.id
                            ? "bg-viz-accent text-white"
                            : "text-viz-muted hover:bg-white/10 hover:text-white"
                    )}
                    title={`${tool.label} (${tool.shortcut})`}
                >
                    <tool.icon size={16} strokeWidth={2} />
                </button>
            ))}
        </div>
    );
}

function HistorySection({ onUndo, onRedo }: { onUndo: () => void; onRedo: () => void }) {
    return (
        <div className="flex items-center gap-0.5">
            <button
                onClick={onUndo}
                aria-label="Undo"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white"
                title="Undo (Ctrl+Z)"
            >
                <Undo2 size={16} strokeWidth={2} />
            </button>
            <button
                onClick={onRedo}
                aria-label="Redo"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white"
                title="Redo (Ctrl+Y)"
            >
                <Redo2 size={16} strokeWidth={2} />
            </button>
        </div>
    );
}

function ModeSwitchSection({
    viewMode,
    onToggleViewMode,
}: {
    viewMode: "STUDIO" | "WORKBENCH";
    onToggleViewMode: () => void;
}) {
    return (
        <button
            onClick={onToggleViewMode}
            className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150",
                viewMode === "WORKBENCH"
                    ? "bg-viz-surface text-white"
                    : "text-viz-muted hover:bg-white/10 hover:text-white"
            )}
            title={viewMode === "STUDIO" ? "Switch to Workbench" : "Back to Studio"}
        >
            <LayoutDashboard size={15} strokeWidth={2} />
        </button>
    );
}

export const Toolbar: React.FC = () => {
    const {
        toolSettings,
        setActiveTool,
        setBrushColor,
        undo,
        redo,
        addLayer,
        updateLayer,
        saveCurrentToWorkbench,
        setViewMode,
        viewMode,
        currentProjectId,
    } = useStore(
        useShallow((state) => ({
            toolSettings: state.toolSettings,
            setActiveTool: state.setActiveTool,
            setBrushColor: state.setBrushColor,
            undo: state.undo,
            redo: state.redo,
            addLayer: state.addLayer,
            updateLayer: state.updateLayer,
            saveCurrentToWorkbench: state.saveCurrentToWorkbench,
            setViewMode: state.setViewMode,
            viewMode: state.viewMode,
            currentProjectId: state.currentProjectId,
        }))
    );
    const router = useRouter();
    const pathname = usePathname();
    const [showColorPicker, setShowColorPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Measure natural dimensions from a temporary object URL, then upload the
        // bytes to the asset store and store the short ref in the layer (falls
        // back to base64 when the asset store is unavailable).
        const measureUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
            URL.revokeObjectURL(measureUrl);

            const state = useStore.getState();
            const canvasWidth = state.project.canvas.width;
            const canvasHeight = state.project.canvas.height;

            let width = img.naturalWidth;
            let height = img.naturalHeight;

            if (width > canvasWidth || height > canvasHeight) {
                const ratio = Math.min(canvasWidth / width, canvasHeight / height);
                width *= ratio;
                height *= ratio;
            }

            const x = (canvasWidth - width) / 2;
            const y = (canvasHeight - height) / 2;

            // Studio edits at full resolution — the thumbnail variant is for canvas previews.
            let image: string;
            try {
                ({ url: image } = await uploadBlobToAsset(file, file.name));
            } catch (error) {
                reportAssetUploadFailure(error);
                return; // refs-only contract: no layer without a durable ref
            }

            addLayer("image");
            const updatedState = useStore.getState();
            if (updatedState.activeLayerId) {
                updateLayer(updatedState.activeLayerId, {
                    image,
                    name: file.name,
                    width,
                    height,
                    x,
                    y,
                    scaleX: 1,
                    scaleY: 1,
                });
            }
        };
        img.src = measureUrl;
    };

    const handleToggleWorkbench = async () => {
        // The URL is the source of truth for project workspaces. Fall back to
        // it while the store is still hydrating so this button cannot become a
        // no-op when the toolbar renders before currentProjectId is available.
        const projectId = currentProjectId ?? pathname.match(/^\/projects\/([^/]+)/)?.[1];
        if (!projectId) return;

        if (viewMode === "STUDIO") {
            // Refs-only contract: persist the flattened canvas as a durable S3
            // ref; when the asset store is down, keep the previous thumbnail.
            const flattenedCanvas = (window as CanvasFlattenWindow).getFlattenedCanvas?.();
            const thumbnailRef = flattenedCanvas ? await uploadCanvasThumbnail(flattenedCanvas) : null;
            saveCurrentToWorkbench(thumbnailRef);
            setViewMode("WORKBENCH");
            router.push(`/projects/${projectId}/workbench`);
            return;
        }

        setViewMode("STUDIO");
        router.push(`/projects/${projectId}/studio`);
    };

    return (
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl2 bg-viz-panel p-1 shadow-viz">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />

            <ToolSection activeTool={toolSettings.activeTool} onSelectTool={setActiveTool} />

            <div className="relative">
                <button
                    className="h-7 w-7 rounded-full border-2 border-viz-border p-0.5 overflow-hidden hover:scale-105 active:scale-95 transition-transform relative"
                    style={{ backgroundColor: toolSettings.brushColor }}
                    onClick={() => setShowColorPicker((prev) => !prev)}
                    title="Change Color"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none" />
                </button>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-viz-panel pointer-events-none overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 opacity-80" />
                </div>

                {showColorPicker && (
                    <>
                        <div className="fixed inset-0 z-[60] cursor-default" onClick={() => setShowColorPicker(false)} />
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 z-[70] animate-in fade-in zoom-in slide-in-from-top-2 duration-200">
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-panel border-t border-l border-panel-border rotate-45" />
                            <ColorPicker color={toolSettings.brushColor} onChange={setBrushColor} />
                        </div>
                    </>
                )}
            </div>

            <HistorySection onUndo={undo} onRedo={redo} />

            <div className="w-px h-5 bg-panel-border mx-0.5" />

            <button
                onClick={handleImportClick}
                aria-label="Import image"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white"
                title="Import Image (JPG/PNG)"
            >
                <Import size={16} strokeWidth={2} />
            </button>

            <ModeSwitchSection viewMode={viewMode} onToggleViewMode={handleToggleWorkbench} />
        </div>
    );
};
