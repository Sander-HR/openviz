import { memo } from 'react';
import type { FlowViewport } from './CursorOverlay';
import { useStore } from '@/store/useStore';
import { CursorOverlay } from './CursorOverlay';

export interface WorkbenchCursorLayerProps {
    viewport: FlowViewport;
}

export const WorkbenchCursorLayer = memo(function WorkbenchCursorLayer({ viewport }: WorkbenchCursorLayerProps) {
    const remoteCursors = useStore((state) => state.remoteCursors);
    return <CursorOverlay remoteCursors={remoteCursors} viewport={viewport} />;
});
