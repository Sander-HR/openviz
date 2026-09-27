import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';

import { NoteWorkbenchNode } from '@/types';
import { cn, resizeHandleClassName } from './nodeUi';
import { TextFormattingToolbar } from './TextFormattingToolbar';

interface NoteNodeData extends NoteWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
}

interface NoteNodeProps {
    id: string;
    data: NoteNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

export const NoteNode: React.FC<NoteNodeProps> = ({ id, data, selected, width, height }) => {
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [nodeSize, setNodeSize] = useState({ width: width || 220, height: height || 180 });
    const textValue = useMemo(() => data.data?.text ?? '', [data.data?.text]);

    const textColor = data.data?.color ?? '#78350f';
    const rawFontSize = data.data?.fontSize;
    const fontSize = typeof rawFontSize === 'number' && Number.isFinite(rawFontSize) ? Math.max(12, rawFontSize) : 16;
    const fontWeight = data.data?.fontWeight ?? 400;
    const fontStyle = data.data?.fontStyle ?? 'normal';
    const underline = data.data?.underline === true;
    const align = data.data?.align ?? 'left';
    const fontFamily = data.data?.fontFamily;

    const textStyle: React.CSSProperties = {
        color: textColor,
        fontSize,
        fontWeight,
        fontStyle,
        textDecoration: underline ? 'underline' : undefined,
        textAlign: align,
        fontFamily,
    };

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
        <div style={{ width: nodeSize.width, height: nodeSize.height }}
            className={cn(
                'relative flex flex-col overflow-visible rounded border bg-amber-100 shadow-viz',
                selected ? 'border-amber-200 ring-2 ring-viz-accent' : 'border-amber-200'
            )}
            onDoubleClick={() => setIsEditing(true)}
        >
            {selected && (
                <TextFormattingToolbar
                    state={{ fontSize, color: textColor, fontWeight, fontStyle, underline, align, fontFamily }}
                    onChange={(patch) => data.onDataChange?.(id, patch)}
                />
            )}

            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={textValue}
                    onChange={(event) => data.onDataChange?.(id, { text: event.target.value })}
                    onBlur={() => setIsEditing(false)}
                    className="nodrag nowheel font-note min-h-0 w-full flex-1 resize-none bg-transparent p-3 leading-relaxed outline-none"
                    style={textStyle}
                />
            ) : (
                <div className="font-note min-h-0 w-full flex-1 whitespace-pre-wrap overflow-hidden p-3 leading-relaxed" style={textStyle}>
                    {textValue || 'Note'}
                </div>
            )}

            <NodeResizer
                isVisible={selected}
                minWidth={120}
                minHeight={100}
                color="#4C4CEF"
                handleClassName={resizeHandleClassName}
                handleStyle={{
                    width: 12,
                    height: 12,
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
