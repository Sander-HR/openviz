import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HalftoneBackground } from './HalftoneBackground';

type CtxStub = {
    fillRect: ReturnType<typeof vi.fn>;
    clearRect: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    arc: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    setTransform: ReturnType<typeof vi.fn>;
    _style: string;
};

function createCtxStub(styleLog: string[]): CtxStub {
    const stub: CtxStub = {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        setTransform: vi.fn(),
        _style: '',
    };
    Object.defineProperty(stub, 'fillStyle', {
        get: () => stub._style,
        set: (value: string) => {
            stub._style = value;
            styleLog.push(value);
        },
    });
    return stub;
}

class ResizeObserverStub {
    static instances: ResizeObserverStub[] = [];
    constructor() {
        ResizeObserverStub.instances.push(this);
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}

describe('HalftoneBackground', () => {
    let ctx: CtxStub;
    let styleLog: string[];
    let rafQueue: FrameRequestCallback[];
    let cancelSpy: ReturnType<typeof vi.fn>;
    let nextId: number;

    const matchMediaMock = (reduced: boolean) =>
        vi.fn().mockImplementation((query: string) => ({
            matches: reduced && query === '(prefers-reduced-motion: reduce)',
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })) as unknown as typeof window.matchMedia;

    /** Flush one animation frame so the rAF loop draws. */
    const frame = (now: number) => {
        const pending = rafQueue.splice(0, rafQueue.length);
        act(() => {
            for (const cb of pending) cb(now);
        });
    };

    beforeEach(() => {
        styleLog = [];
        ctx = createCtxStub(styleLog);
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            ctx as unknown as CanvasRenderingContext2D,
        );
        rafQueue = [];
        nextId = 1;
        cancelSpy = vi.fn();
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rafQueue.push(cb);
            return nextId++;
        });
        vi.stubGlobal('cancelAnimationFrame', cancelSpy);
        ResizeObserverStub.instances = [];
        vi.stubGlobal('ResizeObserver', ResizeObserverStub);
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            width: 280,
            height: 180,
            top: 0,
            left: 0,
            right: 280,
            bottom: 180,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('renders a canvas inside the positioned container', () => {
        vi.stubGlobal('matchMedia', matchMediaMock(false));
        const { container } = render(<HalftoneBackground className="absolute inset-0" />);
        expect(container.querySelector('canvas')).toBeTruthy();
        const containerEl = container.firstElementChild as HTMLElement | null;
        expect(containerEl?.className).toContain('absolute inset-0');
    });

    it('schedules the animation loop and draws halftone dots every frame', () => {
        vi.stubGlobal('matchMedia', matchMediaMock(false));
        render(<HalftoneBackground />);
        expect(rafQueue.length).toBe(1);
        frame(16.7);
        expect(ctx.arc.mock.calls.length).toBeGreaterThan(0);
        const afterFirst = ctx.arc.mock.calls.length;
        frame(33.4);
        expect(ctx.arc.mock.calls.length).toBeGreaterThan(afterFirst);
    });

    it('clears a transparent canvas when no background color is given', () => {
        vi.stubGlobal('matchMedia', matchMediaMock(false));
        render(<HalftoneBackground />);
        frame(16.7);
        expect(ctx.clearRect).toHaveBeenCalled();
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('paints the provided background color under the dots', () => {
        vi.stubGlobal('matchMedia', matchMediaMock(false));
        render(<HalftoneBackground background="#fafafa" />);
        frame(16.7);
        expect(ctx.fillRect).toHaveBeenCalled();
        expect(styleLog[0]).toBe('#fafafa');
    });

    it('draws a single static frame and never animates when reduced motion is preferred', () => {
        vi.stubGlobal('matchMedia', matchMediaMock(true));
        render(<HalftoneBackground />);
        expect(rafQueue.length).toBe(0);
        expect(ctx.arc.mock.calls.length).toBeGreaterThan(0);
    });

    it('cancels the animation loop on unmount', () => {
        vi.stubGlobal('matchMedia', matchMediaMock(false));
        const { unmount } = render(<HalftoneBackground />);
        frame(16.7);
        unmount();
        expect(cancelSpy).toHaveBeenCalled();
    });
});
