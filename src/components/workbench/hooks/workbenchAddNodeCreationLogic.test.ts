import { describe, expect, it } from 'vitest';

// T035/T036 (US3): pure routing for the add-node menu. Each non-legacy kind
// either builds a node payload centered on the canvas center point or routes
// to an existing flow (sketch format / media upload). Kept pure so the menu's
// "create at canvas center" behavior is testable without rendering the canvas.

import { planAddNodeCreation, type AddNodeKind } from './workbenchAddNodeCreationLogic';

const CENTER = { x: 500, y: 400 };

describe('planAddNodeCreation — flow routing', () => {
    it('routes sketch to the existing format-creation flow', () => {
        expect(planAddNodeCreation('sketch', CENTER)).toEqual({ kind: 'sketch' });
    });

    it('routes media/video to the existing upload flow', () => {
        expect(planAddNodeCreation('media', CENTER)).toEqual({ kind: 'media' });
    });
});

describe('planAddNodeCreation — one-shot tools (text/note)', () => {
    it('builds a text node centered on the point via the one-shot path', () => {
        const plan = planAddNodeCreation('text', CENTER);
        expect(plan.kind).toBe('one-shot');
        if (plan.kind !== 'one-shot') return;
        expect(plan.node.type).toBe('text');
        // Centered: point minus half the default 240x72 box.
        expect(plan.node.x).toBe(500 - 120);
        expect(plan.node.y).toBe(400 - 36);
    });

    it('builds a note node centered on the point via the one-shot path', () => {
        const plan = planAddNodeCreation('note', CENTER);
        expect(plan.kind).toBe('one-shot');
        if (plan.kind !== 'one-shot') return;
        expect(plan.node.type).toBe('note');
        expect(plan.node.x).toBe(500 - 110);
        expect(plan.node.y).toBe(400 - 90);
    });
});

describe('planAddNodeCreation — generation nodes (data-model defaults)', () => {
    it('builds a render node with default settings, centered', () => {
        const plan = planAddNodeCreation('render', CENTER);
        expect(plan.kind).toBe('add');
        if (plan.kind !== 'add') return;
        expect(plan.node.type).toBe('render');
        expect(plan.node.x).toBe(500 - 160); // 320 wide
        expect(plan.node.y).toBe(400 - 250); // 500 tall
    });

    it('builds an animate node with empty prompt + default settings, centered', () => {
        const plan = planAddNodeCreation('animate', CENTER);
        if (plan.kind !== 'add') throw new Error('expected add');
        expect(plan.node.type).toBe('animate');
        if (plan.node.type === 'animate') {
            expect(plan.node.data.prompt).toBe('');
        }
    });

    it('builds a modify node with default product_edit settings, centered', () => {
        const plan = planAddNodeCreation('modify', CENTER);
        if (plan.kind !== 'add') throw new Error('expected add');
        expect(plan.node.type).toBe('modify');
        if (plan.node.type === 'modify') {
            expect(plan.node.data.workflowId).toBe('product_edit');
            expect(plan.node.data.prompt).toBe('');
        }
    });

    it('builds a variate node with count 4 and empty prompt (T036 default)', () => {
        const plan = planAddNodeCreation('variate', CENTER);
        if (plan.kind !== 'add') throw new Error('expected add');
        expect(plan.node.type).toBe('variate');
        if (plan.node.type === 'variate') {
            expect(plan.node.data.count).toBe(4);
            expect(plan.node.data.prompt).toBe('');
        }
    });

    it('builds a new-view node with view null placeholder (FR-007)', () => {
        const plan = planAddNodeCreation('new-view', CENTER);
        if (plan.kind !== 'add') throw new Error('expected add');
        expect(plan.node.type).toBe('new-view');
        if (plan.node.type === 'new-view') {
            expect(plan.node.data.view).toBeNull();
            expect(plan.node.data.prompt).toBe('');
        }
    });

    it('builds an extract node with transparent background handling', () => {
        const plan = planAddNodeCreation('extract', CENTER);
        if (plan.kind !== 'add') throw new Error('expected add');
        expect(plan.node.type).toBe('extract');
        if (plan.node.type === 'extract') {
            expect(plan.node.data.backgroundHandling).toBe('transparent');
            expect(plan.node.data.prompt).toBe('');
        }
    });

    it('builds a section placeholder node with a default label', () => {
        const plan = planAddNodeCreation('section', CENTER);
        if (plan.kind !== 'add') throw new Error('expected add');
        expect(plan.node.type).toBe('section');
        if (plan.node.type === 'section') {
            expect(plan.node.data.label).toBeTruthy();
        }
    });
});

describe('planAddNodeCreation — exhaustiveness', () => {
    it('returns a plan for every non-legacy add-node kind', () => {
        const kinds: AddNodeKind[] = [
            'sketch', 'render', 'animate', 'modify', 'variate', 'extract',
            'new-view', 'text', 'note', 'section', 'media',
        ];
        for (const kind of kinds) {
            expect(planAddNodeCreation(kind, CENTER)).toBeTruthy();
        }
    });
});
