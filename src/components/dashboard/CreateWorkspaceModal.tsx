"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface CreateWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string) => void;
    isCreating?: boolean;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isCreating = false
}) => {
    const [name, setName] = useState('');

    const handleConfirm = () => {
        if (name.trim()) {
            onConfirm(name);
            setName(''); // Reset on success
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
                        className="relative w-full max-w-md bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                        >
                            <X size={20} />
                        </button>

                        <div className="p-8">
                            <h2 className="text-2xl font-bold tracking-tight mb-6">Create New Workspace</h2>

                            <div className="space-y-6">
                                {/* Name Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">
                                        Workspace Name
                                    </label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[#111111] border-2 border-transparent focus:border-indigo-600 rounded-xl px-4 py-3 text-base font-medium transition-all outline-none"
                                        placeholder="e.g. My Team, Personal..."
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                    />
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleConfirm}
                                    disabled={isCreating || !name.trim()}
                                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-xl text-base font-bold transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3"
                                >
                                    {isCreating ? 'Creating...' : 'Create Workspace'}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
