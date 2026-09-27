import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// vitest runs without `globals:true`, so RTL's auto-cleanup is not registered;
// unmount explicitly between tests to avoid DOM accumulation.
afterEach(cleanup);

// T036 (US3): minimal NodeCard-shell components for the three new generation
// node types (data-model.md "WorkbenchNode (extended)"). Header icon + label
// only, body placeholder — full bodies land in US5. Creation defaults:
// variate count 2|4|8, new-view view null, extract backgroundHandling.

import { VariateNode } from './VariateNode';
import { NewViewNode } from './NewViewNode';
import { ExtractNode } from './ExtractNode';
import { SectionNode } from './SectionNode';
import type {
    VariateWorkbenchNode,
    NewViewWorkbenchNode,
    ExtractWorkbenchNode,
    SectionWorkbenchNode,
} from '@/types';

function makeVariateNode(overrides: Partial<VariateWorkbenchNode['data']> = {}): VariateWorkbenchNode {
    return {
        id: 'variate-1',
        type: 'variate',
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        data: { prompt: '', count: 4, varyMode: 'both', ...overrides },
    };
}

function makeNewViewNode(overrides: Partial<NewViewWorkbenchNode['data']> = {}): NewViewWorkbenchNode {
    return {
        id: 'newview-1',
        type: 'new-view',
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        data: { prompt: '', view: null, ...overrides },
    };
}

function makeExtractNode(overrides: Partial<ExtractWorkbenchNode['data']> = {}): ExtractWorkbenchNode {
    return {
        id: 'extract-1',
        type: 'extract',
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        data: { prompt: '', extractPrompt: undefined, backgroundHandling: 'transparent', ...overrides },
    };
}

function makeSectionNode(overrides: Partial<SectionWorkbenchNode['data']> = {}): SectionWorkbenchNode {
    return {
        id: 'section-1',
        type: 'section',
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        data: { label: 'Section', ...overrides },
    };
}

describe('VariateNode shell (T036)', () => {
    it('renders the NodeCard header with a Variate label and placeholder body', () => {
        render(<VariateNode id="variate-1" data={makeVariateNode()} selected={false} />);

        expect(screen.getByRole('heading', { name: 'Variate' })).toBeTruthy();
    });

    it('shows the default count of 4 in the collapsed summary', () => {
        render(<VariateNode id="variate-1" data={makeVariateNode()} selected={false} />);

        expect(screen.getByText(/4/)).toBeTruthy();
    });
});

describe('NewViewNode shell (T036)', () => {
    it('renders the NodeCard header with a New View label', () => {
        render(<NewViewNode id="newview-1" data={makeNewViewNode()} selected={false} />);

        expect(screen.getByRole('heading', { name: 'New View' })).toBeTruthy();
    });

    it('shows the "Select a view" placeholder when no view is chosen (FR-007)', () => {
        render(<NewViewNode id="newview-1" data={makeNewViewNode()} selected={false} />);

        expect(screen.getByText('Select a view')).toBeTruthy();
    });

    it('shows the chosen view name when set', () => {
        render(<NewViewNode id="newview-1" data={makeNewViewNode({ view: 'Rear' })} selected={false} />);

        expect(screen.getByText('Rear')).toBeTruthy();
    });
});

describe('ExtractNode shell (T036)', () => {
    it('renders the NodeCard header with an Extract label', () => {
        render(<ExtractNode id="extract-1" data={makeExtractNode()} selected={false} />);

        expect(screen.getByRole('heading', { name: 'Extract' })).toBeTruthy();
    });

    it('shows the background handling in the collapsed summary', () => {
        render(<ExtractNode id="extract-1" data={makeExtractNode({ backgroundHandling: 'keep' })} selected={false} />);

        expect(screen.getByText(/keep/i)).toBeTruthy();
    });
});

describe('SectionNode shell (T036)', () => {
    it('renders the NodeCard header with a Section label', () => {
        render(<SectionNode id="section-1" data={makeSectionNode()} selected={false} />);

        expect(screen.getByRole('heading', { name: 'Section' })).toBeTruthy();
    });

    it('shows the section label in the body, falling back to "Section"', () => {
        render(<SectionNode id="section-1" data={makeSectionNode({ label: 'Hero shots' })} selected={false} />);

        expect(screen.getByText('Hero shots')).toBeTruthy();
    });
});
