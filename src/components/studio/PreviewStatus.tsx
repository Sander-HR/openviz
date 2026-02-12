import React from 'react';
import { useStore } from '../../store/useStore';
import { X } from 'lucide-react';

export const PreviewStatus: React.FC = () => {
    const { previewingRender, setPreviewingRender } = useStore();

    if (!previewingRender) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-primary border border-white/20 px-4 py-1.5 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-xl">
                <span className="text-white text-sm font-bold">Previewing result</span>

                <div className="w-px h-6 bg-white/20 mx-1" />

                <button
                    onClick={() => setPreviewingRender(null)}
                    className="p-1.5 hover:bg-white/20 rounded-full transition-all group"
                    title="Close Preview"
                >
                    <X size={18} className="text-white group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
};
