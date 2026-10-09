import React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ContextMenuAction {
    label?: string;
    shortcut?: string;
    onClick?: () => void;
    type?: 'danger' | 'default';
    divider?: boolean;
    disabled?: boolean;
}

type ContextMenuContentProps = React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>;

const ContextMenuContent = React.forwardRef<
    React.ElementRef<typeof ContextMenuPrimitive.Content>,
    ContextMenuContentProps
>(({ children, className, ...props }, ref) => (
    <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
            ref={ref}
            className={cn(
                'z-[1000] bg-viz-surface text-foreground py-1 rounded-lg shadow-viz border border-viz-border min-w-[220px] backdrop-blur-sm nowheel',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
                'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                className
            )}
            collisionPadding={10}
            {...props}
        >
            {children}
        </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = 'ContextMenuContent';

interface ContextMenuItemProps {
    label: string;
    shortcut?: string;
    onClick?: () => void;
    type?: 'danger' | 'default';
    disabled?: boolean;
}

const ContextMenuItem = React.forwardRef<
    React.ElementRef<typeof ContextMenuPrimitive.Item>,
    ContextMenuItemProps
>(({ label, shortcut, onClick, type = 'default', disabled }, ref) => (
    <ContextMenuPrimitive.Item
        ref={ref}
        className={cn(
            'w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors group cursor-pointer outline-none select-none',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
            !disabled && [
                'focus:bg-viz-selected focus:text-white',
                type === 'danger' && ['text-red-400', 'focus:bg-red-500/15']
            ]
        )}
        disabled={disabled}
        onClick={onClick}
    >
        <span>{label}</span>
        {shortcut && (
            <span className="text-viz-muted text-xs font-mono group-focus:text-white/80">
                {shortcut}
            </span>
        )}
    </ContextMenuPrimitive.Item>
));
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuSeparator = React.forwardRef<
    React.ElementRef<typeof ContextMenuPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>((props, ref) => (
    <ContextMenuPrimitive.Separator
        ref={ref}
        className="my-1 h-px bg-viz-border/60"
        {...props}
    />
));
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

// Interface for trigger-based context menus
interface ContextMenuProps {
    children: React.ReactNode;
    actions: ContextMenuAction[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ children, actions }) => {
    return (
        <ContextMenuPrimitive.Root>
            <ContextMenuPrimitive.Trigger asChild>
                {children}
            </ContextMenuPrimitive.Trigger>
            <ContextMenuContent>
                {actions.map((action, index) => (
                    <React.Fragment key={index}>
                        {!action.divider && (
                            <ContextMenuItem
                                label={action.label || ''}
                                shortcut={action.shortcut}
                                onClick={action.onClick}
                                type={action.type}
                                disabled={action.disabled}
                            />
                        )}
                        {action.divider && <ContextMenuSeparator />}
                    </React.Fragment>
                ))}
            </ContextMenuContent>
        </ContextMenuPrimitive.Root>
    );
};

// Positioned menu for coordinate-based display (e.g., workbench right-click)
interface PositionedMenuProps {
    x: number;
    y: number;
    open: boolean;
    onClose: () => void;
    actions: ContextMenuAction[];
}

const PositionedMenu: React.FC<PositionedMenuProps> = ({ x, y, open, onClose, actions }) => {
    if (!open) return null;

    return (
        <DropdownMenuPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DropdownMenuPrimitive.Trigger asChild>
                {/* Dynamic coordinates require inline positioning; static styling is in classes. */}
                <span className="fixed block h-px w-px" style={{ left: x, top: y }} />
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                    className={cn(
                        'z-[1000] bg-viz-surface text-foreground py-1 rounded-lg shadow-viz border border-viz-border min-w-[220px] backdrop-blur-sm nowheel',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                    )}
                    collisionPadding={10}
                    align="start"
                    side="bottom"
                    sideOffset={0}
                >
                    {actions.map((action, index) => (
                        <React.Fragment key={index}>
                            {!action.divider && (
                                <DropdownMenuPrimitive.Item
                                    className={cn(
                                        'w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors group cursor-pointer outline-none select-none',
                                        action.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                                        !action.disabled && [
                                            'focus:bg-viz-selected focus:text-white',
                                            action.type === 'danger' && ['text-red-400', 'focus:bg-red-500/15']
                                        ]
                                    )}
                                    disabled={action.disabled}
                                    onClick={action.onClick}
                                >
                                    <span>{action.label}</span>
                                    {action.shortcut && (
                                        <span className="text-viz-muted text-xs font-mono group-focus:text-white/80">
                                            {action.shortcut}
                                        </span>
                                    )}
                                </DropdownMenuPrimitive.Item>
                            )}
                            {action.divider && <DropdownMenuPrimitive.Separator className="my-1 h-px bg-viz-border/60" />}
                        </React.Fragment>
                    ))}
                </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
    );
};

// Export primitives for advanced usage
export {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuPrimitive,
    PositionedMenu
};
export type { ContextMenuAction, ContextMenuProps, PositionedMenuProps };
