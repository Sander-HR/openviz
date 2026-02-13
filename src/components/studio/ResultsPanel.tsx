import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { ChevronDown, MoreHorizontal, RotateCcw, Eye, Download, ArrowLeft, ArrowRight, Archive, PlusSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ContextMenu } from '../ContextMenu';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ResultsPanelProps {
    height: number;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ height }) => {
    const {
        renderResults,
        activeNodeId,
        resultsPanelOpen,
        setResultsPanelOpen,
        previewingRender,
        setPreviewingRender,
        isPreviewVisible,
        setIsPreviewVisible,
        addResultAsLayer,
        loadRenderSettings,
        addGroupToWorkbench,
        addImageToWorkbench,
        isRendering
    } = useStore();

    const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
    const [isExporting, setIsExporting] = React.useState<string | null>(null);
    const [lastPreviewedImage, setLastPreviewedImage] = useState<string | null>(null);

    // Filter render results to show only those for the current active node
    const filteredRenderResults = renderResults.filter(group =>
        group.sourceNodeId === activeNodeId ||
        (!group.sourceNodeId && activeNodeId === 'default')
    );

    // Flatten all images for navigation
    const allImages = filteredRenderResults.flatMap(g => g.images);
    const currentIndex = previewingRender ? allImages.indexOf(previewingRender) : -1;

    const handlePrevRender = useCallback(() => {
        if (allImages.length === 0) return;
        const newIndex = currentIndex <= 0 ? allImages.length - 1 : currentIndex - 1;
        const newImage = allImages[newIndex];
        setLastPreviewedImage(newImage);
        setIsPreviewVisible(true);
        setPreviewingRender(newImage);
    }, [allImages, currentIndex, setPreviewingRender]);

    const handleNextRender = useCallback(() => {
        if (allImages.length === 0) return;
        const newIndex = currentIndex >= allImages.length - 1 ? 0 : currentIndex + 1;
        const newImage = allImages[newIndex];
        setLastPreviewedImage(newImage);
        setIsPreviewVisible(true);
        setPreviewingRender(newImage);
    }, [allImages, currentIndex, setPreviewingRender]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if we're in the studio and not typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrevRender();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNextRender();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlePrevRender, handleNextRender]);

    const handleExportZip = async (group: any) => {
        setIsExporting(group.id);
        const zip = new JSZip();

        try {
            const promises = group.images.map(async (url: string, index: number) => {
                const response = await fetch(url);
                const blob = await response.blob();
                const extension = url.split('.').pop()?.split('?')[0] || 'png';
                zip.file(`render_${index + 1}.${extension}`, blob);
            });

            await Promise.all(promises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `renders_${group.id.substring(0, 5)}_${Date.now()}.zip`);
        } catch (error) {
            console.error("Failed to export zip", error);
        } finally {
            setIsExporting(null);
            setOpenMenuId(null);
        }
    };

    const handleDownloadImage = async (imageUrl: string) => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const extension = imageUrl.split('.').pop()?.split('?')[0] || 'png';
            saveAs(blob, `render_${Date.now()}.${extension}`);
        } catch (error) {
            console.error("Failed to download image", error);
        }
    };

    return (
        <div 
            className={cn(
                "w-full flex flex-col bg-panel border border-panel-border rounded-panel shadow-2xl overflow-hidden backdrop-blur-md bg-opacity-95 text-white transition-all duration-300 pointer-events-auto flex-1",
                !resultsPanelOpen && "h-10"
            )}
            style={resultsPanelOpen ? { height } : undefined}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-[5px] py-[5px] cursor-pointer hover:bg-white/5 transition-colors border-b border-panel-border"
                onClick={() => setResultsPanelOpen(!resultsPanelOpen)}
            >
                <div className="flex items-center gap-2">
                    <ChevronDown size={14} className={cn("transition-transform opacity-60", !resultsPanelOpen && "-rotate-90")} />
                    <span className="text-xs font-bold tracking-tight">Results</span>
                </div>
                <button className="p-1 hover:bg-white/10 rounded transition-colors opacity-60">
                    <MoreHorizontal size={14} />
                </button>
            </div>

            {/* Content Area */}
            {resultsPanelOpen && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-[5px] space-y-[5px]">
                        {/* Rendering Status Placeholder */}
                        {isRendering && (
                            <div className="space-y-3 animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                        Rendering...
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="aspect-square bg-neutral-700 rounded-lg" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Date Grouping */}
                        <div className="space-y-3">
                            {filteredRenderResults.length > 0 && <h3 className="text-xs font-bold opacity-90">Latest Renders</h3>}

                            {filteredRenderResults.length === 0 && !isRendering && (
                                <div className="flex items-center justify-center h-32 text-sm opacity-50 text-center px-4">
                                    nothing here yet! once you generate something it will appear here
                                </div>
                            )}

                            {filteredRenderResults.map((group) => (
                                <div key={group.id} className="space-y-2">
                                    {/* Group Header/Tag */}
                                    <div className="flex items-center justify-between">
                                        <div className="bg-primary/20 text-blue-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                            {group.style.includes('Modify') ? 'Modify' : 'Render'}
                                        </div>
                                        <div className="flex items-center gap-1 relative">
                                            {/* pressing the rotate ccw button reloads the same prompt with the same seed in the render panel */}
                                            <button
                                                onClick={() => loadRenderSettings(group.settings || { prompt: group.prompt, stylePreset: group.style } as any)}
                                                title="Reload prompt and settings"
                                                className="p-1 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
                                            >
                                                <RotateCcw size={12} />
                                            </button>
                                            {/* pressing the more horizontal button opens a menu with the options add the group to the infinite canvas (workbench), export the group as a zip */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === group.id ? null : group.id);
                                                }}
                                                className={cn(
                                                    "p-1 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white",
                                                    openMenuId === group.id && "bg-white/10 text-white"
                                                )}
                                            >
                                                <MoreHorizontal size={12} />
                                            </button>

                                            <AnimatePresence>
                                                {openMenuId === group.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-[60]"
                                                            onClick={() => setOpenMenuId(null)}
                                                        />
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                            className="absolute right-0 top-full mt-1 w-40 bg-neutral-900 border border-panel-border rounded-xl shadow-2xl z-[70] overflow-hidden py-1"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    addGroupToWorkbench(group);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="w-full px-2.5 py-1.5 text-left text-[10px] hover:bg-primary/20 flex items-center gap-2 transition-colors"
                                                            >
                                                                <PlusSquare size={12} className="text-primary" />
                                                                Add all to Workbench
                                                            </button>
                                                            <button
                                                                onClick={() => handleExportZip(group)}
                                                                disabled={isExporting === group.id}
                                                                className="w-full px-2.5 py-1.5 text-left text-[10px] hover:bg-primary/20 flex items-center gap-2 transition-colors disabled:opacity-50"
                                                            >
                                                                {isExporting === group.id ? (
                                                                    <div className="animate-spin rounded-full h-3 w-3 border border-white/20 border-t-white" />
                                                                ) : (
                                                                    <Archive size={12} className="text-primary" />
                                                                )}
                                                                Export as ZIP
                                                            </button>
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Prompt Label */}
                                    <div className="text-[10px] font-medium opacity-40 lowercase">
                                        {/* Show only first 50 characters with ... in the en    d */}
                                        {group.prompt.length > 50 ? group.prompt.substring(0, 50) + '...' : group.prompt}
                                    </div>

                                    {/* Image Grid */}
                                    <div className="grid grid-cols-4 gap-1">
                                        {group.images.map((img, idx) => (
                                            <ContextMenu
                                                key={idx}
                                                actions={[
                                                    {
                                                        label: 'Add as layer',
                                                        onClick: () => addResultAsLayer(img)
                                                    },
                                                    {
                                                        label: 'Add to workbench',
                                                        onClick: () => addImageToWorkbench(img)
                                                    },
                                                    {
                                                        label: 'Add to Asset Library',
                                                        onClick: () => {},
                                                        disabled: true
                                                    },
                                                    {
                                                        divider: true
                                                    },
                                                    {
                                                        label: 'Download',
                                                        onClick: () => handleDownloadImage(img)
                                                    },
                                                    {
                                                        label: 'Download all results',
                                                        onClick: () => handleExportZip(group)
                                                    },
                                                ]}
                                            >
                                                <div
                                                    onClick={() => {
                                                        setLastPreviewedImage(img);
                                                        setIsPreviewVisible(true);
                                                        setPreviewingRender(img);
                                                    }}
                                                    className={cn(
                                                        "aspect-square rounded-lg overflow-hidden border transition-all relative group/thumb cursor-pointer",
                                                        previewingRender === img ? "border-primary shadow-lg shadow-primary/20" : "border-neutral-800 hover:border-white/20"
                                                    )}
                                                >
                                                    <img src={img} alt={`Result ${idx}`} className="w-full h-full object-cover" />
                                                    {previewingRender === img && (
                                                        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                                                    )}
                                                </div>
                                            </ContextMenu>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-[5px] border-t border-panel-border flex items-center justify-between bg-black/20 mt-auto">
                        <div className="flex items-center gap-1">
                            <button
                                className={cn(
                                    "p-1.5 hover:bg-white/10 rounded-lg transition-colors",
                                    isPreviewVisible && previewingRender ? "opacity-100 text-primary" : "opacity-60"
                                )}
                                onClick={() => {
                                    if (previewingRender) {
                                        // Toggle visibility without clearing the selected image
                                        setIsPreviewVisible(!isPreviewVisible);
                                    } else if (lastPreviewedImage) {
                                        // Restore last viewed image
                                        setPreviewingRender(lastPreviewedImage);
                                        setIsPreviewVisible(true);
                                    }
                                }}
                                title={isPreviewVisible && previewingRender ? "Hide preview" : "Show preview"}
                            >
                                <Eye size={16} />
                            </button>
                            <button 
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors opacity-60"
                                onClick={handlePrevRender}
                                disabled={allImages.length === 0}
                                title="Previous render (←)"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <button 
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors opacity-60"
                                onClick={handleNextRender}
                                disabled={allImages.length === 0}
                                title="Next render (→)"
                            >
                                <ArrowRight size={16} />
                            </button>
                            <button 
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors opacity-60"
                                onClick={() => previewingRender && handleDownloadImage(previewingRender)}
                                disabled={!previewingRender}
                                title="Download current"
                            >
                                <Download size={16} />
                            </button>
                        </div>

                        <button
                            disabled={!previewingRender}
                            onClick={() => previewingRender && addResultAsLayer(previewingRender)}
                            className={cn(
                                "px-5 py-1.5 rounded-xl text-xs font-bold transition-all",
                                previewingRender
                                    ? "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
                                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                            )}
                        >
                            Add
                        </button>
                    </div>
                </div >
            )}

        </div>
    );
};
