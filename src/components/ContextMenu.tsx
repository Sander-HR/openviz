import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    actions: {
        label: string;
        shortcut?: string;
        onClick: () => void;
        type?: 'danger' | 'default';
        divider?: boolean;
    }[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, actions }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed z-[1000] bg-[#2c2c2c] text-[#e0e0e0] py-1 rounded-lg shadow-xl border border-[#3c3c3c] min-w-[220px] backdrop-blur-sm nowheel"
            style={{ left: x, top: y }}
        >
            {actions.map((action, index) => (
                <React.Fragment key={index}>
                    <button
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-[#3b82f6] hover:text-white flex items-center justify-between transition-colors group ${action.type === 'danger' ? 'hover:bg-red-500' : ''
                            }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            action.onClick();
                            onClose();
                        }}
                    >
                        <span>{action.label}</span>
                        {action.shortcut && (
                            <span className="text-[#808080] text-xs font-mono group-hover:text-white/80">
                                {action.shortcut}
                            </span>
                        )}
                    </button>
                    {action.divider && <div className="my-1 border-t border-[#3c3c3c]" />}
                </React.Fragment>
            ))}
        </div>
    );
};
