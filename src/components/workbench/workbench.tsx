import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { WorkbenchContent } from './WorkbenchContent';

export const Workbench: React.FC<{ active?: boolean }> = ({ active = true }) => (
    <ReactFlowProvider>
        <WorkbenchContent active={active} />
    </ReactFlowProvider>
);
