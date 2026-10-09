import { useMemo } from 'react';

import { useViewport } from '@xyflow/react';

export interface FlowViewport {
    x: number;
    y: number;
    zoom: number;
}

export const useFlowViewport = (): FlowViewport => {
    const viewport = useViewport();

    return useMemo(
        () => ({
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
        }),
        [viewport.x, viewport.y, viewport.zoom]
    );
};
