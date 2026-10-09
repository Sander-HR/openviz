import type { Project } from '@/types';

const TRANSITION_ID = 'openviz-image-canvas-transition';
const TRANSITION_DURATION_MS = 360;

type TransitionOverlay = HTMLImageElement & {
    dataset: DOMStringMap;
};

function getCanvasTarget(project: Project) {
    const width = Math.max(1, project.canvas.width);
    const height = Math.max(1, project.canvas.height);
    const horizontalOffset = 276;
    const verticalPadding = 60;
    const availableWidth = Math.max(1, window.innerWidth - horizontalOffset * 2);
    const availableHeight = Math.max(1, window.innerHeight - verticalPadding * 2);
    const scale = Math.min(availableWidth / width, availableHeight / height, 1.5);
    const targetWidth = width * scale;
    const targetHeight = height * scale;

    return {
        left: horizontalOffset + (availableWidth - targetWidth) / 2,
        top: verticalPadding + (availableHeight - targetHeight) / 2,
        width: targetWidth,
        height: targetHeight,
    };
}

function removeOverlay(overlay: TransitionOverlay): void {
    if (overlay.dataset.cleanupTimer) {
        window.clearTimeout(Number(overlay.dataset.cleanupTimer));
    }
    overlay.remove();
}

/**
 * Starts a cross-route visual handoff. The overlay is attached to document.body
 * rather than the Workbench tree, so the image remains visible while Next
 * replaces the route with Studio.
 */
export function startImageCanvasTransition(source: HTMLElement, project: Project): void {
    if (typeof document === 'undefined') return;

    document.getElementById(TRANSITION_ID)?.remove();
    const sourceRect = source.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0) return;

    const sourceImage = source.querySelector('img');
    const src = sourceImage?.currentSrc || sourceImage?.src || project.thumbnail;
    if (!src) return;

    const target = getCanvasTarget(project);
    const overlay = document.createElement('img') as TransitionOverlay;
    overlay.id = TRANSITION_ID;
    overlay.src = src;
    overlay.alt = '';
    overlay.dataset.cleanupTimer = String(window.setTimeout(() => removeOverlay(overlay), 1200));
    Object.assign(overlay.style, {
        position: 'fixed',
        left: `${sourceRect.left}px`,
        top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        objectFit: 'cover',
        zIndex: '2147483647',
        pointerEvents: 'none',
        transformOrigin: 'top left',
        borderRadius: '8px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.24)',
        willChange: 'left, top, width, height, opacity',
    });
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.animate(
            [
                { left: `${sourceRect.left}px`, top: `${sourceRect.top}px`, width: `${sourceRect.width}px`, height: `${sourceRect.height}px`, borderRadius: '8px' },
                { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, borderRadius: '0px' },
            ],
            { duration: TRANSITION_DURATION_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        );
    });
}

/** Called by Studio once the Konva surface has mounted behind the overlay. */
export function completeImageCanvasTransition(): void {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById(TRANSITION_ID) as TransitionOverlay | null;
    if (!overlay) return;

    overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }).finished
        .then(() => removeOverlay(overlay))
        .catch(() => removeOverlay(overlay));
}