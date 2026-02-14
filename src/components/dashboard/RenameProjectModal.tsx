"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface RenameProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (newName: string) => void;
    currentName: string;
}

export const RenameProjectModal: React.FC<RenameProjectModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentName
}) => {
    const [name, setName] = useState(currentName);

    useEffect(() => {
        if (isOpen) {
            setName(currentName);
        }
    }, [isOpen, currentName]);

    const handleConfirm = () => {
        if (name.trim() && name !== currentName) {
            onConfirm(name);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
                        className="relative w-full max-w-sm bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                        >
                            <X size={16} />
                        </button>

                        <div className="p-6">
                            <h2 className="text-xl font-bold tracking-tight mb-6">Rename Project</h2>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-[#111111] border border-[#333] focus:border-indigo-600 rounded-lg px-4 py-2.5 text-sm font-medium transition-all outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                    />
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleConfirm}
                                    disabled={!name.trim() || name === currentName}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
                                >
                                    Rename
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
