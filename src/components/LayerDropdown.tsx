import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
    Copy,
    Trash2,
    Files,
    Type,
    ClipboardPaste
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';

interface LayerDropdownProps {
    layerId: string;
    onClose: () => void;
    position: { x: number; y: number };
}

const LayerDropdown: React.FC<LayerDropdownProps> = ({ layerId, onClose, position }) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const {
        removeLayer,
        duplicateLayer,
        copyLayer,
        pasteLayer,
        clipboard
    } = useStore();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const actions = [
        {
            label: 'Rename',
            icon: <Type size={14} />,
            onClick: () => {
                onClose();
            }
        },
        {
            label: 'Copy',
            icon: <Copy size={14} />,
            onClick: () => {
                copyLayer(layerId);
                onClose();
            },
            shortcut: 'Ctrl+C'
        },
        {
            label: 'Duplicate',
            icon: <Files size={14} />,
            onClick: () => {
                duplicateLayer(layerId);
                onClose();
            }
        },
        {
            label: 'Paste',
            icon: <ClipboardPaste size={14} />,
            onClick: () => {
                pasteLayer();
                onClose();
            },
            disabled: !clipboard
        },
        { type: 'divider' as const },
        {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            onClick: () => {
                removeLayer(layerId);
                onClose();
            },
            danger: true,
            shortcut: 'Del'
        },
    ];

    const dropdownContent = (
        <AnimatePresence>
            <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, scale: 0.95, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -10 }}
                style={{
                    position: 'fixed',
                    top: position.y,
                    left: position.x,
                    zIndex: 9999
                }}
                className="w-48 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 overflow-hidden pointer-events-auto"
            >
                {actions.map((action, index) => (
                    'type' in action && action.type === 'divider' ? (
                        <div key={index} className="h-px bg-neutral-800 my-1" />
                    ) : (
                        <button
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation();
                                if ('onClick' in action && !action.disabled) {
                                    action.onClick();
                                }
                            }}
                            disabled={'disabled' in action ? action.disabled : false}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left",
                                'danger' in action && (action as any).danger
                                    ? "text-red-400 hover:bg-red-500/10"
                                    : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
                                'disabled' in action && (action as any).disabled && "opacity-30 cursor-not-allowed grayscale"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                {'icon' in action && (action as any).icon}
                                <span>{'label' in action && (action as any).label}</span>
                            </div>
                            {'shortcut' in action && (action as any).shortcut && (
                                <span className="text-[10px] opacity-40">{(action as any).shortcut}</span>
                            )}
                        </button>
                    )
                ))}
            </motion.div>
        </AnimatePresence>
    );

    return ReactDOM.createPortal(dropdownContent, document.body);
};

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}

export default LayerDropdown;
