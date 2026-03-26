"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Paintbrush, LayoutDashboard, Check } from 'lucide-react';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string, mode: 'STUDIO' | 'WORKBENCH') => void;
    isCreating?: boolean;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isCreating = false
}) => {
    const [name, setName] = useState('Untitled');
    const [mode, setMode] = useState<'STUDIO' | 'WORKBENCH'>('STUDIO');

    const handleConfirm = () => {
        if (name.trim()) {
            onConfirm(name, mode);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-xl bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                        >
                            <X size={20} />
                        </button>

                        <div className="p-10">
                            <h2 className="text-3xl font-bold tracking-tight mb-8">Welcome to OpenViz</h2>

                            <div className="space-y-8">
                                {/* Name Input */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
                                        Project Name
                                    </label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[#111111] border-2 border-transparent focus:border-indigo-600 rounded-xl px-5 py-3.5 text-lg font-medium transition-all outline-none"
                                        placeholder="Enter project name..."
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                    />
                                </div>

                                {/* Mode Selection */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Studio Mode */}
                                    <button
                                        onClick={() => setMode('STUDIO')}
                                        className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all duration-300 ${mode === 'STUDIO'
                                                ? 'bg-[#111111] border-indigo-600 shadow-lg shadow-indigo-600/10'
                                                : 'bg-transparent border-[#2A2A2A] hover:border-zinc-700'
                                            }`}
                                    >
                                        <div className={`mb-6 p-4 rounded-xl transition-all duration-300 ${mode === 'STUDIO' ? 'bg-indigo-600 text-white scale-110' : 'bg-[#2A2A2A] text-zinc-400 group-hover:bg-[#333333]'
                                            }`}>
                                            <Paintbrush size={32} />
                                        </div>
                                        <div className="text-center">
                                            <h3 className={`text-lg font-bold mb-1 ${mode === 'STUDIO' ? 'text-white' : 'text-zinc-400'}`}>
                                                Start in Studio
                                            </h3>
                                            <p className="text-sm text-zinc-500">Sketch and render</p>
                                        </div>
                                        {mode === 'STUDIO' && (
                                            <div className="absolute top-4 right-4 text-indigo-500">
                                                <div className="bg-indigo-600 rounded-full p-0.5">
                                                    <Check size={14} className="text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </button>

                                    {/* Workbench Mode */}
                                    <button
                                        onClick={() => setMode('WORKBENCH')}
                                        className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition-all duration-300 ${mode === 'WORKBENCH'
                                                ? 'bg-[#111111] border-indigo-600 shadow-lg shadow-indigo-600/10'
                                                : 'bg-transparent border-[#2A2A2A] hover:border-zinc-700'
                                            }`}
                                    >
                                        <div className={`mb-6 p-4 rounded-xl transition-all duration-300 ${mode === 'WORKBENCH' ? 'bg-indigo-600 text-white scale-110' : 'bg-[#2A2A2A] text-zinc-400 group-hover:bg-[#333333]'
                                            }`}>
                                            <LayoutDashboard size={32} />
                                        </div>
                                        <div className="text-center">
                                            <h3 className={`text-lg font-bold mb-1 ${mode === 'WORKBENCH' ? 'text-white' : 'text-zinc-400'}`}>
                                                Start in Workbench
                                            </h3>
                                            <p className="text-sm text-zinc-500">Explore and collaborate</p>
                                        </div>
                                        {mode === 'WORKBENCH' && (
                                            <div className="absolute top-4 right-4 text-indigo-500">
                                                <div className="bg-indigo-600 rounded-full p-0.5">
                                                    <Check size={14} className="text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                </div>

                                <motion.button
                                    whileHover={{ scale: isCreating || !name.trim() ? 1 : 1.02 }}
                                    whileTap={{ scale: isCreating || !name.trim() ? 1 : 0.98 }}
                                    onClick={handleConfirm}
                                    disabled={isCreating || !name.trim()}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-xl text-lg font-bold transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 mt-4"
                                >
                                    {isCreating ? 'Creating Workspace...' : 'Create Project'}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
