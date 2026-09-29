import React, { useState } from 'react';

import type { ViewName } from '@/types';
import { cn } from './nodeUi';

export interface ViewCubePickerProps {
    selectedView: ViewName | null;
    onSelect: (view: ViewName) => void;
    /** Length of the outward front-direction arrow in SVG viewBox units. */
    frontArrowLength?: number;
    /** Reports the view under the pointer (null when leaving) so the parent can preview it in the label. */
    onHover?: (view: ViewName | null) => void;
}

type Point = readonly [number, number];

interface CubeFace {
    view: ViewName;
    points: Point[];
}

type CornerName = 'topBack' | 'topLeft' | 'topRight' | 'topFront' | 'bottomLeft' | 'bottomRight' | 'bottomFront' | 'bottomBack';

/**
 * Isometric cube corner positions (viewBox 0 0 120 118). The seven visible
 * corners carry the interactive dots; `bottomBack` is the hidden corner that
 * only shows up where the dotted wireframe edges meet.
 */
const CORNERS: Record<CornerName, Point> = {
    topBack: [60, 18],
    topLeft: [24, 39],
    topRight: [96, 39],
    topFront: [60, 60],
    bottomLeft: [24, 79],
    bottomRight: [96, 79],
    bottomFront: [60, 100],
    bottomBack: [60, 58],
};

/** Face plates keep this fraction of each full face when inset toward its centroid — the rest becomes spacing. */
const FACE_SCALE = 0.7;
const CORNER_RADIUS = 5;
const FRONT_ARROW_START: Point = [42, 89.5];
const FRONT_ARROW_DIRECTION: Point = [-51, 27];
const DEFAULT_FRONT_ARROW_LENGTH = Math.hypot(...FRONT_ARROW_DIRECTION) / 2;

const FACES: CubeFace[] = [
    { view: 'Top', points: [CORNERS.topBack, CORNERS.topRight, CORNERS.topFront, CORNERS.topLeft] },
    { view: 'Front', points: [CORNERS.topLeft, CORNERS.topFront, CORNERS.bottomFront, CORNERS.bottomLeft] },
    { view: 'Left', points: [CORNERS.topRight, CORNERS.topFront, CORNERS.bottomFront, CORNERS.bottomRight] },
];

/** Visible cube edges, drawn as dotted lines behind the face plates. */
const EDGES: Array<[CornerName, CornerName]> = [
    ['topBack', 'topLeft'],
    ['topBack', 'topRight'],
    ['topLeft', 'topFront'],
    ['topFront', 'topRight'],
    ['bottomLeft', 'bottomFront'],
    ['bottomFront', 'bottomRight'],
    ['topLeft', 'bottomLeft'],
    ['topRight', 'bottomRight'],
    ['topFront', 'bottomFront'],
    ['bottomBack', 'bottomLeft'],
    ['bottomBack', 'bottomRight'],
];

const CORNER_VIEWS: Array<{ view: ViewName; corner: CornerName }> = [
    { view: 'Rear Right 3/4 view', corner: 'topBack' }, // back-top (rear face is hidden — dropdown only)
    { view: 'Front Right 3/4 view', corner: 'topLeft' },
    { view: 'Rear Left 3/4 view', corner: 'topRight' },
    { view: 'Front Left 3/4 view', corner: 'topFront' }, // front-top corner where the visible faces meet
    { view: 'Bottom Front Right 3/4 view', corner: 'bottomLeft' },
    { view: 'Bottom Rear Left 3/4 view', corner: 'bottomRight' },
    { view: 'Bottom Front Left 3/4 view', corner: 'bottomFront' },
];

function centroid(points: Point[]): Point {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of points) {
        sx += x;
        sy += y;
    }
    return [sx / points.length, sy / points.length];
}

/** Scales a polygon toward its centroid, opening a uniform gap between faces and corner dots. */
function insetPolygon(points: Point[], scale: number): Point[] {
    const [cx, cy] = centroid(points);
    return points.map(([x, y]): Point => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
}

/** Builds a rounded polygon path so the three face plates have soft corners. */
function roundedPolygonPath(points: Point[], radius: number): string {
    const corners = points.map(([x, y], index) => {
        const previous = points[(index - 1 + points.length) % points.length];
        const next = points[(index + 1) % points.length];
        const previousLength = Math.hypot(previous[0] - x, previous[1] - y);
        const nextLength = Math.hypot(next[0] - x, next[1] - y);
        const beforeDistance = Math.min(radius, previousLength / 2);
        const afterDistance = Math.min(radius, nextLength / 2);

        return {
            before: [x + ((previous[0] - x) * beforeDistance) / previousLength, y + ((previous[1] - y) * beforeDistance) / previousLength] as Point,
            vertex: [x, y] as Point,
            after: [x + ((next[0] - x) * afterDistance) / nextLength, y + ((next[1] - y) * afterDistance) / nextLength] as Point,
        };
    });

    const first = corners[0].before;
    const commands = [`M${first[0].toFixed(2)} ${first[1].toFixed(2)}`];
    corners.forEach(({ vertex, after }, index) => {
        const nextBefore = corners[(index + 1) % corners.length].before;
        commands.push(
            `Q${vertex[0].toFixed(2)} ${vertex[1].toFixed(2)} ${after[0].toFixed(2)} ${after[1].toFixed(2)}`,
            `L${nextBefore[0].toFixed(2)} ${nextBefore[1].toFixed(2)}`,
        );
    });
    return `${commands.join(' ')} Z`;
}

/** Per-face base shading so the cube reads as 3D (light from above). */
const FACE_SHADES: Partial<Record<ViewName, string>> = {
    Top: 'fill-zinc-600',
    Front: 'fill-zinc-600',
    Left: 'fill-zinc-600',
};

function slug(view: ViewName): string {
    return view.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Interactive cube gizmo for picking a camera view (spec 008 FR-005 companion UI).
 * Face plates map to Top/Front/Left; corner dots map to the 3/4 viewpoints. Each
 * face is inset toward its centroid and dotted wireframe edges connect the
 * corners, so every surface and dot stays visually separated. Hovering lights
 * the element up and previews its name in the parent's dropdown label; clicking
 * commits the selection. Hidden views (Rear, Right, Bottom, ...) have no cube
 * element and are reachable from the dropdown list only.
 */
export const ViewCubePicker: React.FC<ViewCubePickerProps> = ({ selectedView, onSelect, onHover, frontArrowLength = DEFAULT_FRONT_ARROW_LENGTH }) => {
    const [hoveredView, setHoveredView] = useState<ViewName | null>(null);
    const directionLength = Math.hypot(...FRONT_ARROW_DIRECTION);
    const frontArrowEnd: Point = [
        FRONT_ARROW_START[0] + (FRONT_ARROW_DIRECTION[0] / directionLength) * frontArrowLength,
        FRONT_ARROW_START[1] + (FRONT_ARROW_DIRECTION[1] / directionLength) * frontArrowLength,
    ];

    const handleHover = (view: ViewName | null) => {
        setHoveredView(view);
        onHover?.(view);
    };

    const fillClass = (view: ViewName, isFace: boolean): string => {
        if (view === selectedView) return 'fill-viz-accent';
        if (view === hoveredView) return 'fill-white';
        return isFace ? (FACE_SHADES[view] ?? 'fill-viz-muted') : 'fill-zinc-600';
    };

    const activate = (view: ViewName) => (event: React.MouseEvent<SVGElement> | React.KeyboardEvent<SVGElement>) => {
        event.stopPropagation();
        onSelect(view);
    };

    const keyActivate = (view: ViewName) => (event: React.KeyboardEvent<SVGElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate(view)(event);
        }
    };

    return (
        <div className="nodrag mx-auto w-40 select-none">
            <svg viewBox="-10 0 130 125" role="group" aria-label="View cube" className="h-auto w-full">
                <defs>
                    <marker id="view-cube-front-arrow" markerHeight="4" markerWidth="4" orient="auto" refX="3.5" refY="2" viewBox="0 0 4 4">
                        <path d="M0.75 0.75 L3.25 2 L0.75 3.25" fill="none" stroke="#52525b" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
                    </marker>
                </defs>
                {EDGES.map(([from, to]) => (
                    <line
                        key={`${from}-${to}`}
                        x1={CORNERS[from][0]}
                        y1={CORNERS[from][1]}
                        x2={CORNERS[to][0]}
                        y2={CORNERS[to][1]}
                        strokeDasharray="2 4"
                        strokeLinecap="round"
                        className="pointer-events-none stroke-white/20"
                    />
                ))}
                <line
                    x1={FRONT_ARROW_START[0]}
                    y1={FRONT_ARROW_START[1]}
                    x2={frontArrowEnd[0]}
                    y2={frontArrowEnd[1]}
                    aria-hidden="true"
                    className="pointer-events-none stroke-zinc-600"
                    markerEnd="url(#view-cube-front-arrow)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="2 4"
                />
                {FACES.map((face) => (
                    <path
                        key={face.view}
                        d={roundedPolygonPath(insetPolygon(face.points, FACE_SCALE), 3)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${face.view} view`}
                        data-testid={`view-cube-${slug(face.view)}`}
                        className={cn('cursor-pointer outline-none transition-colors duration-150', fillClass(face.view, true))}
                        onMouseEnter={() => handleHover(face.view)}
                        onMouseLeave={() => handleHover(null)}
                        onClick={activate(face.view)}
                        onKeyDown={keyActivate(face.view)}
                    >
                        <title>{face.view}</title>
                    </path>
                ))}
                {CORNER_VIEWS.map(({ view, corner }) => (
                    <circle
                        key={view}
                        cx={CORNERS[corner][0]}
                        cy={CORNERS[corner][1]}
                        r={CORNER_RADIUS}
                        role="button"
                        tabIndex={0}
                        aria-label={`${view} view`}
                        data-testid={`view-cube-${slug(view)}`}
                        className={cn('cursor-pointer outline-none transition-colors duration-150', fillClass(view, false))}
                        onMouseEnter={() => handleHover(view)}
                        onMouseLeave={() => handleHover(null)}
                        onClick={activate(view)}
                        onKeyDown={keyActivate(view)}
                    >
                        <title>{view}</title>
                    </circle>
                ))}
            </svg>
        </div>
    );
};
