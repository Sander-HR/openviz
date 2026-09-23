import { type CSSProperties } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getNodeContainerClass(selected: boolean, isHoverConnectable: boolean): string {
    return cn(
        'relative w-[320px] bg-[#1a1a1a] rounded-2xl shadow-2xl border-2 transition-colors pointer-events-auto flex flex-col overflow-hidden',
        selected ? 'border-[#6366f1]' : 'border-[#333] hover:border-[#6366f1]',
        isHoverConnectable && 'border-[#6366f1]'
    );
}

export const fullNodeTargetHandleStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'transparent',
    border: 'none',
};

export const elevatedFullNodeTargetHandleStyle: CSSProperties = {
    ...fullNodeTargetHandleStyle,
    zIndex: 10000,
};

export const imageLikeHandleStyle: CSSProperties = {
    background: '#6366f1',
    width: '26px',
    height: '26px',
    border: '3px solid white',
    cursor: 'hand',
    transformOrigin: 'center',
    transition: 'opacity 300ms ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
