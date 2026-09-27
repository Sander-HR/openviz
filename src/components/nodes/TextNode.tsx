import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { Bold, ChevronDown, Italic } from 'lucide-react';

import { TextWorkbenchNode } from '@/types';
import { cn, nodeCardClass, resizeHandleClassName } from './nodeUi';

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
    const fontWeight = data.data?.fontWeight ?? 400;
    const fontStyle = data.data?.fontStyle ?? 'normal';

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
                <div className="nodrag nopan pointer-events-auto absolute -top-11 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl2 border border-viz-border bg-viz-panel px-1.5 py-1 shadow-viz">
                    <button type="button" title="Bold" aria-pressed={fontWeight >= 700} onClick={() => data.onDataChange?.(id, { fontWeight: fontWeight >= 700 ? 400 : 700 })} className="rounded-lg p-1.5 text-viz-muted hover:bg-viz-surface hover:text-white"><Bold size={14} /></button>
                    <button type="button" title="Italic" aria-pressed={fontStyle === 'italic'} onClick={() => data.onDataChange?.(id, { fontStyle: fontStyle === 'italic' ? 'normal' : 'italic' })} className="rounded-lg p-1.5 text-viz-muted hover:bg-viz-surface hover:text-white"><Italic size={14} /></button>
                    <div className="mx-0.5 h-5 w-px bg-viz-border" />
                    <label className="sr-only" htmlFor={`text-size-${id}`}>Text size</label>
                    <select id={`text-size-${id}`} value={fontSize} onChange={(event) => data.onDataChange?.(id, { fontSize: Number(event.target.value) })} className="h-7 rounded-lg border-0 bg-transparent px-1 text-xs text-white outline-none focus:ring-1 focus:ring-viz-accent">
                        {[16, 20, 24, 32, 40, 48, 64].map((size) => <option key={size} value={size}>{size}px</option>)}
                    </select>
                    <ChevronDown size={12} className="-ml-2 text-viz-muted" />
                </div>
            )}

            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={textValue}
                    onChange={(event) => data.onDataChange?.(id, { text: event.target.value })}
                    onBlur={() => setIsEditing(false)}
                    rows={1}
                    className="nodrag nowheel min-h-0 w-full flex-1 resize-none bg-transparent p-2 outline-none"
                    style={{ color: textColor, fontSize, fontWeight, fontStyle }}
                />
            ) : (
                <div
                    className="min-h-0 w-full flex-1 whitespace-pre-wrap overflow-hidden p-0"
                    style={{ color: textColor, fontSize, fontWeight, fontStyle }}
                >
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
};
