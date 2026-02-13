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
                'z-[1000] bg-[#2c2c2c] text-[#e0e0e0] py-1 rounded-lg shadow-xl border border-[#3c3c3c] min-w-[220px] backdrop-blur-sm nowheel',
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
            disabled && 'opacity-30 cursor-not-allowed',
            !disabled && [
                'focus:bg-[#3b82f6] focus:text-white',
                type === 'danger' && 'focus:bg-red-500'
            ]
        )}
        disabled={disabled}
        onClick={onClick}
    >
        <span>{label}</span>
        {shortcut && (
            <span className="text-[#808080] text-xs font-mono group-focus:text-white/80">
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
        className="my-1 border-t border-[#3c3c3c]"
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
                <span style={{ position: 'fixed', left: x, top: y, width: 1, height: 1 }} />
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                    className={cn(
                        'z-[1000] bg-[#2c2c2c] text-[#e0e0e0] py-1 rounded-lg shadow-xl border border-[#3c3c3c] min-w-[220px] backdrop-blur-sm nowheel',
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
                                        action.disabled && 'opacity-30 cursor-not-allowed',
                                        !action.disabled && [
                                            'focus:bg-[#3b82f6] focus:text-white',
                                            action.type === 'danger' && 'focus:bg-red-500'
                                        ]
                                    )}
                                    disabled={action.disabled}
                                    onClick={action.onClick}
                                >
                                    <span>{action.label}</span>
                                    {action.shortcut && (
                                        <span className="text-[#808080] text-xs font-mono group-focus:text-white/80">
                                            {action.shortcut}
                                        </span>
                                    )}
                                </DropdownMenuPrimitive.Item>
                            )}
                            {action.divider && <DropdownMenuPrimitive.Separator className="my-1 border-t border-[#3c3c3c]" />}
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
