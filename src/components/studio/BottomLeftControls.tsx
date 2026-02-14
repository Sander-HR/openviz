import React from 'react';
import { Clock } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { GoHomeButton } from '../common/GoHomeButton';

export const BottomLeftControls: React.FC = () => {
    const { history } = useStore();

    return (
        <div className="flex items-center gap-2">
            <GoHomeButton />
            <button className="w-9 h-9 flex items-center justify-center bg-panel border border-panel-border rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 text-text-secondary hover:text-white transition-all group overflow-hidden relative pointer-events-auto">
                <Clock size={16} className="group-hover:rotate-12 transition-transform" />
                <div className="absolute top-0.5 right-1.5 w-3.5 h-3.5 bg-primary text-[7px] font-bold text-white rounded-full flex items-center justify-center border border-panel">
                    {history.length}
                </div>
            </button>
        </div>
    );
};
