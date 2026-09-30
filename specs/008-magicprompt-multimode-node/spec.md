# Feature Specification: Shared Multi-Mode Generation Node

**Feature Branch**: `008-single-shared-magicprompt`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "following the above chat" — replace the separate Variate / New view / Extract node types with a single shared generation node that has a base state (action/preset list) and specialized modes, with header-chevron back-navigation that preserves mode configuration. Behavior verified against the live Vizcom Workbench reference during the 006 ui-translation review. Extended 2026-09-29: studio's separate prompt panels are unified onto the same single shared generation panel — identical UI, one place to edit forms.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick what my generation node does (Priority: P1)

A designer adds a generation node to the workbench canvas. It opens in a base state showing a prompt field ("Describe your changes") and a list of actions: Instant Render, Variate form and color, New view, Change expression, Extract. The designer picks an action and the node transforms in place into that specialized mode, showing the mode's dedicated controls and a header with a back chevron, a type icon, and the mode name.

**Why this priority**: This is the core interaction model of the feature. Without the base state + preset list + transition, none of the generation capabilities are reachable through the new single-node model. It is the minimum viable slice: one node type that can become any generation action.

**Independent Test**: Add a "Modify" node to an empty workbench, verify it renders the prompt field and the five-action preset list, connect a source image, click "Variate form and color", and verify the node now shows the Variation body (Form/Color switch) with a header labeled "Variation" including a back chevron.

**Acceptance Scenarios**:

1. **Given** an empty workbench, **When** I add a "Modify" node, **Then** it appears in the base state with a "Describe your changes" prompt field and a preset list containing Instant Render, Variate form and color, New view, Change expression, and Extract.
2. **Given** a generation node in the base state with one source image connected, **When** I select "Variate form and color", **Then** the node transitions to Variation mode showing the Form/Color submode switch and a header labeled "Variation" with a back chevron and type icon.
3. **Given** a generation node in the base state, **When** I select "New view", **Then** the node shows the New view body with a "Select a view" label, a reference-count badge, and a disabled Generate button.
4. **Given** a generation node in the base state, **When** I select "Extract", **Then** the node shows the Extract body with Color/Material/Parts controls, a "Sample by" selector, an image-attach drop zone, and an action button labeled "Update colors".

---

### User Story 2 - Go back without losing my setup (Priority: P2)

A designer configures a specialized mode (e.g., sets the four axis labels and drags the center position in Variation Form mode), then clicks the node header — the chevron area — to return to the base state, perhaps to edit the prompt or choose a different action. Later they re-enter the same mode and every value is exactly as they left it. The transition back is lossless in both directions.

**Why this priority**: Back-navigation is what makes the single-node model usable instead of destructive. Users must be able to explore, compare, and change actions without re-entering configuration. This is the behavior that distinguishes "modes of one node" from "separate nodes".

**Independent Test**: In Variation Form mode, set all four axis labels to custom values, drag the center handle off-center, choose a preset; click the header chevron; verify the base state renders; select "Variate form and color" again; verify every value (axis labels, center position, preset) is restored exactly.

**Acceptance Scenarios**:

1. **Given** a node in Variation Form mode with custom axis labels and an off-center position handle, **When** I click the header (chevron area), **Then** the node returns to the base state showing the prompt field and preset list.
2. **Given** a node that just returned to the base state, **When** I select "Variate form and color" again, **Then** Variation mode reopens with all prior values — axis labels, center position, selected preset — restored exactly.
3. **Given** a node in New view mode with a view selected, **When** I return to the base state and re-enter New view, **Then** the previously selected view is still selected.
4. **Given** a node in any specialized mode, **When** I click the header chevron, **Then** no configuration of that mode is discarded or reset.

---

### User Story 3 - One generation panel in Studio (Priority: P2)

A designer works in the studio, where the workflow tabs (image generate, modify, variation) currently each show their own separate prompt form and settings panel. After this feature, every one of those panels looks and behaves exactly as before — same fields, labels, order, and disabled states — but they are all rendered by a single shared generation panel. Form fields, settings rows, and action buttons are defined in one place, so any future edit to a form is made once and appears consistently in every workflow tab.

**Why this priority**: The workbench node (User Stories 1–2) establishes the base-state-plus-modes model; the studio is the second surface where the same generation forms are duplicated across separate panels. Unifying the studio onto one shared panel with an unchanged UI delivers the maintainability win — a single entry point for editing forms — without any user-visible change, so it does not block the node work but should land alongside it.

**Independent Test**: Open each of the image generate, modify, and variation workflow tabs in the studio and confirm each panel is visually and behaviorally identical to its pre-unification form (fields, labels, order, disabled states, generate flow); then confirm all three render through the one shared generation panel, with per-workflow differences driven by the same action/mode configuration used by the workbench node.

**Acceptance Scenarios**:

1. **Given** the image generate workflow tab, **When** I open it, **Then** the panel shows exactly the prompt field, style/influence/image-count controls, and generate button it showed before unification — no added, removed, or reordered elements.
2. **Given** the modify workflow tab with its actions (instant render, new view, variate form and color), **When** I switch between actions, **Then** each action's controls are identical to before unification, rendered from the shared panel rather than a separate per-action form.
3. **Given** the variation workflow tab, **When** I open it, **Then** its form/color mode switch, axis labels, palette, and presets render exactly as before unification.
4. **Given** all three workflow tabs share one generation panel, **When** a form field definition is changed in the shared panel, **Then** the change appears consistently in every tab that displays that field — no per-tab copy needs updating.
5. **Given** any workflow tab, **When** I compare it against its pre-unification behavior (covered by the existing unmodified panel tests), **Then** there is no visible or behavioral difference: same labels, same field order, same disabled states, same results flow.

---

### User Story 4 - Full controls in each mode (Priority: P3)

Each specialized mode offers its complete set of controls matching the reference product: Variation's Form morph grid (editable axis labels, draggable center handle, reset, presets) and Color palette (swatches, add-swatch, palette name, count); New view's clickable view label with reference badge; Extract's type switch, sample-by selector, and attach flow. Action buttons enable only when each mode's prerequisites are met.

**Why this priority**: Full per-mode fidelity completes parity with the reference. The transition model (P1/P2) delivers the architectural value first; mode bodies can be completed incrementally without changing the model.

**Independent Test**: For each of the three modes, verify every control renders and is editable, that "Reset to center" restores the default position in Form mode, that adding a swatch appears in the Color palette, that Generate enables only when view + reference are present in New view mode, and that the Extract action button label tracks the active extract type.

**Acceptance Scenarios**:

1. **Given** Variation Form mode, **When** I edit any axis label or drag the center handle, **Then** the change is reflected immediately, and **When** I press "Reset to center", **Then** the handle returns to the grid center.
2. **Given** Variation Color mode, **When** I use the add-swatch control, **Then** a new swatch appears in the palette row and the count selector remains available.
3. **Given** New view mode with one reference image connected and no view selected, **When** I select a view via the view label, **Then** the Generate button becomes enabled and the reference badge shows "1".
4. **Given** Extract mode in Color type, **When** I switch to Material, **Then** the body updates to material controls and the action button label changes accordingly (e.g., away from "Update colors").

---

### Edge Cases

- **Base-state header is not a back control**: the base state has no chevron; clicking its header does nothing (it is not navigable). Only specialized-mode headers act as back controls.
- **Prerequisites lost while in a mode**: if the source image is disconnected while a node sits in a specialized mode, the action button re-disables, the node stays in that mode, and all mode configuration is preserved until a source is connected again.
- **Replacing the source image**: the node exposes exactly one input handle; connecting a different image replaces the current source. Mode configuration is preserved across the replacement.
- **Legacy saved workbenches**: workbenches saved with the old separate Variate / New view / Extract node types open with each such node rendered as the shared node in its corresponding mode, with prior configuration mapped and intact.
- **Unimplemented preset entries**: "Instant Render" and "Change expression" appear in the preset list for parity but are disabled in v1; they cannot be selected and show a disabled affordance.
- **Studio tab switching must not lose form state**: switching workflow tabs and returning MUST restore each panel's form values, settings, and collapsed/expanded state exactly as before — the shared panel preserves per-workflow configuration the same way the node preserves per-mode configuration.
- **Non-prompt workflows stay separate**: the make-3d and adjust workflow panels are not prompt-driven generation forms; they remain their own panels in v1 and are outside the unification scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The workbench MUST provide a single shared generation node type that replaces the separate Variate, New view, and Extract node types; the add-node menu's "Modify" entry creates it in the base state.
- **FR-002**: In the base state, the node MUST display an editable prompt field with the placeholder "Describe your changes" and a preset list containing at least: Instant Render, Variate form and color, New view, Change expression, Extract.
- **FR-003**: Selecting "Variate form and color" MUST transition the node to Variation mode; the header MUST show a back chevron, a type icon, and the label "Variation".
- **FR-004**: Variation mode MUST provide a Form/Color submode switch. Form mode MUST show a 2×2 morph grid with four editable axis labels (Top, Bottom, Left, Right), a draggable center position handle, a "Reset to center" action, and a Presets selector. Color mode MUST show a palette swatch row with an add-swatch control, a palette name field, and a count selector.
- **FR-005**: Selecting "New view" MUST transition the node to New view mode; the body MUST show a clickable view label (default "Select a view"), a reference-count badge reflecting connected references, and a Generate button disabled until a view is selected and at least one reference image is connected.
- **FR-006**: Selecting "Extract" MUST transition the node to Extract mode with a Color/Material/Parts segmented control, a "Sample by" selector (default Hierarchy), and an image-attach drop zone; the action button label MUST reflect the active extract type (e.g., "Update colors" for Color).
- **FR-007**: Clicking the header of a specialized mode (the chevron area) MUST return the node to the base state.
- **FR-008**: Mode transitions MUST be lossless: after returning to the base state and re-entering a mode, all of that mode's prior configuration values MUST be restored exactly.
- **FR-009**: The shared generation node MUST accept exactly one input connection (a single source image); no second input handle is exposed.
- **FR-010**: Each mode's action button (Generate / Update colors) MUST be disabled until that mode's prerequisites are met (source connected and the mode's required configuration set).
- **FR-011**: Nodes saved in earlier versions as separate Variate, New view, or Extract types MUST open in the corresponding specialized mode of the shared node with their prior configuration intact.
- **FR-012**: The header of a specialized mode MUST include an info control that reveals a brief plain-language description of the current mode.
- **FR-013**: Mode changes and mode-configuration edits MUST participate in the workbench's existing undo/redo history as node property changes.
- **FR-014**: The studio MUST render the image generate, modify, and variation workflow panels through a single shared generation panel; per-workflow differences (which settings rows appear, which actions are available, action-button labels) MUST be driven by the same action/mode configuration model used by the workbench's shared generation node.
- **FR-015**: The visual and behavioral appearance of each studio workflow panel MUST remain unchanged after unification — same fields, labels, order, disabled states, and results flow; each panel's existing behavior tests MUST pass without modification.

### Key Entities

- **Generation Node**: the single shared canvas node. Attributes: position, current mode (base / Variation / New view / Extract), one source-image connection, output images, and a per-mode configuration store.
- **Mode Configuration**: the settings of one specialized mode, preserved across transitions to and from the base state. Variation: submode (Form/Color), axis labels, center position, selected preset, palette swatches, count. New view: selected view. Extract: extract type, sample-by setting, attached image.
- **Studio Generation Panel**: the single shared studio panel that renders the image generate, modify, and variation workflow views over the same action/mode configuration; it is the one place where generation form fields are defined.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A mode transition (base → mode, or mode → base via the chevron) completes in under 300 ms from click to fully rendered target state, with no intermediate blank or broken state visible.
- **SC-002**: 100% of configurable values in each implemented mode survive a round-trip through the base state unchanged (verified by setting every control, returning to base, re-entering the mode, and comparing each value).
- **SC-003**: All five generation actions are discoverable from the base-state preset list without tooltips or documentation — each is labeled with plain text.
- **SC-004**: The workbench exposes exactly one generation node type; no separate Variate / New view / Extract node types remain in the add-node menu or on the canvas.
- **SC-005**: 100% of existing saved workbenches containing legacy separate-type nodes open with every such node mapped to its corresponding mode and configuration, with no data loss.
- **SC-006**: 100% of the studio workflow panels (image generate, modify, variation) pass their pre-existing behavior tests without modification after unification — the UI is unchanged.
- **SC-007**: Every generation prompt form field is defined in exactly one shared panel component; zero duplicated field definitions remain across the three former separate panels.

## Assumptions

- v1 implements three specialized modes — Variation, New view, Extract — the ones verified against the reference product. "Instant Render" and "Change expression" appear in the preset list but are disabled until their bodies are specified separately.
- Actual image generation is handled by the workbench's existing generation pipeline; this feature covers the node's presentation, its mode state machine, and transitions. Enabled action buttons trigger the existing pipeline.
- Each generation node has exactly one source-image input, matching the verified reference behavior (no multi-input generation nodes).
- Legacy separate-type nodes map 1:1 to modes (Variate → Variation, New view → New view, Extract → Extract) with configuration preserved.
- Mode changes and configuration edits participate in the workbench's existing undo/redo as node property changes.
- The header info control shows a brief plain-language description of the current mode (reference shows an info affordance; its exact copy is not yet verified).
- The base-state prompt field is present for parity; how its text feeds the generation pipeline is out of scope for this feature.
- Studio unification covers the three prompt-driven generation workflows (image generate, modify, variation); make-3d and adjust remain separate panels in v1. The studio's per-workflow panel state (form values, settings, collapsed/expanded) is preserved across tab switches, matching current behavior.
