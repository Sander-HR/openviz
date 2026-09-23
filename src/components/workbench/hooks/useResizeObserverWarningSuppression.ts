import { useEffect } from 'react';

/**
 * Dev-only guard that swallows benign "ResizeObserver loop limit exceeded"
 * warnings emitted by React Flow / Konva overlays, so they don't pollute the
 * console during development. No-op in production. (T028: extracted from the
 * Workbench view to keep it under the 300-line constitution limit.)
 */
export function useResizeObserverWarningSuppression(): void {
    useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            return;
        }

        const resizeObserverMessages = new Set([
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications.',
        ]);

        const toMessage = (value: unknown): string => {
            if (typeof value === 'string') {
                return value;
            }
            if (value instanceof Error) {
                return value.message;
            }
            if (value && typeof value === 'object' && 'message' in value) {
                const maybeMessage = (value as { message?: unknown }).message;
                if (typeof maybeMessage === 'string') {
                    return maybeMessage;
                }
            }
            return '';
        };

        const debugSuppression = process.env.NEXT_PUBLIC_DEBUG_RESIZE_OBSERVER === 'true';

        const suppress = (event: Event, message: string) => {
            if (!resizeObserverMessages.has(message)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            if (debugSuppression) {
                console.debug('[WorkbenchResize] Suppressed ResizeObserver warning', { message });
            }
        };

        const onWindowError = (event: ErrorEvent) => {
            const message = toMessage(event.message || event.error);
            suppress(event, message);
        };

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            const message = toMessage(event.reason);
            suppress(event, message);
        };

        window.addEventListener('error', onWindowError, true);
        window.addEventListener('unhandledrejection', onUnhandledRejection, true);

        return () => {
            window.removeEventListener('error', onWindowError, true);
            window.removeEventListener('unhandledrejection', onUnhandledRejection, true);
        };
    }, []);
}
