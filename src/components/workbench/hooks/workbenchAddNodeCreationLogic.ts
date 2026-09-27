import type {
    AnimateNode,
    ExtractWorkbenchNode,
    ModifyNode,
    NewViewWorkbenchNode,
    NoteWorkbenchNode,
    RenderNode,
    SectionWorkbenchNode,
    TextWorkbenchNode,
    VariateWorkbenchNode,
} from '@/types';
import { generateUUID } from '@/utils/uuid';

/**
 * US3 (T035/T036): the set of creatable node kinds surfaced by the add-node
 * menu (ui-translation §3.1). Legacy types (Style, Mix, legacy Render, Try on)
 * are excluded from v1 per FR-004. This is the canonical definition; the menu
 * component re-exports it.
 */
export type AddNodeKind =
    | 'sketch'
    | 'render'
    | 'animate'
    | 'modify'
    | 'variate'
    | 'extract'
    | 'new-view'
    | 'text'
    | 'note'
    | 'section'
    | 'media';

/**
 * The outcome of routing an add-node selection. Two kinds delegate to existing
 * flows (sketch format picker, media upload); the rest build a node payload
 * centered on the canvas center point:
 *  - `one-shot`: text/note — created via the atomic createOneShotNode action so
 *    selection + tool-switch happen in one store update (FR-007).
 *  - `add`: generation/section shells — plain addWorkbenchNode.
 */
export type AddNodePlan =
    | { kind: 'sketch' }
    | { kind: 'media' }
    | { kind: 'one-shot'; node: TextWorkbenchNode | NoteWorkbenchNode }
    | {
          kind: 'add';
          node:
              | RenderNode
              | AnimateNode
              | ModifyNode
              | VariateWorkbenchNode
              | NewViewWorkbenchNode
              | ExtractWorkbenchNode
              | SectionWorkbenchNode;
      };

interface CenterPoint {
    x: number;
    y: number;
}

function buildTextNode(center: CenterPoint): TextWorkbenchNode {
    return {
        id: generateUUID(),
        type: 'text',
        x: center.x - 120,
        y: center.y - 36,
        width: 240,
        height: 72,
        data: { text: '', fontSize: 24, color: '#111827' },
    };
}

function buildNoteNode(center: CenterPoint): NoteWorkbenchNode {
    return {
        id: generateUUID(),
        type: 'note',
        x: center.x - 110,
        y: center.y - 90,
        width: 220,
        height: 180,
        data: { text: '', colorVariant: 'yellow' },
    };
}

function buildRenderNode(center: CenterPoint): RenderNode {
    return {
        id: generateUUID(),
        type: 'render',
        x: center.x - 160,
        y: center.y - 250,
        width: 320,
        height: 390,
        data: { prompt: '', stylePreset: 'Photorealistic', drawingInfluence: 0.65, numImages: 1 },
    };
}

function buildAnimateNode(center: CenterPoint): AnimateNode {
    return {
        id: generateUUID(),
        type: 'animate',
        x: center.x - 160,
        y: center.y - 160,
        width: 320,
        height: 320,
        data: { prompt: '', frames: {}, settings: { model: 'default', duration: '2s' } },
    };
}

function buildModifyNode(center: CenterPoint): ModifyNode {
    return {
        id: generateUUID(),
        type: 'modify',
        x: center.x - 160,
        y: center.y - 280,
        width: 320,
        height: 560,
        data: {
            workflowId: 'product_edit',
            prompt: '',
            aspectRatio: 'square',
            preservation: 0.78,
            structureStrength: 0.72,
            references: [],
            numImages: 1,
            status: 'idle',
        },
    };
}

function buildVariateNode(center: CenterPoint): VariateWorkbenchNode {
    return {
        id: generateUUID(),
        type: 'variate',
        x: center.x - 140,
        y: center.y - 80,
        width: 280,
        height: 160,
        data: { prompt: '', count: 4 },
    };
}

function buildNewViewNode(center: CenterPoint): NewViewWorkbenchNode {
    return {
        id: generateUUID(),
        type: 'new-view',
        x: center.x - 140,
        y: center.y - 80,
        width: 280,
        height: 160,
        data: { prompt: '', view: null },
    };
}

function buildExtractNode(center: CenterPoint): ExtractWorkbenchNode {
    return {
        id: generateUUID(),
        type: 'extract',
        x: center.x - 140,
        y: center.y - 80,
        width: 280,
        height: 160,
        data: { prompt: '', backgroundHandling: 'transparent' },
    };
}

function buildSectionNode(center: CenterPoint): SectionWorkbenchNode {
    return {
        id: generateUUID(),
        type: 'section',
        x: center.x - 140,
        y: center.y - 80,
        width: 280,
        height: 160,
        data: { label: 'Section' },
    };
}

/**
 * Pure routing for an add-node selection (T035). Given a kind and the canvas
 * center point in flow coordinates, returns the plan the view executes. Kept
 * free of React/store so the "create at canvas center" behavior is unit-testable.
 */
export function planAddNodeCreation(kind: AddNodeKind, center: CenterPoint): AddNodePlan {
    switch (kind) {
        case 'sketch':
            return { kind: 'sketch' };
        case 'media':
            return { kind: 'media' };
        case 'text':
            return { kind: 'one-shot', node: buildTextNode(center) };
        case 'note':
            return { kind: 'one-shot', node: buildNoteNode(center) };
        case 'render':
            return { kind: 'add', node: buildRenderNode(center) };
        case 'animate':
            return { kind: 'add', node: buildAnimateNode(center) };
        case 'modify':
            return { kind: 'add', node: buildModifyNode(center) };
        case 'variate':
            return { kind: 'add', node: buildVariateNode(center) };
        case 'new-view':
            return { kind: 'add', node: buildNewViewNode(center) };
        case 'extract':
            return { kind: 'add', node: buildExtractNode(center) };
        case 'section':
            return { kind: 'add', node: buildSectionNode(center) };
    }
}
