import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { GenerationNodeMockup } from './GenerationNodeMockup';
import { MODIFY_PROMPT_TEMPLATES } from './GenerationModifyMode';
import { DEMO_REFERENCE_DATA_URL } from './demoReference';

/**
 * The mockup submits through the real render-task surface. In tests no image
 * backend is configured, so image-workflow submissions fail at the capability
 * check and video submissions (ComfyUI fallback) at the FR-021 benchmark gate —
 * both before any network or persistence, proving the wiring without side effects.
 */
const NO_BACKEND_ERROR = /no image backend is configured/i;
const GATE_ERROR = /benchmark gate/i;

// The mockup's saved-palette query (T030) needs a QueryClient; the app root
// provides one, so tests supply their own.
const mockupQueryClient = new QueryClient();
function MockupWrapper({ children }: { children?: ReactNode }) {
    return <QueryClientProvider client={mockupQueryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
    useStore.setState({
        renderReferences: [], renderTaskStatus: 'idle', renderTaskQueuePosition: null, renderTaskError: null,
        renderTaskOutputs: [], renderTaskExtraction: null, renderTaskId: null, renderRecordId: null, lastRenderRequest: null,
    });
});

describe('GenerationNodeMockup', () => {
    it('uses the Workbench node shell and shows the specified base actions', () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        const node = screen.getByRole('region', { name: 'Shared generation node' });
        expect(node).toHaveClass('w-[280px]', 'bg-viz-panel', 'border-2');
        const fieldButton = screen.getByRole('button', { name: 'Describe your changes' });
        expect(fieldButton).toBeEnabled();
        expect(fieldButton).toHaveClass('rounded-lg', 'px-2', 'bg-viz-selected', 'text-white');
        expect(screen.getByRole('button', { name: 'Instant Render' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Change expression' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Variate form and color' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'New view' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Extract' })).toBeEnabled();
    });

    it('derives the AI readiness indicator from compute settings (T031, spec edge case)', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        expect(screen.getByText('AI ready')).toBeInTheDocument();

        const previousSettings = useStore.getState().computeSettings;
        act(() => {
            useStore.setState((state) => ({ computeSettings: { ...state.computeSettings, protocol: 'openai-image', imageApiEndpoint: '' } }));
        });
        try {
            expect(await screen.findByText('AI not ready')).toBeInTheDocument();
        } finally {
            act(() => {
                useStore.setState({ computeSettings: previousSettings });
            });
        }
    });

    it('places the lamp reference as an image node connected to the generation node on the real canvas', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        const lamp = await screen.findByRole('img', { name: 'Arc Lamp' });
        expect(lamp).toHaveAttribute('src', DEMO_REFERENCE_DATA_URL);
        expect(screen.getByRole('region', { name: 'Shared generation node' })).toBeInTheDocument();
        // The lamp → generation edge is defined in GenerationLabCanvas; RF v12 does not
        // materialize edge DOM in jsdom (edges render only after real element measurement),
        // so connectivity is asserted through the nodes above.
    });

    it('renders result outputs as new image nodes created detached on the canvas (T032)', () => {
        useStore.setState({ renderTaskId: 'task-1', renderTaskStatus: 'completed', renderTaskOutputs: [{ id: 'o1', url: 'data:image/png;base64,eA==', seed: 7 }, { id: 'o2', url: 'data:image/png;base64,eQ==' }] });
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        // Each output lands as a new image node on the canvas, created detached — the
        // generate node has no outgoing edges (workbench logic; edge DOM is not asserted in jsdom).
        expect(screen.getAllByRole('img', { name: /^output/i })).toHaveLength(2);
    });

    it('creates output nodes immediately when a generate task is created, showing rendering status (workbench pattern)', () => {
        useStore.setState({
            renderTaskId: 'task-1',
            renderTaskStatus: 'queued',
            lastRenderRequest: { kind: 'form-variate', referenceImageId: 'ref-1', variationCount: 4 },
        });
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        // One placeholder image node per expected output lands on the canvas at task creation.
        expect(screen.getAllByText('Rendering...')).toHaveLength(4);
    });

    it('settles the immediate placeholder nodes with outputs when the task completes', () => {
        useStore.setState({
            renderTaskId: 'task-1',
            renderTaskStatus: 'queued',
            lastRenderRequest: { kind: 'form-variate', referenceImageId: 'ref-1', variationCount: 2 },
        });
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        expect(screen.getAllByText('Rendering...')).toHaveLength(2);

        act(() => {
            useStore.setState({
                renderTaskStatus: 'completed',
                renderTaskOutputs: [{ id: 'o1', url: 'data:image/png;base64,eA==' }, { id: 'o2', url: 'data:image/png;base64,eQ==' }],
            });
        });

        expect(screen.queryAllByText('Rendering...')).toHaveLength(0);
        expect(screen.getAllByRole('img', { name: /^output/i })).toHaveLength(2);
    });

    it('marks the placeholder nodes with the error when the task fails, and the issue in the top-right pill', () => {
        useStore.setState({
            renderTaskId: 'task-1',
            renderTaskStatus: 'active',
            lastRenderRequest: { kind: 'modify', prompt: 'make the base matte black', referenceImageId: 'ref-1' },
        });
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        expect(screen.getAllByText('Rendering...')).toHaveLength(1);

        act(() => {
            useStore.setState({ renderTaskStatus: 'failed', renderTaskError: 'The image backend returned no outputs.' });
        });

        // The new ImageNode shows its own error state…
        expect(screen.getByText('Generation failed')).toBeInTheDocument();
        // …and the top-right pill surfaces the issue with a retry action.
        const alerts = screen.getAllByRole('alert');
        expect(alerts.some((alert) => alert.textContent?.includes('The image backend returned no outputs.'))).toBe(true);
        // Workbench parity: both the failed node (shared retry registry) and the pill offer retry.
        expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(2);
    });

    it('moves advanced settings to a floating toolbar above the generate node, feeding the submitted request', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        // The toolbar shows only the settings icon; the panel stays hidden until clicked.
        const settingsIcon = screen.getByRole('button', { name: /advanced settings/i });
        expect(settingsIcon).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('region', { name: /advanced settings/i })).not.toBeInTheDocument();

        // Clicking the icon reveals the floating panel with the three power-user controls.
        fireEvent.click(settingsIcon);
        const steps = await screen.findByLabelText(/generation quality|steps/i);
        expect(screen.getByLabelText(/prompt adherence|guidance/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/reference resolution/i)).toBeInTheDocument();

        // The panel edits the shared advanced state, which flows into the submitted request.
        fireEvent.change(steps, { target: { value: '50' } });

        fireEvent.click(screen.getByRole('button', { name: 'Describe your changes' }));
        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });
        fireEvent.change(screen.getByPlaceholderText('Describe your changes'), { target: { value: 'Brushed aluminum housing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

        // The submission reaches the render-task surface (failing at the capability check in tests),
        // carrying the advanced values set from the floating toolbar.
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
        expect(useStore.getState().lastRenderRequest?.advanced).toEqual({ steps: 50, guidance: 4, referenceResolution: 1024 });
    });

    it('opens the Modify node from the prompt field button, keeps its label after going back, and still lets other actions transition', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        fireEvent.click(screen.getByRole('button', { name: 'Describe your changes' }));
        expect(await screen.findByRole('button', { name: /Aspect ratio 1:1/ })).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Describe your changes'), { target: { value: 'Brushed aluminum housing' } });
        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));

        const fieldButton = await screen.findByRole('button', { name: 'Describe your changes' });
        expect(fieldButton).toHaveTextContent('Describe your changes');

        fireEvent.click(fieldButton);
        expect(await screen.findByPlaceholderText('Describe your changes')).toHaveValue('Brushed aluminum housing');

        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'New view' }));
        expect(await screen.findByRole('heading', { name: 'New view' })).toBeInTheDocument();
    });

    it('morphs into the Modify edit panel as soon as the prompt field button is clicked, keeping focus on the prompt', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        fireEvent.click(screen.getByRole('button', { name: 'Describe your changes' }));

        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });
        const prompt = screen.getByPlaceholderText('Describe your changes');
        expect(prompt).toHaveFocus();
        // The connected reference sits in the prompt editor as a square thumbnail with its numbered badge (no name text).
        const chip = within(screen.getByLabelText('Prompt editor')).getByLabelText('Reference image 1');
        expect(within(chip).getByText('1')).toBeInTheDocument();
        expect(chip).not.toHaveTextContent('Arc Lamp');
        expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });

    it('numbers the reference chip and resolves @ mentions in the prompt to the numbered token', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });

        const chip = within(screen.getByLabelText('Prompt editor')).getByLabelText('Reference image 1');
        // Square thumbnail without name text; the numbered badge morphs into the remove x.
        expect(within(chip).getByText('1')).toBeInTheDocument();
        expect(chip).not.toHaveTextContent('Arc Lamp');
        expect(within(chip).getByRole('button', { name: /remove reference image/i })).toBeInTheDocument();

        const prompt = screen.getByPlaceholderText('Describe your changes') as HTMLTextAreaElement;
        expect(screen.queryByRole('listbox', { name: 'Reference suggestions' })).not.toBeInTheDocument();

        fireEvent.change(prompt, { target: { value: 'Use @' } });
        prompt.focus();
        const option = await screen.findByRole('option', { name: /Arc Lamp/ });
        fireEvent.mouseDown(option);
        expect(prompt).toHaveFocus();
        fireEvent.click(option);

        expect(prompt).toHaveValue('Use @1 ');
        await waitFor(() => expect(prompt).toHaveFocus());
        expect(prompt.selectionStart).toBe(prompt.value.length);
        expect(screen.queryByRole('listbox', { name: 'Reference suggestions' })).not.toBeInTheDocument();
    });

    it('ships the demo reference as a static public URL (not an inline base64 payload)', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        const reference = await waitFor(() => {
            const current = useStore.getState().renderReferences[0];
            expect(current).toBeDefined();
            return current;
        });
        // Served from /public so it is a small URL, not a multi-KB base64 string.
        expect(reference.dataUrl).toMatch(/^\/images\/.+\.png$/);
        expect(reference.dataUrl).not.toMatch(/^data:image\//);
    });

    it('attaches an uploaded photo as the primary reference', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        await screen.findByText('Replace with photo');

        const file = new File(['png-bytes'], 'product.png', { type: 'image/png' });
        fireEvent.change(screen.getByLabelText(/replace with photo/i), { target: { files: [file] } });

        await waitFor(() => {
            const references = useStore.getState().renderReferences;
            expect(references[0].name).toBe('product.png');
            expect(references[0].dataUrl).toMatch(/^data:image\/png;base64,/);
        });

        // The canvas image node follows the primary reference.
        await waitFor(() => {
            expect(screen.getByRole('img', { name: 'product.png' })).toHaveAttribute('src', 'data:image/png;base64,cG5nLWJ5dGVz');
        });
    });

    it('renders inserted references as blue blocks in the prompt and removes the whole token on backspace', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });

        const prompt = screen.getByPlaceholderText('Describe your changes') as HTMLTextAreaElement;
        fireEvent.change(prompt, { target: { value: 'Use @' } });
        fireEvent.click(await screen.findByRole('option', { name: /Arc Lamp/ }));
        expect(prompt).toHaveValue('Use @1 ');

        const block = screen.getByText('@1');
        expect(block).toHaveClass('rounded-full', 'bg-viz-accent', 'font-bold', 'text-white');

        prompt.selectionStart = 6;
        prompt.selectionEnd = 6;
        fireEvent.keyDown(prompt, { key: 'Backspace' });

        await waitFor(() => expect(prompt).toHaveValue('Use '));
        expect(screen.queryByText('@1')).not.toBeInTheDocument();
        await waitFor(() => expect(prompt.selectionStart).toBe(3));
    });

    it('shows Make/Change/Insert template chips that append a sentence starter and place the cursor at the end', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));
        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });

        expect(within(screen.getByLabelText('Prompt templates')).getAllByRole('button').map((chip) => chip.textContent?.trim()))
            .toEqual(MODIFY_PROMPT_TEMPLATES.map((template) => `${template.trim()}…`));

        const prompt = screen.getByPlaceholderText('Describe your changes') as HTMLTextAreaElement;
        fireEvent.change(prompt, { target: { value: 'the housing metallic' } });
        fireEvent.click(screen.getByRole('button', { name: 'Change…' }));

        expect(prompt).toHaveValue('the housing metallic Change ');
        await waitFor(() => expect(prompt).toHaveFocus());
        expect(prompt.selectionStart).toBe(prompt.value.length);
    });

    it('lists Modify and Animate actions with Animate below Modify, preserving the spec\'d base preset list', () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });

        const actions = screen.getByLabelText('Generation actions');
        const labels = within(actions).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
        expect(labels).toEqual(['Modify', 'Animate', 'Instant Render', 'Variate form and color', 'New view', 'Change expression', 'Extract']);
    });

    it('keeps the aspect ratio dropdown hidden until clicked, updates the chip, and survives a round trip to base', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));

        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Aspect ratio 1:1/ }));
        fireEvent.click(await screen.findByRole('option', { name: '3:4' }));
        expect(screen.getByRole('button', { name: /Aspect ratio 3:4/ })).toBeInTheDocument();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Modify' }));

        expect(await screen.findByRole('button', { name: /Aspect ratio 3:4/ })).toBeInTheDocument();
    });

    it('enables Generate once the modify prompt has text and submits the mock action', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Modify' }));

        await screen.findByRole('button', { name: /Aspect ratio 1:1/ });
        const generate = screen.getByRole('button', { name: 'Generate' });
        expect(generate).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Describe your changes'), { target: { value: 'Brushed aluminum housing' } });
        expect(generate).toBeEnabled();
        fireEvent.click(generate);

        // Real wiring: the submission reaches the render-task surface and fails at the capability check (no backend in tests).
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

        it('opens the Animate mode with its frames and settings body', async () => {
        // The FR-021 gate is opt-in now (default off); enable it explicitly so
        // this test pins the gate path instead of depending on the default.
        const previousSettings = useStore.getState().computeSettings;
        act(() => {
            useStore.setState((state) => ({ computeSettings: { ...state.computeSettings, benchmarkGateEnabled: true } }));
        });
        try {
            render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
            fireEvent.click(screen.getByRole('button', { name: 'Animate' }));

            expect(await screen.findByRole('heading', { name: 'Animate' })).toBeInTheDocument();
            expect(screen.getByText('Start')).toBeInTheDocument();
            expect(screen.getByText('End · optional')).toBeInTheDocument();

            // A motion description is required before the real submit is enabled.
            expect(screen.getByRole('button', { name: /^Animate$/i })).toBeDisabled();
            fireEvent.change(screen.getByPlaceholderText(/describe the motion/i), { target: { value: 'slow 360 turntable' } });

            fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'cinematic' } });
            fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '8s' } });
            fireEvent.click(screen.getByRole('button', { name: /^Animate$/i }));

            // Video passes the capability check via the ComfyUI fallback, then stops at the FR-021 benchmark gate.
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(GATE_ERROR));
        } finally {
            act(() => {
                useStore.setState({ computeSettings: previousSettings });
            });
        }
    });

    it('opens the minimal Instant Render form with its connected reference and animated generate action', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Instant Render' }));

        expect(await screen.findByRole('heading', { name: 'Instant Render' })).toBeInTheDocument();
        // The connected reference shows as an image only (no title), with a remove control.
        const region = screen.getByRole('region', { name: 'Shared generation node' });
        expect(within(region).queryByText('Arc Lamp')).not.toBeInTheDocument();
        expect(within(region).getByRole('button', { name: /remove reference image/i })).toBeInTheDocument();

        // The style selector replaces the prompt field; a connected reference enables Generate.
        const generate = screen.getByRole('button', { name: 'Generate' });
        expect(generate).toBeEnabled();
        expect(screen.getByRole('combobox', { name: /style/i })).toHaveValue('cinematic');
        fireEvent.change(screen.getByRole('combobox', { name: /style/i }), { target: { value: 'sketch' } });

        // FR-013: the seven aspect-ratio presets are offered.
        expect(screen.getByRole('combobox', { name: /aspect ratio/i })).toBeInTheDocument();
        fireEvent.click(generate);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
        // The submitted prompt carries the selected style layer from the legacy renderer registry.
        expect(useStore.getState().lastRenderRequest?.prompt).toContain('Style direction: A refined hand-drawn concept sketch');
    });

    it('preserves Variation form settings across base-state transitions', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Variate form and color' }));

        expect(await screen.findByRole('heading', { name: 'Variation' })).toBeInTheDocument();
        // Studio panel internals: pick a direction template, then edit an axis label (→ Custom), then nudge the knob.
        fireEvent.change(screen.getByLabelText('Preset'), { target: { value: 'Proportion' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tall' }));
        const labelInput = screen.getByDisplayValue('Tall');
        fireEvent.change(labelInput, { target: { value: 'Soft' } });
        fireEvent.blur(labelInput);
        fireEvent.keyDown(screen.getByRole('slider', { name: 'Form variation position' }), { key: 'ArrowRight' });
        expect(screen.getByText('Position: 75, 50')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Variate form and color' }));

        expect(await screen.findByRole('button', { name: 'Soft' })).toBeInTheDocument();
        expect(screen.getByLabelText('Preset')).toHaveValue('Custom');
        expect(screen.getByRole('slider', { name: 'Form variation position' })).toHaveAttribute('aria-valuenow', '75');
        fireEvent.click(screen.getByRole('button', { name: 'Reset to center' }));
        expect(screen.getByText('Position: 50, 50')).toBeInTheDocument();
    });

    it('preserves Variation color palette changes when switching to and from the base state', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Variate form and color' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Color' }));
        // Studio panel internals: hex swatch strip with add/remove + named presets.
        fireEvent.click(screen.getByRole('button', { name: 'Add palette color' }));
        fireEvent.change(screen.getByLabelText('Colorways'), { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Back to actions' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Variate form and color' }));

        expect(await screen.findByRole('button', { name: 'Color' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('Colorways')).toHaveValue('2');
        expect(screen.getAllByRole('button', { name: /edit palette color/i })).toHaveLength(5);
    });

    it('requires a selected view before allowing New view generation', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'New view' }));

        expect(await screen.findByRole('heading', { name: 'New view' })).toBeInTheDocument();
        // The connected reference shows as a square thumbnail with the numbered badge → remove x.
        expect(screen.getByRole('button', { name: /remove reference image/i })).toBeInTheDocument();
        const generate = screen.getByRole('button', { name: 'Generate' });
        expect(generate).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Select a view' }));
        fireEvent.click(screen.getByRole('option', { name: 'Rear Right 3/4 view' }));
        expect(generate).toBeEnabled();

        fireEvent.click(generate);
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
    });

    it('runs Extract against the connected reference with type and sampling controls', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Extract' }));

        expect(await screen.findByRole('heading', { name: 'Extract' })).toBeInTheDocument();
        // The demo reference is connected, so extraction is immediately runnable.
        expect(screen.getByRole('button', { name: 'Update colors' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: 'Material' }));
        const action = screen.getByRole('button', { name: 'Extract material' });
        expect(action).toBeEnabled();
        fireEvent.change(screen.getByLabelText(/sample by/i), { target: { value: 'Region' } });
        fireEvent.click(action);

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(NO_BACKEND_ERROR));
    });

    it('reveals a plain-language mode description from the info control', async () => {
        render(<GenerationNodeMockup />, { wrapper: MockupWrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Extract' }));
        await screen.findByRole('heading', { name: 'Extract' });
        fireEvent.click(screen.getByRole('button', { name: 'About Extract' }));

        expect(screen.getByRole('tooltip')).toHaveTextContent('Sample color, material, or parts from a reference image.');
    });
});
