import { Handle, Position } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { AnimateNode as AnimateNodeType } from '../../types';
import { AnimateNode as AnimateNodeComponent } from '../nodes/AnimateNode';

interface WorkbenchAnimateNodeProps {
    id: string;
    data: AnimateNodeType;
    selected: boolean;
    isConnectable: boolean;
}

export const WorkbenchAnimateNode: React.FC<WorkbenchAnimateNodeProps> = ({ id, data, selected, isConnectable = true }) => {
    return (
        <>
            <Handle
                type="target"
                position={Position.Left}
                id="animate-target"
                style={{
                    left: '0px',
                    top: '50%',
                    background: '#6366f1',
                    width: '26px',
                    height: '26px',
                    border: '3px solid white',
                    cursor: 'hand',
                    zIndex: 1000,
                    opacity: selected ? 1 : 0,
                    transformOrigin: 'center',
                    transition: 'opacity 300ms ease',
                    pointerEvents: selected ? 'auto' : 'none',
                    display: 'flex',
                    translate: 'translateY(-50%)',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                isConnectable={isConnectable}
            >
                <Plus size={16} color="white" strokeWidth={3} />
            </Handle>
                <AnimateNodeComponent
                    id={id}
                    data={data}
                    selected={selected}
                />
        </>
    );
};
