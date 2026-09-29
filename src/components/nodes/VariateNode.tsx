import React from 'react';
import { CopyPlus } from 'lucide-react';

import type { VariateWorkbenchNode } from '@/types';
import { cn, NodeCardHeader, nodeCardBodyClass, nodeCardClass } from './nodeUi';

interface VariateNodeData extends VariateWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface VariateNodeProps {
    id: string;
    data: VariateNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

/**
 * US3 shell (T036): header + collapsed summary only. The full variate body
 * (count/varyMode controls, Generate) lands in US5 with the renderService ops.
 */
export const VariateNode = React.memo(({ data, selected }: VariateNodeProps) => {
    const count = data.data?.count ?? 4;

    return (
        <div className={cn(nodeCardClass(selected), 'flex flex-col')}>
            <NodeCardHeader icon={CopyPlus} label="Variate" />
            <div className={nodeCardBodyClass()}>
                <p className="truncate text-xs text-viz-muted">
                    {data.data?.prompt || 'Generate variations'} · {count} outputs
                </p>
            </div>
        </div>
    );
});

VariateNode.displayName = 'VariateNode';
