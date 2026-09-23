import '@testing-library/jest-dom/vitest'
// jsdom has no IndexedDB; provide a real in-memory implementation for the
// zustand persist layer and the collaboration offline store (y-indexeddb).
import 'fake-indexeddb/auto'
