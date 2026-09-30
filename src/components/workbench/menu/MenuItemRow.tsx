import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

export interface MenuItemRowProps {
    label: string;
    icon?: LucideIcon;
    /** Right-aligned shortcut hint, rendered as a <Kbd> chip when present. */
    shortcut?: string;
    /** Destructive action styling (red label). */
    danger?: boolean;
    /** Active-state check indicator (e.g. current theme selection). */
    checked?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
}

/**
 * Shared menu row anatomy (ui-translation §3.3): 14px muted icon, truncated
 * label, optional right-aligned <Kbd> shortcut hint. Usable standalone or as
 * the child of a Radix menu item via `asChild`.
 */
export function MenuItemRow({
    label,
    icon: Icon,
    shortcut,
    danger = false,
    checked = false,
    disabled = false,
    onClick,
    className,
}: MenuItemRowProps) {
    return (
        <div
            role="menuitem"
            aria-disabled={disabled || undefined}
            onClick={disabled ? undefined : onClick}
            className={cn(
                'flex h-[35px] cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-xs',
                danger ? 'text-red-400' : 'text-foreground',
                disabled && 'pointer-events-none opacity-40',
                className,
            )}
        >
            {Icon && <Icon size={14} className={cn('shrink-0', !danger && 'text-viz-muted')} />}
            <span className="flex-1 truncate">{label}</span>
            {checked && <Check size={14} className="shrink-0 text-viz-accent" />}
            {shortcut && <Kbd>{shortcut}</Kbd>}
        </div>
    );
}
