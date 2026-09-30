import React from 'react';
import { Cpu } from 'lucide-react';

interface ModelTierBadgeProps {
    tier: string;
    explanation?: string;
}

export const ModelTierBadge: React.FC<ModelTierBadgeProps> = ({ tier, explanation }) => (
    <span title={explanation} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 font-mono text-[10px] text-violet-700">
        <Cpu size={10} /> {tier}
    </span>
);
