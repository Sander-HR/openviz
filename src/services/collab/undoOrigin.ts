import * as Y from 'yjs';

/**
 * Per-user undo/redo over the shared scene document.
 *
 * The UndoManager tracks ONLY this client's origin, so undoing local gestures
 * can never revert a collaborator's changes (SC-005 / FR-008).
 */
export interface CollabUndoManager {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    /** Fires whenever the tracked (local-origin) undo/redo stack changes. */
    subscribe(listener: () => void): () => void;
    destroy(): void;
}

export function createCollabUndoManager(doc: Y.Doc, origin: string): CollabUndoManager {
    // trackedOrigins is a Set (yjs 13.6) and must contain ONLY this client's
    // origin — remote transactions are never undoable from this session.
    // captureTimeout: 0 keeps ONE completed gesture (one origin-tagged
    // transaction) as exactly one undo step, matching feature 002 semantics.
    const undoManager = new Y.UndoManager(doc, { trackedOrigins: new Set([origin]), captureTimeout: 0 });
    return {
        undo: () => undoManager.undo(),
        redo: () => undoManager.redo(),
        canUndo: () => undoManager.canUndo(),
        canRedo: () => undoManager.canRedo(),
        subscribe: (listener) => {
            // yjs EventEmitter.on returns `this`, not an unsubscribe — use off().
            undoManager.on('stack-item-added', listener);
            undoManager.on('stack-item-popped', listener);
            undoManager.on('stack-cleared', listener);
            return () => {
                undoManager.off('stack-item-added', listener);
                undoManager.off('stack-item-popped', listener);
                undoManager.off('stack-cleared', listener);
            };
        },
        destroy: () => undoManager.destroy(),
    };
}
