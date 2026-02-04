import React, { useState } from 'react';
import { Plus, ChevronDown, Wand2, Palette, Layers, ImageIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { renderService } from '../services/renderService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const SidebarRight: React.FC = () => {
    const {
        renderSettings,
        setRenderPrompt,
        setRenderStyle,
        setRenderInfluence,
        setRenderNumImages,
        setRenderReferenceImage,
        addRenderResultGroup,
        setRendering,
        isRendering,
        setResultsPanelOpen
    } = useStore();

    const [showStyles, setShowStyles] = useState(false);
    const [showNumImagesDropdown, setShowNumImagesDropdown] = useState(false);

    const stylePresets = [
        'Photorealistic',
        'Sketch / Line Art',
        'Cyberpunk / Neon',
        'Minimalist',
        'Watercolor',
        '3D Render'
    ];

    const handleGenerate = async () => {
        if (!renderSettings?.prompt?.trim()) return;
        setRendering(true);

        try {
            const canvasData = (window as any).getFlattenedCanvas ? (window as any).getFlattenedCanvas() : "";

            const response = await renderService.generate({
                ...renderSettings,
                init_image: canvasData
            });

            if (response.success && response.images.length > 0) {
                addRenderResultGroup(renderSettings, response.images);
                setResultsPanelOpen(true);
            }

        } catch (error) {
            console.error("Generation failed", error);
        } finally {
            setRendering(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setRenderReferenceImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="w-80 flex flex-col bg-panel border border-panel-border rounded-panel shadow-2xl overflow-hidden h-fit max-h-[calc(100vh-120px)] backdrop-blur-md bg-opacity-95 text-white">
            {/* Tabs */}
            <div className="flex border-b border-panel-border">
                <button className="flex-1 py-3 text-sm font-bold border-b-2 border-primary bg-primary/5">RENDER</button>
                <button className="flex-1 py-3 text-sm font-bold opacity-30 cursor-not-allowed">REFINE</button>
            </div>

            <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
                {/* Prompt Section */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <label className="font-semibold opacity-80 flex items-center gap-2">
                            PROMPT
                        </label>
                        <button className="text-[10px] text-primary hover:underline">DESCRIBE</button>
                    </div>
                    <textarea
                        className="w-full h-32 bg-neutral-900 border border-panel-border rounded-lg p-3 text-sm resize-none focus:border-primary outline-none transition-all placeholder:text-neutral-600"
                        placeholder="Describe your design in detail... e.g., 'Minimalist line art of a trumpet with simplified geometric shapes...'"
                        value={renderSettings.prompt}
                        onChange={(e) => setRenderPrompt(e.target.value)}
                    />
                    <div className="flex justify-between items-center text-[10px] opacity-40">
                        <span>START WITH DESCRIPTOR...</span>
                        <span>{(renderSettings?.prompt || "").length}/2000</span>
                    </div>
                </div>

                {/* Style Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold opacity-80">
                        <Palette size={16} className="text-primary" />
                        PALETTE
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setShowStyles(!showStyles)}
                            className="w-full flex items-center justify-between bg-neutral-900 border border-panel-border p-3 rounded-lg hover:bg-neutral-800 transition-all group"
                        >
                            <span className="text-sm">{renderSettings.stylePreset}</span>
                            <ChevronDown size={16} className={cn("opacity-40 group-hover:opacity-100 transition-transform", showStyles && "rotate-180")} />
                        </button>

                        {showStyles && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-panel-border rounded-lg shadow-xl z-50 overflow-hidden py-1">
                                {stylePresets.map(style => (
                                    <button
                                        key={style}
                                        className={cn(
                                            "w-full px-4 py-2 text-left text-sm hover:bg-primary/20 hover:text-primary transition-colors",
                                            renderSettings.stylePreset === style && "bg-primary/10 text-primary font-bold"
                                        )}
                                        onClick={() => {
                                            setRenderStyle(style);
                                            setShowStyles(false);
                                        }}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-sm font-semibold opacity-80 pt-2">
                        <ImageIcon size={16} className="text-primary" />
                        IMAGE
                    </div>
                    <div className="relative group">
                        {renderSettings.referenceImage ? (
                            <div className="relative w-full h-24 rounded-lg overflow-hidden border border-panel-border">
                                <img src={renderSettings.referenceImage} alt="Reference" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setRenderReferenceImage(undefined)}
                                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 hover:bg-red-500 transition-colors"
                                >
                                    <Plus size={14} className="rotate-45" />
                                </button>
                            </div>
                        ) : (
                            <label className="w-full h-12 dashed border-2 border-dashed border-panel-border rounded-lg flex items-center justify-center gap-2 text-xs opacity-40 hover:opacity-100 hover:bg-neutral-900 transition-all cursor-pointer">
                                <Plus size={14} />
                                ADD IMAGE...
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                        )}
                    </div>
                </div>

                {/* Influence Slider */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-semibold">
                        <span className="opacity-80 flex items-center gap-2">
                            <Layers size={16} className="text-primary" />
                            INFLUENCE
                        </span>
                        <span className="text-primary font-mono">{Math.round(renderSettings.drawingInfluence * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={renderSettings.drawingInfluence}
                        onChange={(e) => setRenderInfluence(parseFloat(e.target.value))}
                        className="w-full accent-primary h-1.5 rounded-full bg-neutral-800 appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] opacity-30 font-bold">
                        <span>CREATIVE</span>
                        <span>PRECISE</span>
                    </div>
                </div>

            </div>

            {/* Generate Button Wrapper */}
            <div className="p-5 pt-0 mt-auto flex gap-2">
                <div className="relative">
                    <button
                        onClick={() => setShowNumImagesDropdown(!showNumImagesDropdown)}
                        disabled={isRendering}
                        title="Number of images to generate"
                        className={cn(
                            "h-full px-4 bg-neutral-900 border border-panel-border rounded-xl transition-all flex items-center gap-2 group",
                            isRendering ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-800"
                        )}
                    >
                        <span className="text-sm font-mono font-bold text-primary">{renderSettings.numImages}</span>
                        <ChevronDown size={14} className={cn("opacity-40 group-hover:opacity-100 transition-transform", showNumImagesDropdown && "rotate-180")} />
                    </button>

                    {showNumImagesDropdown && (
                        <div className="absolute bottom-full left-0 mb-2 bg-neutral-900 border border-panel-border rounded-lg shadow-xl z-50 overflow-hidden py-1 min-w-[60px]">
                            <div className="px-3 py-1.5 text-[10px] font-bold opacity-30 border-b border-panel-border mb-1">COUNT</div>
                            {[1, 2, 3, 4].map(n => (
                                <button
                                    key={n}
                                    className={cn(
                                        "w-full px-4 py-2 text-center text-sm font-mono hover:bg-primary/20 hover:text-primary transition-colors",
                                        renderSettings.numImages === n ? "text-primary font-bold bg-primary/10" : "text-white/60"
                                    )}
                                    onClick={() => {
                                        setRenderNumImages(n);
                                        setShowNumImagesDropdown(false);
                                    }}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isRendering || !renderSettings?.prompt?.trim()}
                    className={cn(
                        "flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all relative overflow-hidden group",
                        isRendering
                            ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                            : "bg-gradient-to-r from-primary to-primary-dark text-white shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
                    )}
                >
                    {isRendering ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-600 border-t-neutral-400" />
                            GENERATING...
                        </>
                    ) : (
                        <>
                            <Wand2 size={20} className="group-hover:rotate-12 transition-transform" />
                            GENERATE
                        </>
                    )}
                    {isRendering && (
                        <div className="absolute inset-0 bg-white/5 animate-pulse" />
                    )}
                </button>
            </div>
        </div>
    );
};


export default SidebarRight;
