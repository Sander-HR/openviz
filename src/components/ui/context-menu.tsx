/**
 * Shared context-menu surface (ui-translation §2).
 * Re-exports the token-restyled `src/components/ContextMenu.tsx` so all menus
 * share one visual language. New code should import from here.
 */
export {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuPrimitive,
    PositionedMenu,
} from '../ContextMenu';
export type { ContextMenuAction, ContextMenuProps, PositionedMenuProps } from '../ContextMenu';
