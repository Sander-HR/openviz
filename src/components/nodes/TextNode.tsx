import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { Type } from 'lucide-react';

import { TextWorkbenchNode } from '@/types';
import { nodeCardClass, NodeCardHeader } from './nodeUi';

interface TextNodeData extends TextWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
}

interface TextNodeProps {
    id: string;
    data: TextNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

export const TextNode: React.FC<TextNodeProps> = ({ id, data, selected, width, height }) => {
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [nodeSize, setNodeSize] = useState({ width: width || 240, height: height || 72 });
    const textValue = useMemo(() => data.data?.text ?? '', [data.data?.text]);
    const textColor = data.data?.color ?? '#111827';
    const fontSize = Number.isFinite(data.data?.fontSize) ? Math.max(12, data.data.fontSize) : 24;

    useEffect(() => {
        if (width && height && width > 0 && height > 0) {
            setNodeSize({ width, height });
        }
    }, [width, height]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    return (
        <div style={{ width: nodeSize.width, height: nodeSize.height }} className={nodeCardClass(selected)} onDoubleClick={() => setIsEditing(true)}>
            <NodeCardHeader icon={Type} label="Text" />

            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={textValue}
                    onChange={(event) => data.onDataChange?.(id, { text: event.target.value })}
                    onBlur={() => setIsEditing(false)}
                    rows={1}
                    className="nodrag nowheel min-h-0 w-full flex-1 resize-none bg-transparent p-2 outline-none"
                    style={{ color: textColor, fontSize }}
                />
            ) : (
                <div
                    className="min-h-0 w-full flex-1 whitespace-pre-wrap overflow-hidden p-2"
                    style={{ color: textColor, fontSize }}
                >
                    {textValue || <span className="text-viz-muted">Double-click to edit</span>}
                </div>
            )}

            <NodeResizer
                isVisible={selected}
                minWidth={120}
                minHeight={44}
                color="#4C4CEF"
                handleStyle={{
                    width: 12,
                    height: 12,
                    backgroundColor: '#242425',
                    borderColor: '#4C4CEF',
                    borderWidth: '2px',
                    borderRadius: 3,
                }}
                onResize={(_event, resizeParams) => {
                    const newWidth = Number.isFinite(resizeParams.width) ? resizeParams.width : nodeSize.width;
                    const newHeight = Number.isFinite(resizeParams.height) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;

                    if (newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResize?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
                onResizeEnd={(_event, resizeParams) => {
                    const newWidth = Number.isFinite(resizeParams.width) ? resizeParams.width : nodeSize.width;
                    const newHeight = Number.isFinite(resizeParams.height) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;

                    if (newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResizeEnd?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
            />
        </div>
    );
};
