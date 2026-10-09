import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CSSProperties } from 'react';
import { NewViewNode } from './NewViewNode';
import { useStore } from '../../store/useStore';
import type { NewViewWorkbenchNode } from '@/types';

vi.mock('@xyflow/react', () => ({
    Handle: ({ style }: { style?: CSSProperties }) => <div data-testid="rf__handle" style={style} />,
    Position: { Left: 'left' },
    useConnection: () => ({ inProgress: false }),
}));

vi.mock('../../store/useStore');

const mockHandleGenerate = vi.fn();

vi.mock('./hooks/useNewViewNodeActions', () => ({
    useNewViewNodeActions: (id: string, data: { data?: { view?: string | null } }) => {
        const inbound = mockStore.connections.filter((c) => c.to === id);
        return {
            view: data.data?.view ?? null,
            isGenerating: false,
            isHoverConnectable: false,
            setIsHovered: () => undefined,
            referenceCount: inbound.length,
            handleGenerate: mockHandleGenerate,
        };
    },
}));

afterEach(cleanup);

const mockStore = {
    connections: [] as Array<{ id: string; from: string; to: string }>,
    workbenchNodes: [] as Array<Record<string, unknown>>,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockStore.connections = [];
    mockStore.workbenchNodes = [];
    vi.mocked(useStore).mockReturnValue(mockStore);
});

function makeNode(overrides: Partial<NewViewWorkbenchNode['data']> = {}, extra: Record<string, unknown> = {}): NewViewWorkbenchNode & Record<string, unknown> {
    return {
        id: 'newview-1',
        type: 'new-view',
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        data: { prompt: '', view: null, ...overrides },
        ...extra,
    };
}

function connectSource(sourceId = 'image-1') {
    mockStore.connections = [{ id: 'conn-1', from: sourceId, to: 'newview-1' }];
    mockStore.workbenchNodes = [
        { id: sourceId, type: 'image', project: { thumbnail: 'data:image/png;base64,abc' } },
    ];
}

describe('NewViewNode (spec 008 FR-005)', () => {
    it('renders the NodeCard header with a New View label', () => {
        render(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);

        expect(screen.getByRole('heading', { name: 'New View' })).toBeInTheDocument();
    });

    it('shows the "Select a view" placeholder as a clickable label when no view is chosen', () => {
        render(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);

        expect(screen.getByRole('button', { name: 'Select a view' })).toBeInTheDocument();
    });

    it('shows the chosen view name when set', () => {
        render(<NewViewNode id="newview-1" data={makeNode({ view: 'Rear' })} selected={false} />);

        expect(screen.getByRole('button', { name: 'Rear' })).toBeInTheDocument();
    });

    it('opens the view list with all named views when the label is clicked', () => {
        render(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);

        fireEvent.click(screen.getByRole('button', { name: 'Select a view' }));

        expect(screen.getByRole('listbox')).toBeInTheDocument();
        for (const name of [
            'Front',
            'Front Right 3/4 view',
            'Front Left 3/4 view',
            'Bottom Front Left 3/4 view',
            'Bottom Front Right 3/4 view',
            'Left',
            'Bottom Rear Left 3/4 view',
            'Rear Left 3/4 view',
            'Rear Right 3/4 view',
            'Top',
            'Rear',
            'Right',
            'Bottom',
            'Bottom Rear Right 3/4 view',
        ]) {
            expect(screen.getByRole('option', { name })).toBeInTheDocument();
        }
        // The ten cube-visible views come first; the four dropdown-only views sit below the separator.
        expect(screen.getByText('Hidden views')).toBeInTheDocument();
        const options = screen.getAllByRole('option').map((option) => option.textContent);
        expect(options.slice(10)).toEqual(['Rear', 'Right', 'Bottom', 'Bottom Rear Right 3/4 view']);
    });

    it('selecting a view persists it through onDataChange and closes the list', () => {
        const onDataChange = vi.fn();
        render(<NewViewNode id="newview-1" data={makeNode({}, { onDataChange })} selected={false} />);

        fireEvent.click(screen.getByRole('button', { name: 'Select a view' }));
        fireEvent.click(screen.getByRole('option', { name: 'Rear Right 3/4 view' }));

        expect(onDataChange).toHaveBeenCalledWith('newview-1', { view: 'Rear Right 3/4 view' });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('keeps Generate disabled until a view is selected and at least one reference is connected', () => {
        const { rerender } = render(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);
        expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();

        // View set, still no reference.
        rerender(<NewViewNode id="newview-1" data={makeNode({ view: 'Rear' })} selected={false} />);
        expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();

        // Reference connected, still no view.
        connectSource();
        rerender(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);
        expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });

    it('enables Generate once both prerequisites are met and calls handleGenerate', () => {
        connectSource();
        render(
            <NewViewNode
                id="newview-1"
                data={makeNode({ view: 'Rear' })}
                selected={false}
            />,
        );

        const generate = screen.getByRole('button', { name: 'Generate' });
        expect(generate).toBeEnabled();
        fireEvent.click(generate);

        expect(mockHandleGenerate).toHaveBeenCalledTimes(1);
    });

    it('renders an interactive cube with faces for Top/Front/Left and corner dots for the 3/4 views', () => {
        render(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);

        expect(screen.getByTestId('view-cube-top')).toBeInTheDocument();
        expect(screen.getByTestId('view-cube-front')).toBeInTheDocument();
        expect(screen.getByTestId('view-cube-left')).toBeInTheDocument();
        expect(screen.getByTestId('view-cube-front-left-3-4-view')).toBeInTheDocument();
        expect(screen.getByTestId('view-cube-rear-right-3-4-view')).toBeInTheDocument();
        expect(screen.getByTestId('view-cube-bottom-front-left-3-4-view')).toBeInTheDocument();
    });

    it('draws dotted wireframe edges between the cube corners', () => {
        render(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);

        const cube = screen.getByTestId('view-cube-top').closest('svg');
        expect(cube).not.toBeNull();
        if (!cube) return;
        const lines = cube.querySelectorAll('line');
        expect(lines).toHaveLength(12);
        for (const line of lines) {
            expect(line.getAttribute('stroke-dasharray')).toBe('2 4');
        }
    });

    it('selects a view when a cube face is clicked', () => {
        const onDataChange = vi.fn();
        render(<NewViewNode id="newview-1" data={makeNode({}, { onDataChange })} selected={false} />);

        fireEvent.click(screen.getByTestId('view-cube-top'));

        expect(onDataChange).toHaveBeenCalledWith('newview-1', { view: 'Top' });
    });

    it('selects a view when a cube corner is clicked', () => {
        const onDataChange = vi.fn();
        render(<NewViewNode id="newview-1" data={makeNode({}, { onDataChange })} selected={false} />);

        fireEvent.click(screen.getByTestId('view-cube-front-left-3-4-view'));

        expect(onDataChange).toHaveBeenCalledWith('newview-1', { view: 'Front Left 3/4 view' });
    });

    it('previews the hovered cube element in the dropdown label and clears the preview on leave', () => {
        render(<NewViewNode id="newview-1" data={makeNode()} selected={false} />);

        const corner = screen.getByTestId('view-cube-rear-left-3-4-view');
        fireEvent.mouseOver(corner);
        expect(screen.getByRole('button', { name: 'Rear Left 3/4 view' })).toBeInTheDocument();

        fireEvent.mouseOut(corner);
        expect(screen.getByRole('button', { name: 'Select a view' })).toBeInTheDocument();
    });

    it('keeps hidden views (Rear, Right, Bottom) off the cube but selectable from the dropdown list', () => {
        const onDataChange = vi.fn();
        render(<NewViewNode id="newview-1" data={makeNode({}, { onDataChange })} selected={false} />);

        expect(screen.queryByTestId('view-cube-rear')).not.toBeInTheDocument();
        expect(screen.queryByTestId('view-cube-right')).not.toBeInTheDocument();
        expect(screen.queryByTestId('view-cube-bottom')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Select a view' }));
        fireEvent.click(screen.getByRole('option', { name: 'Rear' }));

        expect(onDataChange).toHaveBeenCalledWith('newview-1', { view: 'Rear' });
    });
});
