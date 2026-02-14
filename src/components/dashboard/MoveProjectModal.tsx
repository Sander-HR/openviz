"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useWorkspace } from "@/context/WorkspaceContext";

interface MoveProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (workspaceId: string) => void;
    currentWorkspaceId: string;
}

export const MoveProjectModal: React.FC<MoveProjectModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentWorkspaceId
}) => {
    const { workspaces } = useWorkspace();
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

    const handleConfirm = () => {
        if (selectedWorkspaceId) {
            onConfirm(selectedWorkspaceId);
            onClose();
        }
    };

    const eligibleWorkspaces = workspaces.filter(ws => ws.id !== currentWorkspaceId);

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
                            <h2 className="text-xl font-bold tracking-tight mb-4">Move Project</h2>
                            <p className="text-sm text-zinc-400 mb-4">Select a destination workspace.</p>

                            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                                {eligibleWorkspaces.length === 0 ? (
                                    <div className="text-sm text-zinc-500 italic p-2">No other workspaces available.</div>
                                ) : (
                                    eligibleWorkspaces.map(ws => (
                                        <div
                                            key={ws.id}
                                            onClick={() => setSelectedWorkspaceId(ws.id)}
                                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border ${selectedWorkspaceId === ws.id
                                                    ? 'bg-[#2A2A2A] border-indigo-500/50'
                                                    : 'border-transparent hover:bg-[#252525]'
                                                }`}
                                        >
                                            <span className="text-sm font-medium">{ws.name}</span>
                                            {selectedWorkspaceId === ws.id && <Check size={16} className="text-indigo-500" />}
                                        </div>
                                    ))
                                )}
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleConfirm}
                                disabled={!selectedWorkspaceId}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                            >
                                Move Project
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
