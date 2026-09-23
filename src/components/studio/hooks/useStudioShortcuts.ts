import { useEffect } from "react";
import { ToolType } from "@/types";

type StudioShortcutsOptions = {
    setActiveTool: (tool: ToolType) => void;
    undo: () => void;
    redo: () => void;
};

export function useStudioShortcuts({ setActiveTool, undo, redo }: StudioShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                    return;
                }
                if (e.key.toLowerCase() === "y") {
                    e.preventDefault();
                    redo();
                    return;
                }
            }

            switch (e.key.toLowerCase()) {
                case "b":
                    setActiveTool("brush");
                    break;
                case "e":
                    setActiveTool("eraser");
                    break;
                case "s":
                    setActiveTool("select");
                    break;
                case "r":
                    setActiveTool("rectangle");
                    break;
                case "o":
                    setActiveTool("circle");
                    break;
                case "l":
                    setActiveTool("line");
                    break;
                case "g":
                    setActiveTool("paintbucket");
                    break;
                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setActiveTool, undo, redo]);
}
