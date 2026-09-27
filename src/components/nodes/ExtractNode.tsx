import React from 'react';
import { Scissors } from 'lucide-react';

import type { ExtractWorkbenchNode } from '@/types';
import { cn, NodeCardHeader, nodeCardBodyClass, nodeCardClass } from './nodeUi';

interface ExtractNodeData extends ExtractWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface ExtractNodeProps {
    id: string;
    data: ExtractNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

/**
 * US3 shell (T036): header + collapsed summary only. The extract prompt and
 * background-handling controls land in US5 with the renderService ops.
 */
export const ExtractNode: React.FC<ExtractNodeProps> = ({ data, selected }) => {
    const backgroundHandling = data.data?.backgroundHandling ?? 'transparent';

    return (
        <div className={cn(nodeCardClass(selected), 'flex flex-col')}>
            <NodeCardHeader icon={Scissors} label="Extract" />
            <div className={nodeCardBodyClass()}>
                <p className="truncate text-xs text-viz-muted">
                    {data.data?.extractPrompt || data.data?.prompt || 'Extract a subject'} · background: {backgroundHandling}
                </p>
            </div>
        </div>
    );
};
