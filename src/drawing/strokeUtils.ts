import { getStroke } from 'perfect-freehand';

export interface Point {
    x: number;
    y: number;
}

export interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
}

const formatCoordinate = (value: number): string =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');

type StrokePointEndCap = {
    taper: number;
    cap: boolean;
};

export type StrokePathOptions = {
    size?: number;
    smoothing?: number;
    thinning?: number;
    streamline?: number;
    easing?: (t: number) => number;
    start?: StrokePointEndCap;
    end?: StrokePointEndCap;
};

const DEFAULT_FREEHAND_STROKE_OPTIONS: Required<StrokePathOptions> = {
    size: 16,
    smoothing: 0.75,
    thinning: 0.4,
    streamline: 0.75,
    easing: (t: number): number => t,
    start: {
        taper: 0,
        cap: true,
    },
    end: {
        taper: 0,
        cap: true,
    },
};

export const pointsToPath = (points: Point[], options: StrokePathOptions = {}): string => {
    if (points.length < 2) {
        return '';
    }

    const strokeOptions: Required<StrokePathOptions> = {
        ...DEFAULT_FREEHAND_STROKE_OPTIONS,
        ...options,
        start: {
            ...DEFAULT_FREEHAND_STROKE_OPTIONS.start,
            ...options.start,
        },
        end: {
            ...DEFAULT_FREEHAND_STROKE_OPTIONS.end,
            ...options.end,
        },
    };

    const strokePoints = getStroke(
        points.map((point) => [point.x, point.y] as [number, number]),
        strokeOptions
    );

    if (strokePoints.length === 0) {
        return '';
    }

    const [firstPoint, ...remainingPoints] = strokePoints;
    const pathParts = [
        `M ${formatCoordinate(firstPoint[0])} ${formatCoordinate(firstPoint[1])}`,
        ...remainingPoints.map(
            (point) => `L ${formatCoordinate(point[0])} ${formatCoordinate(point[1])}`
        ),
        'Z',
    ];

    return pathParts.join(' ');
};

export const getBoundingBox = (points: Point[]): BoundingBox | null => {
    if (points.length === 0) {
        return null;
    }

    const [firstPoint, ...restPoints] = points;

    let minX = firstPoint.x;
    let minY = firstPoint.y;
    let maxX = firstPoint.x;
    let maxY = firstPoint.y;

    for (const point of restPoints) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
};
