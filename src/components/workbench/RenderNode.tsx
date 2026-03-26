import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { RenderNode as RenderNodeType } from '../../types';
import { RenderNode as RenderNodeComponent } from '../nodes/RenderNode';

interface WorkbenchRenderNodeProps {
    id: string;
    data: RenderNodeType;
    selected: boolean;
    isConnectable: boolean;
}

export const WorkbenchRenderNode: React.FC<WorkbenchRenderNodeProps> = ({ id, data, selected, isConnectable = true }) => {
    return (
        <div style={{ width: 'fit-content', height: 'fit-content' }}>
            <Handle
                type="target"
                position={Position.Left}
                id="render-target"
                style={{
                    left: '0px',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#6366f1',
                    width: '26px',
                    height: '26px',
                    border: '3px solid white',
                    cursor: 'hand',
                    zIndex: 1000,
                    opacity: selected ? 1 : 0,
                    transition: 'opacity 300ms ease',
                    pointerEvents: selected ? 'auto' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                isConnectable={isConnectable}
            >
                <Plus size={16} color="white" strokeWidth={3} />
            </Handle>

            <RenderNodeComponent
                id={id}
                data={data}
                selected={selected}
            />
        </div>
    );
};
