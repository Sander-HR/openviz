import React from 'react';
import { Eye } from 'lucide-react';

import type { NewViewWorkbenchNode } from '@/types';
import { cn, NodeCardHeader, nodeCardBodyClass, nodeCardClass } from './nodeUi';

interface NewViewNodeData extends NewViewWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface NewViewNodeProps {
    id: string;
    data: NewViewNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

/**
 * US3 shell (T036): header + view placeholder only. The view selector and
 * Generate action land in US5 (FR-007: Generate disabled until a view is set).
 */
export const NewViewNode: React.FC<NewViewNodeProps> = ({ data, selected }) => {
    const view = data.data?.view;

    return (
        <div className={cn(nodeCardClass(selected), 'flex flex-col')}>
            <NodeCardHeader icon={Eye} label="New View" />
            <div className={nodeCardBodyClass()}>
                <p className="truncate text-xs text-viz-muted">
                    {view ?? 'Select a view'}
                    {data.data?.prompt ? ` · ${data.data.prompt}` : ''}
                </p>
            </div>
        </div>
    );
};
