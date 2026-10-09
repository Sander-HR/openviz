import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface HalftoneBackgroundProps {
    className?: string;
    /** Distance between dot centers in px. Default 14. */
    dotSpacing?: number;
    /** Maximum dot radius in px. Default 6. */
    maxRadius?: number;
    /** Dot color. Default '#0ea5e9'. */
    color?: string;
    /** Solid background painted under the dots. Omit for a transparent canvas. */
    background?: string;
    /** Time multiplier. Default 1. */
    speed?: number;
    /** Spatial frequency multiplier (higher = tighter waves). Default 1. */
    scale?: number;
}

/**
 * Animated halftone dot-field background, rendered on a canvas.
 *
 * Ported from the "halftone" background on shadcn.io: a fixed grid of dots whose
 * radii are modulated by three traveling sine waves — a radial wave around a
 * center that orbits in a Lissajous figure, a horizontal band wave, and a
 * per-row phase wave. Their interference reads as drifting halftone blobs.
 */
export const HalftoneBackground = React.memo(function HalftoneBackground({
    className,
    dotSpacing = 14,
    maxRadius = 6,
    color = '#0ea5e9',
    background,
    speed = 1,
    scale = 1,
}: HalftoneBackgroundProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const spacing = Math.max(4, dotSpacing);
        const radius = Math.max(0.5, maxRadius);
        const freq = 0.015 * scale;

        let width = 0;
        let height = 0;
        let dpr = 1;
        let time = 0;
        let lastFrameAt = 0;
        let running = false;
        let rafId = 0;

        const resize = () => {
            const rect = container.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            dpr = window.devicePixelRatio || 1;
            canvas.width = Math.max(1, Math.floor(width * dpr));
            canvas.height = Math.max(1, Math.floor(height * dpr));
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const draw = () => {
            const t = 0.001 * time * speed;
            if (background) {
                ctx.fillStyle = background;
                ctx.fillRect(0, 0, width, height);
            } else {
                ctx.clearRect(0, 0, width, height);
            }
            ctx.fillStyle = color;

            // Center orbiting a Lissajous figure around the middle of the canvas.
            const cx = width * (0.5 + 0.3 * Math.sin(0.4 * t));
            const cy = height * (0.5 + 0.3 * Math.cos(0.6 * t));

            for (let y = spacing / 2; y < height; y += spacing) {
                const rowPhase = 0.5 * Math.sin(y * freq * 0.8 + 0.7 * t) + 0.5;
                for (let x = spacing / 2; x < width; x += spacing) {
                    const r = radius * (
                        0.55 * (0.5 * Math.sin(Math.hypot(x - cx, y - cy) * freq - 2 * t) + 0.5)
                        + 0.3 * (0.5 * Math.sin(x * freq + t) + 0.5)
                        + 0.15 * rowPhase
                    );
                    if (r >= 0.3) {
                        ctx.beginPath();
                        ctx.arc(x, y, r, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            }
        };

        const tick = () => {
            const now = performance.now();
            if (lastFrameAt !== 0) time += now - lastFrameAt;
            lastFrameAt = now;
            draw();
            rafId = requestAnimationFrame(tick);
        };

        const start = () => {
            if (!running && !reducedMotion) {
                running = true;
                lastFrameAt = 0;
                rafId = requestAnimationFrame(tick);
            }
        };

        const stop = () => {
            running = false;
            lastFrameAt = 0;
            cancelAnimationFrame(rafId);
        };

        resize();
        if (reducedMotion) {
            draw();
        } else {
            start();
        }

        const observer = new ResizeObserver(() => {
            stop();
            resize();
            if (reducedMotion) {
                draw();
            } else {
                start();
            }
        });
        observer.observe(container);

        const onVisibilityChange = () => {
            if (document.hidden) {
                stop();
            } else {
                start();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            stop();
            observer.disconnect();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [dotSpacing, maxRadius, color, background, speed, scale]);

    return (
        <div ref={containerRef} className={cn('pointer-events-none overflow-hidden', className)}>
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        </div>
    );
});
