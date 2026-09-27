import React from 'react';
import { SquareStack } from 'lucide-react';

import type { SectionWorkbenchNode } from '@/types';
import { cn, NodeCardHeader, nodeCardBodyClass, nodeCardClass } from './nodeUi';

interface SectionNodeData extends SectionWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface SectionNodeProps {
    id: string;
    data: SectionNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

/**
 * US3 shell (T036): lightweight grouping placeholder for the add-node menu's
 * Section entry. Membership/wrapping ("Wrap in section") is deferred — v1 only
 * needs a creatable, selectable card with a label.
 */
export const SectionNode: React.FC<SectionNodeProps> = ({ data, selected }) => {
    return (
        <div className={cn(nodeCardClass(selected), 'flex flex-col')}>
            <NodeCardHeader icon={SquareStack} label="Section" />
            <div className={nodeCardBodyClass()}>
                <p className="truncate text-xs text-viz-muted">{data.data?.label || 'Section'}</p>
            </div>
        </div>
    );
};
