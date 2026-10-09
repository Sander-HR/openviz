import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 * Shared `cn` helper used by shadcn/ui components (see components.json).
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
