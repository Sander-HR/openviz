import React from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, MoreHorizontal, RotateCcw, Eye, Download, ArrowLeft, ArrowRight, Archive, PlusSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const ResultsPanel: React.FC = () => {
    const {
        renderResults,
        resultsPanelOpen,
        setResultsPanelOpen,
        previewingRender,
        setPreviewingRender,
        addResultAsLayer,
        loadRenderSettings,
        addGroupToWorkbench,
        isRendering
    } = useStore();

    const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
    const [isExporting, setIsExporting] = React.useState<string | null>(null);

    if (renderResults.length === 0 && !isRendering) return null;

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

    return (
        <div className={cn(
            "w-full flex-shrink flex flex-col bg-panel border border-panel-border rounded-panel shadow-2xl overflow-hidden backdrop-blur-md bg-opacity-95 text-white transition-all duration-300",
            !resultsPanelOpen ? "h-12" : "max-h-[40vh]"
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-panel-border"
                onClick={() => setResultsPanelOpen(!resultsPanelOpen)}
            >
                <div className="flex items-center gap-2">
                    <ChevronDown size={16} className={cn("transition-transform opacity-60", !resultsPanelOpen && "-rotate-90")} />
                    <span className="text-sm font-bold tracking-tight">Results</span>
                </div>
                <button className="p-1 hover:bg-white/10 rounded transition-colors opacity-60">
                    <MoreHorizontal size={16} />
                </button>
            </div>

            {/* Content Area */}
            {resultsPanelOpen && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        {/* Rendering Status Placeholder */}
                        {isRendering && (
                            <div className="space-y-4 animate-pulse">
                                <div className="flex items-center justify-between">
                                    <div className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        Rendering...
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="aspect-square bg-neutral-700 rounded-lg" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Date Grouping */}
                        <div className="space-y-4">
                            {renderResults.length > 0 && <h3 className="text-sm font-bold opacity-90">Latest Renders</h3>}

                            {renderResults.map((group) => (
                                <div key={group.id} className="space-y-2">
                                    {/* Group Header/Tag */}
                                    <div className="flex items-center justify-between">
                                        <div className="bg-primary/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                            {group.style.includes('Modify') ? 'Modify' : 'Render'}
                                        </div>
                                        <div className="flex items-center gap-1 relative">
                                            {/* pressing the rotate ccw button reloads the same prompt with the same seed in the render panel */}
                                            <button
                                                onClick={() => loadRenderSettings(group.settings || { prompt: group.prompt, stylePreset: group.style } as any)}
                                                title="Reload prompt and settings"
                                                className="p-1 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
                                            >
                                                <RotateCcw size={14} />
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
                                                <MoreHorizontal size={14} />
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
                                                            className="absolute right-0 top-full mt-1 w-48 bg-neutral-900 border border-panel-border rounded-xl shadow-2xl z-[70] overflow-hidden py-1.5"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    addGroupToWorkbench(group);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-xs hover:bg-primary/20 flex items-center gap-2 transition-colors"
                                                            >
                                                                <PlusSquare size={14} className="text-primary" />
                                                                Add all to Workbench
                                                            </button>
                                                            <button
                                                                onClick={() => handleExportZip(group)}
                                                                disabled={isExporting === group.id}
                                                                className="w-full px-3 py-2 text-left text-xs hover:bg-primary/20 flex items-center gap-2 transition-colors disabled:opacity-50"
                                                            >
                                                                {isExporting === group.id ? (
                                                                    <div className="animate-spin rounded-full h-3 w-3 border border-white/20 border-t-white" />
                                                                ) : (
                                                                    <Archive size={14} className="text-primary" />
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
                                    <div className="text-[11px] font-medium opacity-40 lowercase">
                                        {/* Show only first 50 characters with ... in the en    d */}
                                        {group.prompt.length > 50 ? group.prompt.substring(0, 50) + '...' : group.prompt}
                                    </div>

                                    {/* Image Grid */}
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {group.images.map((img, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setPreviewingRender(img)}
                                                className={cn(
                                                    "aspect-square rounded-lg overflow-hidden border-2 transition-all relative group/thumb",
                                                    previewingRender === img ? "border-primary shadow-lg shadow-primary/20" : "border-neutral-800 hover:border-white/20"
                                                )}
                                            >
                                                <img src={img} alt={`Result ${idx}`} className="w-full h-full object-cover" />
                                                {previewingRender === img && (
                                                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-panel-border flex items-center justify-between bg-black/20 mt-auto">
                        <div className="flex items-center gap-1.5">
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <Eye size={18} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <ArrowLeft size={18} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <ArrowRight size={18} />
                            </button>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-60">
                                <Download size={18} />
                            </button>
                        </div>

                        <button
                            disabled={!previewingRender}
                            onClick={() => previewingRender && addResultAsLayer(previewingRender)}
                            className={cn(
                                "px-8 py-2.5 rounded-xl text-sm font-bold transition-all",
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
        </div >
    );
};


export default ResultsPanel;
