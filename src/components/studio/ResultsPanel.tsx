import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { ImageNode, RenderGroup, RenderNode } from '../../types';
import { ChevronDown, MoreHorizontal, RotateCcw, Eye, Download, ArrowLeft, ArrowRight, Archive, PlusSquare, Check, LoaderCircle, TriangleAlert } from 'lucide-react';
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

function getLegacyRenderGroups(
    activeNodeId: string | null,
    workbenchNodes: ReturnType<typeof useStore.getState>['workbenchNodes'],
    connections: ReturnType<typeof useStore.getState>['connections']
): RenderGroup[] {
    if (!activeNodeId) return [];

    const renderNodes = workbenchNodes.filter((node): node is RenderNode =>
        node.type === 'render' && connections.some((connection) =>
            connection.from === activeNodeId && connection.to === node.id
        )
    );

    return renderNodes.flatMap((renderNode) => {
        const prompt = renderNode.data.prompt.trim();
        if (!prompt) return [];

        const promptPrefix = prompt.toLowerCase().slice(0, 20);
        const source = workbenchNodes.find((node) => node.id === activeNodeId);
        const outputNodes = workbenchNodes
            .filter((node): node is ImageNode =>
                node.type === 'image' &&
                node.id !== activeNodeId &&
                Boolean(node.project.thumbnail) &&
                node.name.toLowerCase().startsWith(promptPrefix)
            )
            .sort((left, right) => {
                const leftDistance = Math.hypot(left.x - renderNode.x, left.y - renderNode.y);
                const rightDistance = Math.hypot(right.x - renderNode.x, right.y - renderNode.y);
                return leftDistance - rightDistance;
            })
            .slice(0, renderNode.data.numImages || 1);

        const images = outputNodes
            .map((node) => node.project.thumbnail)
            .filter((thumbnail): thumbnail is string => Boolean(thumbnail));
        if (images.length === 0) return [];

        return [{
            id: `legacy-${renderNode.id}`,
            prompt,
            style: renderNode.data.stylePreset,
            settings: { ...renderNode.data },
            images,
            timestamp: 0,
            width: source?.type === 'image' || source?.type === 'video' ? source.project.canvas.width : 1024,
            height: source?.type === 'image' || source?.type === 'video' ? source.project.canvas.height : 1024,
            sourceNodeId: activeNodeId,
        } satisfies RenderGroup];
    });
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ height }) => {
    const {
        renderResults,
        project,
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
        productJobs,
        isRendering,
        workbenchNodes = [],
        connections = [],
    } = useStore();

    // A direct /studio load can restore the source project without restoring
    // the workbench selection. The project id is also the image-node id for
    // persisted image nodes, so use it as the source fallback.
    const effectiveActiveNodeId = activeNodeId ?? project?.id ?? null;

    const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
    const [isExporting, setIsExporting] = React.useState<string | null>(null);
    const [lastPreviewedImage, setLastPreviewedImage] = useState<string | null>(null);
    const [showFooterInCollapsed, setShowFooterInCollapsed] = useState(false);

    // Results are persisted on the source image node so reopening a node can
    // restore its history. Keep the global list as a compatibility fallback,
    // then filter by the active source node. This also handles older scenes
    // where the node-owned result groups were saved before sourceNodeId was
    // added to the global render group.
    const activeSourceNode = workbenchNodes.find((node): node is ImageNode =>
        node.id === effectiveActiveNodeId && node.type === 'image'
    );
    const activeVideoNode = workbenchNodes.find((node) =>
        node.id === effectiveActiveNodeId && node.type === 'video'
    );
    const activeSourceResults = activeSourceNode?.renderResults ??
        (activeVideoNode?.type === 'video' ? activeVideoNode.renderResults : undefined) ?? [];
    const legacyRenderResults = useMemo(
        () => getLegacyRenderGroups(effectiveActiveNodeId, workbenchNodes, connections),
        [effectiveActiveNodeId, workbenchNodes, connections]
    );
    const resultGroups: RenderGroup[] = [...activeSourceResults, ...renderResults, ...legacyRenderResults];
    const seenResultIds = new Set<string>();
    const filteredRenderResults = resultGroups.filter((group) => {
        if (seenResultIds.has(group.id)) return false;
        seenResultIds.add(group.id);
        return activeSourceResults.includes(group) ||
            group.sourceNodeId === effectiveActiveNodeId ||
            (!group.sourceNodeId && effectiveActiveNodeId === 'default');
    });
    const colorJobs = Object.values(productJobs ?? {}).filter((job) => job.workflowId === 'material_study' && job.parameters.variableType === 'color');

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
                "w-full flex flex-col bg-viz-panel border border-viz-border rounded-xl2 shadow-viz overflow-hidden text-white transition-all duration-300 pointer-events-auto",
                resultsPanelOpen ? "flex-none" : "h-10 flex-none mt-auto"
            )}
            style={resultsPanelOpen ? { height } : undefined}
        >
            {/* Header */}
            <div
                className="flex h-10 items-center justify-between px-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setResultsPanelOpen(!resultsPanelOpen)}
            >
                <div className="flex items-center gap-2">
                    <ChevronDown size={14} strokeWidth={2} className={cn("text-viz-muted transition-transform", !resultsPanelOpen && "-rotate-90")} />
                    <span className="text-xs font-semibold tracking-tight">Results</span>
                </div>
                <button type="button" aria-label="Results menu" onClick={(event) => event.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted hover:bg-white/10 hover:text-white transition-colors">
                    <MoreHorizontal size={16} />
                </button>
            </div>

            {/* Collapsed Content - Thumbnail Grid Only */}
            {!resultsPanelOpen && (
                <div className="hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-[5px]">
                        {isRendering && (
                            <div className="grid grid-cols-4 gap-1">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="aspect-square bg-neutral-700 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        )}
                        {!isRendering && allImages.length > 0 && (
                            <div className="grid grid-cols-4 gap-1">
                                {allImages.map((img, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setLastPreviewedImage(img);
                                            setIsPreviewVisible(true);
                                            setPreviewingRender(img);
                                            setShowFooterInCollapsed(true);
                                        }}
                                        className={cn(
                                            "aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer",
                                            previewingRender === img
                                                ? "border-primary shadow-lg shadow-primary/20"
                                                : "border-neutral-800 hover:border-white/20"
                                        )}
                                    >
                                        <img src={img} alt={`Result ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {!isRendering && allImages.length === 0 && (
                            <div className="flex items-center justify-center h-20 text-xs opacity-40 text-center px-2">
                                Generate to see results
                            </div>
                        )}
                    </div>
                    {showFooterInCollapsed && (
                        <div className="p-[5px] border-t border-panel-border flex items-center justify-between bg-black/20">
                            <div className="flex items-center gap-1">
                                <button
                                    className={cn(
                                        "p-1.5 hover:bg-white/10 rounded-lg transition-colors",
                                        isPreviewVisible && previewingRender ? "opacity-100 text-primary" : "opacity-60"
                                    )}
                                    onClick={() => {
                                        if (previewingRender) {
                                            setIsPreviewVisible(!isPreviewVisible);
                                        } else if (lastPreviewedImage) {
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
                                    "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                                    previewingRender
                                        ? "bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
                                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                                )}
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Expanded Content Area */}
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
                            {colorJobs.length > 0 && <section className="space-y-2" aria-labelledby="color-variation-results-title">
                                <div className="flex items-center justify-between"><h3 id="color-variation-results-title" className="text-xs font-bold opacity-90">Color Variations</h3><span className="text-[9px] text-white/40">{colorJobs.length} batch{colorJobs.length === 1 ? '' : 'es'}</span></div>
                                {colorJobs.map((job) => {
                                    const statusIcon = job.status === 'running' || job.status === 'queued' ? <LoaderCircle size={11} className="animate-spin" aria-hidden="true" /> : job.status === 'failed' ? <TriangleAlert size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />;
                                    return <article key={job.id} className="space-y-2 rounded-lg border border-white/5 bg-black/10 p-2">
                                        <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5 text-[9px] text-white/60">{statusIcon}<span className="truncate">{job.status === 'completed' ? 'Ready' : job.status === 'partial' ? 'Partial batch' : job.status === 'failed' ? 'Needs attention' : job.status === 'running' ? 'Generating' : 'Queued'}</span></div><span className="text-[9px] text-white/35">{job.progress}%</span></div>
                                        {job.error && <p className="text-[9px] text-red-300/80">{job.error.message}</p>}
                                        {job.outputs.length > 0 && <div className="grid grid-cols-4 gap-1">{job.outputs.map((output) => <button key={`${job.id}-${output.index}`} type="button" onClick={() => { setLastPreviewedImage(output.url); setIsPreviewVisible(true); setPreviewingRender(output.url); }} className="group relative aspect-square overflow-hidden rounded-md border border-white/5 hover:border-white/40"><img src={output.url} alt={`Color variation ${output.index + 1}`} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 hidden bg-black/70 px-1 py-1 text-[8px] text-white group-hover:block">Preview</span></button>)}</div>}
                                        {job.outputs.length > 0 && <div className="flex justify-end"><button type="button" onClick={() => job.outputs.forEach((output) => addImageToWorkbench(output.url))} className="flex items-center gap-1 rounded-md px-2 py-1 text-[9px] text-white/60 hover:bg-white/10 hover:text-white"><PlusSquare size={11} /> Add to Workbench</button></div>}
                                    </article>;
                                })}
                            </section>}
                            {filteredRenderResults.length > 0 && <h3 className="text-xs font-bold opacity-90">Latest Renders</h3>}

                            {filteredRenderResults.length === 0 && !isRendering && (
                                <div className="flex h-32 flex-col items-center justify-center gap-1.5 px-4 text-center">
                                    <p className="text-xs font-semibold text-white">Nothing here - yet!</p>
                                    <p className="text-[11px] leading-4 text-viz-muted">Once you generate something, it will appear here.</p>
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
                                                            className="absolute right-0 top-full mt-1 w-44 bg-viz-surface border border-viz-border rounded-lg shadow-viz z-[70] overflow-hidden p-1"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    addGroupToWorkbench(group);
                                                                    setOpenMenuId(null);
                                                                }}
                                                                className="w-full px-4 py-2.5 text-left text-xs text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                                                            >
                                                                <PlusSquare size={14} className="text-viz-muted" />
                                                                Add all to Workbench
                                                            </button>
                                                            <button
                                                                onClick={() => handleExportZip(group)}
                                                                disabled={isExporting === group.id}
                                                                className="w-full px-4 py-2.5 text-left text-xs text-white hover:bg-white/10 flex items-center gap-2 transition-colors disabled:opacity-50"
                                                            >
                                                                {isExporting === group.id ? (
                                                                    <div className="animate-spin rounded-full h-3 w-3 border border-white/20 border-t-white" />
                                                                ) : (
                                                                    <Archive size={14} className="text-viz-muted" />
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
