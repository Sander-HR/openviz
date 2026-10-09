import '@testing-library/jest-dom/vitest'
// jsdom has no IndexedDB; provide a real in-memory implementation for the
// zustand persist layer and the collaboration offline store (y-indexeddb).
import 'fake-indexeddb/auto'

// jsdom has no ResizeObserver; React Flow's node measurement requires it.
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}
