'use client';

import React from 'react';
import { nodeCardClass, NodeTargetHandle } from '@/components/nodes/nodeUi';
import { GenerationModePanel } from './GenerationModePanel';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';

/** Live panel props carried on the generation node's data (same pattern as workbench nodes). */
export type GenerationLabNodeData = {
    state: GenerationPlaygroundState;
    referenceCount: number;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (request: RenderTaskRequest) => void;
};

interface GenerationLabNodeProps {
    id: string;
    data: GenerationLabNodeData;
    selected?: boolean;
}

/**
 * The shared multi-mode generation node as a real workbench canvas node: the
 * standard 280px card shell and a receiving handle for reference images. Like
 * the workbench's render/animate nodes it has no source handle — generated
 * outputs land on the canvas as detached nodes.
 */
export const GenerationLabNode = React.memo(({ data, selected }: GenerationLabNodeProps) => {
    const isSelected = selected === true;

    return (
        <div role="region" aria-label="Shared generation node" className={nodeCardClass(isSelected)}>
            <NodeTargetHandle id="generation-lab-target" selected={isSelected} />
            <GenerationModePanel {...data} />
        </div>
    );
});

GenerationLabNode.displayName = 'GenerationLabNode';
