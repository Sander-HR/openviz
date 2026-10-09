import { RefObject, useCallback } from 'react';

import { useFlowViewport } from '@/flow/useFlowViewport';

export interface ScreenPoint {
    clientX: number;
    clientY: number;
}

export interface FlowPoint {
    x: number;
    y: number;
}

export const useScreenToFlowPoint = (
    wrapperRef: RefObject<HTMLElement | null>
): ((point: ScreenPoint) => FlowPoint | null) => {
    const { x, y, zoom } = useFlowViewport();

    return useCallback(
        ({ clientX, clientY }: ScreenPoint): FlowPoint | null => {
            const wrapper = wrapperRef.current;

            if (!wrapper || zoom === 0) {
                return null;
            }

            const rect = wrapper.getBoundingClientRect();
            const relativeX = clientX - rect.left;
            const relativeY = clientY - rect.top;

            return {
                x: (relativeX - x) / zoom,
                y: (relativeY - y) / zoom,
            };
        },
        [wrapperRef, x, y, zoom]
    );
};
