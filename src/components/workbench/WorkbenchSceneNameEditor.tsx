import { useState, type FormEvent, type KeyboardEvent } from 'react';

export interface WorkbenchSceneNameEditorProps {
    value: string | undefined;
    onSave: (name: string) => void;
    disabled?: boolean;
}

export function WorkbenchSceneNameEditor({ value, onSave, disabled = false }: WorkbenchSceneNameEditorProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const beginEditing = (): void => {
        setDraft(value ?? '');
        setEditing(true);
    };

    const cancelEditing = (): void => {
        setDraft(value ?? '');
        setEditing(false);
    };

    const saveEditing = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const name = draft.trim();
        if (name) onSave(name);
        else setDraft(value ?? '');
        setEditing(false);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelEditing();
        }
    };

    if (!editing) {
        return (
            <button
                type="button"
                aria-label="Rename scene"
                disabled={disabled}
                onClick={beginEditing}
                className="min-h-11 min-w-11 max-w-[calc(100vw_-_8rem)] truncate rounded-md px-3 py-2 text-sm font-medium text-studio-ink hover:bg-panel/80 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-48"
            >
                {value?.trim() || 'Untitled scene'}
            </button>
        );
    }

    return (
        <form onSubmit={saveEditing} className="flex items-center gap-1" aria-label="Edit scene name">
            <input
                aria-label="Scene name"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-11 w-36 min-w-0 rounded-md border border-panel-border bg-panel px-3 py-2 text-sm text-studio-ink focus:outline-none focus:ring-2 focus:ring-primary/50 sm:w-40"
            />
            <button
                type="submit"
                aria-label="Save scene name"
                className="min-h-11 min-w-11 rounded-md px-2 py-2 text-sm text-studio-ink hover:bg-panel/80"
            >
                Save
            </button>
            <button
                type="button"
                aria-label="Cancel scene name edit"
                onClick={cancelEditing}
                className="min-h-11 min-w-11 rounded-md px-2 py-2 text-sm text-studio-ink hover:bg-panel/80"
            >
                Cancel
            </button>
        </form>
    );
}
