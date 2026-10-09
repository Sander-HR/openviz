type SceneSaveFlushListener = () => void;

const flushListeners = new Set<SceneSaveFlushListener>();

/**
 * Subscribe to immediate scene save requests.
 * Returns an unsubscribe function.
 */
export const onImmediateSceneSaveRequested = (listener: SceneSaveFlushListener): (() => void) => {
    flushListeners.add(listener);
    return () => {
        flushListeners.delete(listener);
    };
};

/**
 * Ask the scene autosaver to persist the current workbench state right now,
 * bypassing its debounce. Called when a user gesture finishes (mouse released,
 * movement complete) so a page reload never shows stale state.
 */
export const requestImmediateSceneSave = (): void => {
    flushListeners.forEach((listener) => listener());
};
