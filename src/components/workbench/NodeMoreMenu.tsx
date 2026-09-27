import React from 'react';

import { Separator } from '@/components/ui/separator';
import { MenuItemRow } from './menu/MenuItemRow';
import type { NodeMoreMenuAction, NodeMoreMenuGroup } from './hooks/useNodeMoreMenuActions';

/**
 * The "more" menu (ui-translation §3.3): data-driven from the T029 action
 * registry, five groups separated by `Separator`, right-aligned Kbd hints,
 * danger-styled Delete, disabled rows inert. Rendered inside a Radix menu
 * content (dropdown for the toolbar trigger, context menu for right-click).
 */

export interface NodeMoreMenuExtraAction {
    label: string;
    shortcut?: string;
    onClick: () => void;
}

export interface NodeMoreMenuProps {
    actions: NodeMoreMenuAction[];
    onAction: (id: string) => void;
    /** Extra rows appended to the clipboard group (e.g. Paste on right-click). */
    extraActions?: NodeMoreMenuExtraAction[];
}

const GROUPS: NodeMoreMenuGroup[] = ['image', 'library', 'organization', 'clipboard', 'danger'];

export const NodeMoreMenu: React.FC<NodeMoreMenuProps> = ({ actions, onAction, extraActions }) => {
    return (
        <div className="w-[206px] rounded-lg border border-viz-border bg-viz-surface p-1 shadow-viz">
            {GROUPS.map((group, groupIndex) => (
                <React.Fragment key={group}>
                    {groupIndex > 0 && (
                        // Non-decorative so the separator keeps its
                        // `role="separator"` in the DOM (Radix decorative
                        // separators render `role="none"`).
                        <Separator decorative={false} className="my-1 bg-viz-border/60" />
                    )}
                    {actions
                        .filter((action) => action.group === group)
                        .map((action) => (
                            <MenuItemRow
                                key={action.id}
                                label={action.label}
                                icon={action.icon}
                                shortcut={action.shortcut}
                                danger={action.danger}
                                disabled={!action.enabled}
                                onClick={() => onAction(action.id)}
                            />
                        ))}
                    {group === 'clipboard' &&
                        extraActions?.map((extra) => (
                            <MenuItemRow
                                key={extra.label}
                                label={extra.label}
                                shortcut={extra.shortcut}
                                onClick={extra.onClick}
                            />
                        ))}
                </React.Fragment>
            ))}
        </div>
    );
};
