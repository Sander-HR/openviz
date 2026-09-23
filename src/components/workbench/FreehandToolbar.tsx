import { PenLine, Undo2 } from 'lucide-react';

interface FreehandToolbarProps {
    isDrawMode: boolean;
    freehandColor: string;
    freehandStrokeWidth: number;
    onToggleDrawMode: () => void;
    onFreehandColorChange: (color: string) => void;
    onFreehandStrokeWidthChange: (strokeWidth: number) => void;
    onUndoLastFreehand: () => void;
    className?: string;
    minStrokeWidth?: number;
    maxStrokeWidth?: number;
}

const clampStrokeWidth = (value: number, min: number, max: number) => {
    if (Number.isNaN(value)) {
        return min;
    }

    return Math.min(Math.max(value, min), max);
};

export function FreehandToolbar({
    isDrawMode,
    freehandColor,
    freehandStrokeWidth,
    onToggleDrawMode,
    onFreehandColorChange,
    onFreehandStrokeWidthChange,
    onUndoLastFreehand,
    className,
    minStrokeWidth = 1,
    maxStrokeWidth = 64,
}: FreehandToolbarProps) {
    return (
        <div
            className={`pointer-events-auto rounded-xl border border-panel-border bg-panel/95 p-3 text-white shadow-lg backdrop-blur-sm ${className ?? ''}`}
        >
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={onToggleDrawMode}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        isDrawMode
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-panel-border bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                    }`}
                    aria-pressed={isDrawMode}
                    title="Toggle freehand draw mode"
                >
                    <PenLine className="h-4 w-4" />
                    {isDrawMode ? 'Drawing On' : 'Drawing Off'}
                </button>

                <label className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-300">Color</span>
                    <input
                        type="color"
                        value={freehandColor}
                        onChange={(event) => onFreehandColorChange(event.target.value)}
                        className="h-9 w-10 cursor-pointer rounded border border-panel-border bg-transparent p-1"
                        aria-label="Freehand stroke color"
                    />
                </label>

                <label className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-300">Width</span>
                    <input
                        type="range"
                        min={minStrokeWidth}
                        max={maxStrokeWidth}
                        step={1}
                        value={freehandStrokeWidth}
                        onChange={(event) => onFreehandStrokeWidthChange(Number(event.target.value))}
                        className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-neutral-800 accent-primary"
                        aria-label="Freehand stroke width"
                    />
                    <input
                        type="number"
                        min={minStrokeWidth}
                        max={maxStrokeWidth}
                        step={1}
                        value={freehandStrokeWidth}
                        onChange={(event) => {
                            const strokeWidth = clampStrokeWidth(
                                Number(event.target.value),
                                minStrokeWidth,
                                maxStrokeWidth
                            );
                            onFreehandStrokeWidthChange(strokeWidth);
                        }}
                        className="w-16 rounded-md border border-panel-border bg-neutral-900 px-2 py-1 text-right text-sm"
                        aria-label="Freehand stroke width number input"
                    />
                </label>

                <button
                    type="button"
                    onClick={onUndoLastFreehand}
                    className="inline-flex items-center gap-2 rounded-md border border-panel-border bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                    title="Undo the last freehand drawing"
                >
                    <Undo2 className="h-4 w-4" />
                    Undo Last Drawing
                </button>
            </div>
        </div>
    );
}

export type { FreehandToolbarProps };
