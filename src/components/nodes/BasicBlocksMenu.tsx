import React, { useEffect, useRef } from 'react';
import { Sparkles, Play, Repeat, Wand2, ArrowRight } from 'lucide-react';

interface BasicBlocksMenuProps {
    onSelect: (type: 'modify' | 'animate' | 'variate' | 'render') => void;
    onClose?: () => void;
}

export const BasicBlocksMenu: React.FC<BasicBlocksMenuProps> = ({ onSelect, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose?.();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div ref={menuRef} className="w-[300px] bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#333] overflow-hidden animate-in fade-in zoom-in-95 duration-200 nowheel">
            {/* Header Input */}
            <div className="p-3 border-b border-[#333]">
                <div className="relative bg-[#2a2a2a] rounded-xl flex items-center">
                    <input
                        type="text"
                        placeholder="What are you creating?"
                        className="w-full bg-transparent text-white text-sm px-4 py-3 focus:outline-none placeholder-gray-500 nowheel"
                    />
                    <button className="mr-2 p-1.5 hover:bg-[#333] rounded-lg transition-colors">
                        <ArrowRight size={14} className="text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
                <div className="px-3 py-2 text-xs text-gray-500 font-medium">Basic blocks</div>

                <button
                    onClick={() => onSelect('modify')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#2a2a2a] transition-colors text-left group"
                >
                    <Wand2 size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                    <span className="text-gray-300 group-hover:text-white text-sm">Modify</span>
                </button>

                <button
                    onClick={() => onSelect('animate')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#2a2a2a] transition-colors text-left group"
                >
                    <Play size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                    <span className="text-gray-300 group-hover:text-white text-sm">Animate</span>
                </button>

                <button
                    onClick={() => onSelect('variate')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#2a2a2a] transition-colors text-left group"
                >
                    <Repeat size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                    <span className="text-gray-300 group-hover:text-white text-sm">Variate</span>
                </button>

                <button
                    onClick={() => onSelect('render')}
                    className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#2a2a2a] transition-colors text-left group"
                >
                    <div className="flex items-center gap-3">
                        <Sparkles size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                        <span className="text-gray-300 group-hover:text-white text-sm">Render</span>
                    </div>
                </button>
            </div>
        </div>
    );
};
