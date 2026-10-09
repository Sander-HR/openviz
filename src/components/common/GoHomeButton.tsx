import React from 'react';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';

interface GoHomeButtonProps {
    className?: string;
}

export const GoHomeButton: React.FC<GoHomeButtonProps> = ({ className }) => {
    const router = useRouter();

    return (
        <button
            onClick={() => router.push('/dashboard')}
            className={`w-9 h-9 flex items-center justify-center bg-panel border border-panel-border rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 text-text-secondary hover:text-white transition-all group pointer-events-auto ${className}`}
            title="Go Home (Dashboard)"
        >
            <Home size={16} className="group-hover:scale-110 transition-transform" />
        </button>
    );
};
