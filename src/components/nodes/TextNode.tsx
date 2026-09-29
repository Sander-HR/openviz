import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';

import { TextWorkbenchNode } from '@/types';
import { cn, nodeCardClass, resizeHandleClassName } from './nodeUi';
import { TextFormattingToolbar } from './TextFormattingToolbar';

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

export const TextNode = React.memo(({ id, data, selected, width, height }: TextNodeProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [nodeSize, setNodeSize] = useState({ width: width || 240, height: height || 72 });
    const textValue = useMemo(() => data.data?.text ?? '', [data.data?.text]);
    const textColor = data.data?.color ?? '#111827';
    const fontSize = Number.isFinite(data.data?.fontSize) ? Math.max(12, data.data.fontSize) : 24;
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
        <div style={{ width: nodeSize.width, height: nodeSize.height }} className={cn(nodeCardClass(false), 'border-transparent bg-transparent shadow-none')} onDoubleClick={() => setIsEditing(true)}>
            <span className="sr-only">Text</span>
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
                    rows={1}
                    className="nodrag nowheel min-h-0 w-full flex-1 resize-none bg-transparent p-2 outline-none"
                    style={textStyle}
                />
            ) : (
                <div className="min-h-0 w-full flex-1 whitespace-pre-wrap overflow-hidden p-0" style={textStyle}>
                    {textValue || <span className="text-viz-muted">Double-click to edit</span>}
                </div>
            )}

            <NodeResizer
                isVisible={selected}
                minWidth={120}
                minHeight={44}
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
});

TextNode.displayName = 'TextNode';
