# Feature Specification: AI Render Task Parameters

**Feature Branch**: `012-ai-render-task-params`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Compact PRD — OpenViz AI Render Tasks: Models, Prompts & Parameters. Define the model, prompting strategy and generation parameters behind each OpenViz render task (Modify, Instant Render, Form Variate, Color Variate, New View, Animate, Expression, Extract). Principle: OpenViz exposes task-level controls; the backend translates them into model-specific parameters. Users should never need to understand diffusion steps, guidance, denoising strength or model-specific conditioning."

## Clarifications

### Session 2026-09-24

- Q: For Color Variate at MVP, should the user define colors per product component, or apply a whole-palette recoloring? → A: Palette-level at MVP — user picks a palette + number of colorways; backend distributes the palette across the product while preserving geometry; per-component mapping is a deferred enhancement (likely fed by Parts extraction).
- Q: Which power-user controls should the advanced panel expose at MVP? → A: Minimal set — seed (core, FR-004), generation quality/steps, prompt adherence, and reference resolution; mask, LoRA selection, control conditioning and upscale are deferred until core tasks are benchmarked.
- Q: Should benchmark validation (FR-021) be a launch gate for this feature, or an ongoing post-launch process? → A: Launch gate — the feature ships only after a benchmark set of at least 20 product images is reviewed per active task type and defaults are tuned to meet the success-criteria thresholds; tuning then continues post-launch.
- Q: When extraction completes, what should happen to the structured results? → A: Display + save as project asset — results render in the node and are saved as reusable project assets (palettes, material notes, part lists) referenceable by other tasks; direct auto-apply to other products is deferred.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit a Product Image Without Losing the Product (Priority: P1)

A designer has connected a product image (e.g., an arc lamp) to the generation node. They type a short, specific instruction — "make the base matte black" — and generate. The result shows exactly the requested change while the rest of the product (geometry, proportions, components, camera angle, lighting, background) is preserved. They can repeat with different instructions and control how closely the result follows the original via a reference-fidelity setting.

**Why this priority**: Modify is the most frequent day-to-day task in product visualization and the hardest to get right — over-editing destroys product identity, under-editing wastes generations. It is the trust anchor for every other generative task.

**Independent Test**: Connect one product image, enter a single-attribute change request, generate, and verify the output changes only the requested attribute while all other attributes remain visually intact. Deliverable value: reliable in-place product editing with no model knowledge required.

**Acceptance Scenarios**:

1. **Given** a connected product image, **when** the user submits a single-attribute change request (e.g., "make the base matte black"), **then** the generated result shows that attribute changed and all unspecified attributes (geometry, proportions, other components, camera, lighting, background) are preserved.
2. **Given** a Modify request, **when** the user lowers the reference-fidelity setting, **then** subsequent results stay closer to the original image; when they raise it, results deviate further — with a documented default that favors preservation for typical single-attribute edits.
3. **Given** a Modify request mentioning a specific connected reference (via @-mention), **when** generation runs, **then** the change is applied to the mentioned reference's product only.
4. **Given** an empty prompt, **when** the user attempts to generate, **then** generation is blocked with a clear inline indication that a description is required.

---

### User Story 2 - Create a New Scene Render From Prompt and Reference (Priority: P1)

A designer wants a fresh render of their product in a new environment — "the same lamp in a warm living room, three-quarter view, soft evening light." They write the scene description, choose an output aspect ratio, and generate. The product remains recognizable (correct geometry, proportions, key design details) while the surrounding scene is newly created.

**Why this priority**: Instant Render is the primary "create" path — it turns a reference plus words into marketing-ready imagery without manual 3D work. Together with Modify it covers the two core loops of the product.

**Independent Test**: With one connected reference, write a scene prompt, pick an aspect ratio, generate, and verify the output is a new scene that keeps the product recognizable at the chosen ratio.

**Acceptance Scenarios**:

1. **Given** a connected reference image and a scene description, **when** the user generates, **then** the result is a new image in the described environment with the product's recognizable geometry, proportions and key design details preserved.
2. **Given** an aspect-ratio choice (including portrait, landscape and square presets), **when** generation completes, **then** the output matches the selected ratio.
3. **Given** no reference connected, **when** the user opens Instant Render, **then** the mode indicates a reference image is required before generating.

---

### User Story 3 - Explore Form and Color Directions in Batches (Priority: P2)

A designer wants to explore alternatives before committing. In **Form** mode they steer how much and in which direction the product's shape should change (magnitude plus directional guidance, with presets such as balanced or more organic), and choose how many variations to produce (2, 4 or 8). In **Color** mode they define a palette and how many colorways to render. Every variation in a batch is visually distinct from the others while remaining the same product concept.

**Why this priority**: Batch exploration accelerates design iteration and differentiates OpenViz from single-shot prompt tools, but it depends on the Modify-quality preservation behavior already established in P1 tasks.

**Independent Test**: With one connected reference, run a form batch of 4 and a color batch of 2; verify each output is distinct from the others and still recognizably the same product (form) or identical geometry with only colors changed (color).

**Acceptance Scenarios**:

1. **Given** a connected product image, **when** the user requests N form variations (N ∈ {2, 4, 8}) with a direction and magnitude, **then** exactly N results are produced, each distinct from the others, each preserving the product's identity, functional structure and approximate proportions.
2. **Given** a connected product image and a color palette with M colorways requested, **when** the user generates, **then** M results are produced where geometry, construction, camera and lighting are unchanged and only colors change, using only colors from the specified palette.
3. **Given** a variation batch, **when** it completes, **then** no two outputs in the batch are duplicates of each other (each variation uses its own unique generation seed).
4. **Given** the user increases form-magnitude, **when** they generate again, **then** results show stronger geometric deviation while still remaining the same product category; at maximum magnitude the result must not become an unrecognizable redesign.

---

### User Story 4 - Generate a New Camera View of the Same Product (Priority: P2)

A designer has a render from one angle and needs the same product seen from another angle (e.g., front, three-quarter, top). They pick the target view from a view picker and generate. The result shows the chosen viewpoint with consistent geometry, materials and component count — no invented or missing parts.

**Why this priority**: Multi-angle product sheets are a standard deliverable; without re-photography or 3D authoring, AI new views remove the biggest time sink after initial renders.

**Independent Test**: With one connected reference, select a different named view, generate, and verify the output depicts the same product from the requested angle with consistent structure.

**Acceptance Scenarios**:

1. **Given** a connected reference image, **when** the user selects a target view and generates, **then** the result shows the product from that viewpoint with geometry, proportions, materials and component count preserved.
2. **Given** no view selected, **when** the user attempts to generate, **then** generation is blocked until a view is chosen.
3. **Given** a target view that reveals surfaces not visible in the reference (e.g., the back of the product), **when** generation completes, **then** newly revealed surfaces are plausible continuations of the existing design — consistent materials and construction, no new components invented.

---

### User Story 5 - Turn Stills Into a Short Product Video (Priority: P3)

A designer wants a short video (2–8 seconds) from their stills. They connect a start frame (already connected as reference), optionally an end frame, choose the duration, and describe what should move (product motion and/or camera motion — e.g., a slow 360° turntable). The generated video keeps the product's geometry, materials and identity stable throughout; no flickering, melting or duplicated parts.

**Why this priority**: Video is high-value for marketing output but depends on image-quality tasks being reliable first, and video generation cost/latency is highest — so it lands after the image tasks are proven.

**Independent Test**: With a connected start frame, request a 4-second turntable animation and verify the output is a stable video of the correct duration showing the described motion with no product deformation or flicker.

**Acceptance Scenarios**:

1. **Given** a connected start frame and a motion description (e.g., slow 360° turntable), **when** the user generates at a chosen duration, **then** the output video matches the requested duration and shows the described motion with stable product geometry, materials and identity across all frames.
2. **Given** an optional end frame connected, **when** generation runs, **then** the video transitions from the start frame toward the end frame; without an end frame, the system generates a plausible progression from the start frame alone.
3. **Given** any generated video, **when** it is reviewed, **then** it contains no product deformation, morphing, flickering, duplicated or disappearing components, and no unintended camera movement.

---

### User Story 6 - Extract Structured Product Data From an Image (Priority: P3)

A designer points the node at a reference image and extracts structured data instead of new pixels: **Color** (each component with its dominant color and approximate hex value), **Material** (per-component material category, finish, texture and reflectivity impression), or **Parts** (component names, roles and image regions). They choose whether to sample by object hierarchy or by image region. Results arrive as structured OpenViz data that can be reused elsewhere in the design (e.g., a palette applied to another product), with confidence indicated where the system is uncertain.

**Why this priority**: Extraction closes the loop — assets harvested from one render feed the next — but it is an analysis pipeline rather than generation, so it does not gate the core create/edit flows.

**Independent Test**: Attach a product image, run each of Color / Material / Parts extraction, and verify the outputs are structured records (component + color/hex, material attributes, or component + role + region) that exclude background content.

**Acceptance Scenarios**:

1. **Given** an attached product image, **when** the user extracts colors by hierarchy, **then** the result is a list of components each with a representative color, approximate hex value and confidence — background excluded.
2. **Given** an attached product image, **when** the user extracts materials, **then** each component report separates direct observations (finish, texture, reflectivity) from uncertain inferences.
3. **Given** an attached product image, **when** the user extracts parts, **then** each component is returned with a name, semantic role and image region, without arbitrary splitting of single physical components.
4. **Given** no image attached, **when** the user attempts extraction, **then** the action is disabled until an image is attached.

---

### Edge Cases

- **No reference connected**: every generation task that requires a source image (all except pure text-to-image) must show a clear "connect an image" state and block generation rather than failing mid-run.
- **Empty or over-long prompt**: empty prompts block generation; prompts beyond the editor limit (2000 characters) are truncated by the editor, never silently cut server-side.
- **Generation failure or timeout**: the user sees a task-level error with a retry action; partial batch results (e.g., 3 of 8 variations succeeded) are kept and labeled, not discarded wholesale.
- **Batch seed collision**: variation batches must never request multiple outputs with an identical seed; if a user locks a seed for reproducibility, that applies to single-output regeneration only.
- **Reference at unusual resolution/aspect**: the system normalizes reference preprocessing internally; the user's chosen output aspect ratio is honored without distortion of the product subject.
- **New view revealing unseen surfaces**: results must be plausible continuations (see User Story 4, scenario 3); if the model cannot reliably infer hidden geometry, the result should degrade to a conservative interpolation rather than inventing components.
- **Extraction on non-product or cluttered images**: extraction reports low confidence or explicitly flags background/ambiguous regions instead of fabricating components.
- **Video with start frame only**: progression must remain plausible and stable (no drift into unrelated content).
- **Model/backend unavailable**: tasks show an "AI not ready" state consistent with the workbench status indicator; queued user input is preserved for retry.

## Requirements *(mandatory)*

### Functional Requirements

**Cross-cutting control model**

- **FR-001**: The system MUST expose only task-level controls to users (prompt, aspect ratio, variation count, reference fidelity, duration, view selection, extraction type); all model-specific parameters (inference steps, guidance strength, denoising strength, conditioning details, resolution preprocessing) MUST be translated by the backend from those task-level controls.
- **FR-002**: The system MUST NOT expose runtime/model internals (quantization, offloading, memory mode, attention backend, caching, oversized-tensor allowances, model-specific flow/schedule settings, or dual-stage video guidance values) in any user-facing surface.
- **FR-003**: An advanced panel MUST expose exactly the following power-user controls at MVP: generation quality/steps, prompt adherence, and reference resolution (seed is a core control per FR-004, not advanced-panel-only). These MUST be clearly separated from the default task-level UI and MUST have safe defaults. Mask, LoRA selection, control conditioning and upscale are deferred (see Scope) and MUST NOT appear in the MVP UI.
- **FR-004**: Every generation task MUST support seed control: random by default, with the ability to lock a seed on a produced result for exact regeneration.

**Prompt strategy (backend behavior)**

- **FR-005**: For Modify, the backend prompt MUST describe only the requested change and explicitly instruct preservation of all unspecified attributes (geometry, proportions, components, camera, composition, lighting, background); a negative prompt MUST constrain against exactly those unauthorized changes.
- **FR-006**: For Instant Render, the backend prompt MUST structure the user's scene description into subject / environment / composition / camera / lighting / treatment and instruct preservation of the referenced product's recognizable geometry and key details; a negative prompt MUST guard against product distortion, missing/duplicated components, malformed surfaces and unwanted text/watermarks.
- **FR-007**: For Form Variate, the backend MUST implement variations as controlled edits (direction + magnitude + identity constraints), not free generation; results MUST remain the same product concept.
- **FR-008**: For Color Variate at MVP, the user selects a palette (set of swatches) and a colorway count; the backend prompt MUST instruct recoloring the product using only the specified palette while constraining geometry/material preservation. Per-component color assignment is out of MVP scope (see Scope); only specified palette colors MAY appear in results.
- **FR-009**: For New View, the backend prompt MUST name the target viewpoint explicitly and impose strong geometry/component-preservation constraints, including consistent continuation of surfaces newly revealed by the viewpoint.
- **FR-010**: For Animate, the backend prompt MUST describe only what changes over time (subject motion, camera motion, temporal progression) without re-describing the product's appearance; a negative prompt MUST suppress deformation, flicker, component duplication and unintended camera movement.
- **FR-011**: For Expression (deferred — see Scope), the backend prompt MUST target visual/mood transformation while preserving geometry, colors, materials and composition.

**Per-task behavior**

- **FR-012**: Modify MUST default to a reference-fidelity setting that favors strong source preservation for single-attribute edits; the fidelity range exposed to users MUST map monotonically to edit strength (lower = closer to source).
- **FR-013**: Instant Render MUST support at least the aspect-ratio presets 1:1, 4:3, 3:4, 16:9, 9:16, 3:2 and 2:3.
- **FR-014**: Variation batches MUST produce exactly the requested count (2, 4 or 8), each output generated with a unique seed so no two outputs are duplicates.
- **FR-015**: Form-variate magnitude (user-steered position/direction) MUST map to a bounded edit-strength range strong enough for visible geometric change but capped below full-redraw; presets MUST map to documented direction phrasings.
- **FR-016**: New View MUST require an explicit view selection before generation is enabled, and MUST count connected references (generation requires at least one).
- **FR-017**: Animate MUST accept a start frame (required) and end frame (optional), a duration choice mapped to frame count/frame rate by the backend, and MUST default all other video parameters to the selected model family's documented defaults.
- **FR-018**: Extract MUST produce structured data records (not generated pixels): color extraction returns component + representative color + approximate hex + confidence; material extraction returns per-component material attributes with observations separated from inferences; parts extraction returns component name + role + image region. Extraction MUST support sampling by hierarchy or by region and MUST exclude background content.
- **FR-023**: Completed extraction results MUST be displayed in the node AND saved as reusable project assets (palette, material notes, part list) that other tasks and nodes can reference. Automatically applying extracted data to other products (e.g., one-click palette transfer) is deferred; users reuse assets by explicit selection.
- **FR-019**: Every task MUST surface a machine-readable task record (task type, resolved parameters, seed, prompt used) so results are reproducible and auditable.
- **FR-022**: The system MUST enforce one active generation task per user; new submissions while a task is running are queued in submission order with visible queue position. Queued tasks MUST be cancellable before they start; running tasks MUST expose cancel where the backend supports it, producing a clearly labeled partial/aborted result rather than a silent failure.

**Model routing**

- **FR-020**: The backend MUST route tasks to model classes by capability: text-to-image generation for Instant Render; image-editing models for Modify, Form Variate, Color Variate, New View and (deferred) Expression; an image-to-video model family for Animate; and a vision/segmentation pipeline (no generative diffusion) for Extract.
- **FR-021**: Parameter defaults that are not documented by the model vendor MUST be treated as OpenViz starting values. A benchmark set of at least 20 diverse product images is a **launch gate**: before general availability, each active task type MUST be reviewed against this set and its defaults tuned until the success-criteria thresholds (SC-002, SC-003, SC-005, SC-006, SC-007) are met. Documented vendor defaults MUST be used where available. Benchmark tuning continues post-launch as an ongoing process.

### Key Entities

- **Render Task**: one generation request of a specific type (modify, instant-render, form-variate, color-variate, new-view, animate, extract); carries user-level controls, resolved backend parameters, seed, prompt(s) and status.
- **Reference Image**: a connected source image with an identity (number/name) usable in @-mentions; has resolution and aspect metadata used by preprocessing.
- **Generation Result**: an output artifact (image or video) linked to its task record; supports seed locking for regeneration.
- **Variation Batch**: an ordered set of generation results from one task, each with a unique seed.
- **Extraction Record**: structured per-component data (color/hex/confidence, material attributes, or name/role/region) produced by the analysis pipeline; persisted as a project asset reusable by other tasks.
- **Project Asset**: a saved, referenceable unit of design data (palette, material notes, part list) created from an Extraction Record.
- **View Definition**: a named camera viewpoint selectable in New View (e.g., front, three-quarter, top).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can complete a Modify request end-to-end (type change → generate → accept result) without ever seeing or setting a model-specific parameter; verified by task-completion testing with no advanced panel opened.
- **SC-002**: On the OpenViz product benchmark set, ≥ 80% of Modify results are rated as preserving all unspecified attributes by human review (single-attribute change requests only).
- **SC-003**: On the benchmark set, ≥ 80% of New View results are rated as geometrically consistent with the reference (no invented/missing components) for views adjacent to the source angle.
- **SC-004**: Every variation batch of N returns exactly N visually distinct outputs; duplicate rate within a batch is 0% across 20 consecutive batches per task type.
- **SC-005**: ≥ 90% of Instant Render results match the requested aspect ratio exactly and keep the product recognizable (human-rated) on the benchmark set.
- **SC-006**: Animate outputs at each supported duration play at the requested length with zero instances of product deformation or component duplication in a 30-output review sample.
- **SC-007**: Extraction results on the benchmark set achieve ≥ 90% component-level accuracy for color (hex within perceptual tolerance) and parts identification, with background content excluded in 100% of records.
- **SC-008**: Any produced result can be regenerated exactly (same seed + same inputs → visually identical output) — verified on all image tasks.
- **SC-009**: Time from task submission to visible progress feedback is under 2 seconds for every task type; failed tasks surface a retryable error within the session rather than silently dropping.
- **SC-010**: Launch gate — before general availability, every active task type has completed benchmark review on a set of ≥ 20 diverse product images with defaults tuned to meet SC-002/SC-003/SC-005/SC-006/SC-007; no task type ships on unvalidated starting values.

## Assumptions

- A backend inference service capable of serving text-to-image, image-editing, image-to-video and vision/segmentation workloads is available (or being delivered in parallel); this feature defines OpenViz's contract with it, not the service itself.
- Specific model selections named in the PRD (current-generation Qwen image edit / text-to-image models; Wan2.2 or LTX-class video models) are implementation choices for the planning phase; the spec binds behavior, not vendor model names.
- Parameter ranges cited in the PRD (e.g., edit-strength bands per task) are OpenViz starting values, not vendor-documented optimums; benchmark validation on ≥ 20 product images is a launch gate per task type (FR-021, SC-010 — confirmed in Clarifications, 2026-09-24).
- **Expression mode is deferred**: it remains a visible-but-disabled ("Soon") option in the UI until product-drift validation passes; its prompt strategy is specified (FR-011) so implementation can begin immediately after un-deferral.
- OpenViz does not yet own authoritative 3D geometry for products at this stage; AI new views are the primary path. If real 3D assets are introduced later, a renderer-based new view becomes preferred and AI becomes the fallback (tracked as a future concern, out of scope here).
- Color Variate at MVP uses palette-level prompting (confirmed in Clarifications, 2026-09-24); per-component color assignment (potentially fed by Parts extraction) is a deferred enhancement, not an MVP requirement.
- Single connected reference per task is the MVP shape (matching the current node mockup); multi-reference conditioning is out of scope for this feature.
- The existing generation-lab mockup interactions (prompt editor with @-mentions, template chips, view picker, form-morph slider, palette swatches, extraction segmented control) are the reference UI; this feature makes them real against the backend rather than status-message stubs.

## Scope

**In scope**: task-level control model and backend parameter translation for Modify, Instant Render, Form Variate, Color Variate, New View, Animate and Extract; prompt/negative-prompt strategies per task; seed and reproducibility behavior; structured extraction outputs; benchmarking contract for non-documented defaults.

**Out of scope**: Expression mode activation (deferred); per-component color assignment in Color Variate (deferred enhancement, likely fed by Parts extraction); 3D-renderer-based new views; multi-reference conditioning; advanced-panel controls beyond the MVP set — mask editing, LoRA selection, control conditioning, upscale (deferred per FR-003; fine-tuning/LoRA authoring is excluded entirely); auto-apply of extracted data to other products (e.g., one-click palette transfer — reuse is by explicit selection per FR-023); billing/queue economics; the inference service implementation itself.
