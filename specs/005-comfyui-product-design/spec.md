# Feature Specification: ComfyUI Product Design Workflows

**Feature Branch**: `005-comfyui-product-design`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User request: Implement the complete product-design interface using current ComfyUI model families, including all workflow categories, local and hosted execution, and automatic hardware-aware model tiers.

## Clarifications

### Session 2026-09-25

- Q: Should the OpenAI-compatible image endpoint (including its per-endpoint FIFO queue, 1–3 concurrency limit, and Unsloth progress/cancel integration) be formally in scope for this feature specification? → A: Yes — fully in scope, including the endpoint concurrency setting exposed in the Settings → AI & Compute UI.

## User Scenarios & Testing

### User Story 1 - Generate product concepts (Priority: P1)

A designer describes a product and generates a batch of industrial-design concepts, then selects one as the working reference.

**Independent Test**: Enter a structured product prompt, choose a batch size, run the concept workflow, and verify that generated images appear with usable metadata and can be selected as a reference.

**Acceptance Scenarios**:

1. **Given** a connected ComfyUI execution target, **when** a designer submits a concept prompt, **then** the interface shows queued, running, completed, and failed states without blocking other UI actions.
2. **Given** a completed batch, **when** the designer selects an image, **then** it becomes the reference for subsequent product-edit workflows.
3. **Given** an unavailable model tier, **when** the workflow is submitted, **then** the UI explains the missing model/dependency and offers an appropriate lower tier or hosted target.

### User Story 2 - Iterate on a reference product (Priority: P1)

A designer uploads or selects a product render, changes one design variable such as material, color, trim, or lighting, and receives a revised image while preserving the product identity.

**Independent Test**: Select a reference image, choose a change operation, submit it, and verify the output retains the requested fixed attributes while reflecting the requested change.

**Acceptance Scenarios**:

1. **Given** a reference product, **when** the designer requests a material change, **then** the workflow preserves the silhouette, camera angle, controls, and proportions unless explicitly asked otherwise.
2. **Given** a masked region, **when** the designer edits it, **then** changes remain constrained to the selected region where the selected workflow supports masking.
3. **Given** an edit failure, **when** the result is unavailable, **then** the original reference and prompt remain intact and the user can retry or choose another target.

### User Story 3 - Convert sketches or CAD screenshots to renders (Priority: P1)

A designer uses a sketch, line drawing, or CAD screenshot to generate a realistic product visualization with adjustable geometry adherence.

**Independent Test**: Upload a supported input, adjust structure strength, generate an output, and verify the input is preserved in project history and the output is linked to it.

**Acceptance Scenarios**:

1. **Given** a supported sketch or CAD screenshot, **when** the designer selects sketch-to-render and submits it, **then** the generated output retains the source reference and selected structure-strength setting.
2. **Given** an annotated source image, **when** the designer submits a masked or annotated edit, **then** the output request contains the annotation/mask and the UI identifies the affected region.
3. **Given** an unsupported file or invalid aspect ratio, **when** the designer submits it, **then** validation prevents queueing and explains how to correct the input.

### User Story 4 - Produce variants and marketing imagery (Priority: P2)

A designer creates material/color contact sheets, white-background catalog images, lifestyle scenes, and aspect-ratio variants from a selected product.

**Independent Test**: Run a material-study or background workflow and verify all requested variants, output dimensions, and source-reference links are available.

**Acceptance Scenarios**:

1. **Given** a selected product reference, **when** the designer requests material or color variants, **then** the UI groups outputs into one variant set with the requested variable and source reference.
2. **Given** a batch where one output fails, **when** the remaining outputs complete, **then** the variant set is marked partial and provides retry for the failed item without losing successful outputs.
3. **Given** a marketing aspect ratio, **when** the designer requests a background or catalog image, **then** the output dimensions and source lineage are displayed before it is added to the Workbench.

### User Story 5 - Animate a selected product (Priority: P2)

A designer turns a selected product image into a short turntable, camera move, or keyframe transition using a product-aware video workflow.

**Independent Test**: Select a completed hero image, choose motion settings, generate a video, and verify the result is associated with the source image and exposes progress/error states.

**Acceptance Scenarios**:

1. **Given** a completed product hero image, **when** the designer chooses a motion preset and submits it, **then** the video job retains the source image and exposes progress.
2. **Given** a Wan workflow that exceeds the selected target capability, **when** the designer submits it, **then** preflight offers a compatible tier or hosted target before queueing.
3. **Given** a running animation, **when** the designer cancels it or the target fails, **then** the UI shows a terminal cancelled/failed state and preserves the retryable inputs.

### User Story 6 - Choose execution and model tier automatically (Priority: P1)

A designer can use local ComfyUI, a hosted GPU target, or a hybrid fallback without needing to understand checkpoint filenames or VRAM requirements.

**Independent Test**: Configure each target mode and hardware profile, then verify the interface selects compatible model variants and reports why a selection was made.

**Acceptance Scenarios**:

1. **Given** local ComfyUI is reachable, **when** automatic mode is selected, **then** the system prefers the local compatible model tier.
2. **Given** local hardware is insufficient or unavailable, **when** hosted fallback is enabled, **then** the request is routed to the configured hosted target.
3. **Given** both local and hosted targets are unavailable, **when** a request is submitted, **then** the system fails clearly without losing the job parameters.

## Edge Cases

- A workflow references missing custom nodes or model files.
- A model is incompatible with the selected quantization or hardware tier.
- A user submits while the ComfyUI queue is busy or disconnected.
- A reference image is too small, unsupported, or has an invalid aspect ratio.
- A product-edit prompt requests both preservation and contradictory geometry changes.
- A batch partially succeeds.
- A video workflow exceeds available memory or times out.
- Hosted execution credentials are absent or expired.
- A generated image contains unwanted text or changes product identity.
- The user changes target settings while a job is running.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide task-oriented workflows for product concepts, reference edits, material/color studies, sketch/CAD-to-render, e-commerce/background generation, and product animation.
- **FR-002**: The system MUST keep prompts, references, masks, model selections, seeds, workflow versions, and outputs associated with each generation job.
- **FR-003**: The system MUST support Qwen Image 2.1, Qwen Image Edit 2511, FLUX.1 Kontext-dev, and Wan 2.2 workflow families where the configured execution target supports them.
- **FR-004**: The system MUST support local ComfyUI execution, hosted GPU execution, and hybrid fallback through an execution-target abstraction.
- **FR-005**: The system MUST select compatible model quantization/tier based on detected or configured hardware capability and explain the selection.
- **FR-006**: The system MUST preserve the source reference for reference-driven workflows and expose configurable structure/edit strength.
- **FR-007**: The system MUST support batch generation and variant grids for concept and product-study workflows.
- **FR-008**: The system MUST expose job lifecycle states including queued, running, completed, partially completed, cancelled, and failed.
- **FR-009**: The system MUST retain failed job inputs so users can retry without reconstructing the request.
- **FR-010**: The system MUST validate workflow dependencies before submission and identify missing checkpoints, LoRAs, VAEs, text encoders, and custom nodes.
- **FR-011**: The system MUST route all ComfyUI integration through services/hooks rather than UI components.
- **FR-012**: The system MUST preserve existing rendering workflows and existing single-image generation behavior during migration.
- **FR-013**: The system MUST provide accessible keyboard-operable controls, labels, status announcements, and error messages for the workflow interface.
- **FR-014**: The system MUST support output sizes and aspect ratios appropriate to product design and marketing use cases.
- **FR-015**: The system MUST never silently substitute an incompatible model; fallback choices require explicit configuration or a clearly surfaced automatic-mode decision.
- **FR-016**: The system MUST support an OpenAI-compatible image generation endpoint as an execution-protocol adapter alongside ComfyUI, accepting both `url` and base64 (`b64_json`) image outputs from the provider.
- **FR-017**: The system MUST queue media jobs per configured endpoint in FIFO order and limit simultaneous requests to a user-configurable integer between 1 and 3 (default 2); the setting MUST be exposed in Settings → AI & Compute and apply to all media jobs sharing that endpoint.

### Key Entities

- **Product workflow**: A versioned task graph with purpose, supported model families, dependency manifest, input contract, and adjustable parameters.
- **Execution target**: Local ComfyUI, hosted ComfyUI, hybrid target, or an OpenAI-compatible image endpoint adapter, each with endpoint, capabilities, authentication state, and health status.
- **Hardware profile**: Available VRAM, system memory, acceleration backend, and compatible precision/quantization tiers.
- **Generation job**: User request, workflow version, model tier, inputs, lifecycle state, progress, and outputs.
- **Product reference**: An image or render used as the identity source for later edits, variants, or animation.
- **Product variant set**: Group of outputs generated from one reference and a shared design-variable specification.
- **Workflow dependency**: Required checkpoint, diffusion model, text encoder, VAE, LoRA, ControlNet, or custom node with install/status metadata.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A designer can complete a first product concept generation in five or fewer primary interactions after opening the workflow interface.
- **SC-002**: In supported local and hosted configurations, at least 95% of valid workflow submissions reach a terminal state with an actionable result or error.
- **SC-003**: In reference-edit acceptance tests, 100% of submitted jobs retain and display their source reference and parameters.
- **SC-004**: Automatic tier selection chooses a compatible model configuration in 100% of tested hardware profiles and never submits a known-incompatible configuration.
- **SC-005**: Missing dependencies are identified before submission in 100% of dependency-fixture tests.
- **SC-006**: Existing render presets continue to pass their current tests and produce equivalent request payloads during the migration.
- **SC-007**: Keyboard and screen-reader behavior passes the project accessibility checks for the workflow picker, parameter form, job status, and output gallery.

## UX Decisions

- The frontend MUST closely reproduce the Vizcom-inspired visual language shown in the Modify documentation: dark rounded cards, compact node controls, purple primary actions, right-side Studio panels, thumbnail result grids, and image-plus-handle workflow creation, while retaining OpenViz branding.
- ComfyUI connection, hardware, model, and dependency configuration MUST live in Settings → AI & Compute. The Workbench MAY show only a compact health indicator; it MUST NOT become the primary compute-settings surface.
- Modify MUST be available both as a Workbench node created from an image source and as a Studio right-side panel.
- The first Modify release MUST include direct prompts with preservation instructions, `@` image references, red annotations and masks, aspect-ratio selection, and task/mode selection.
- Vizcom-style generation actions MUST support a prominent purple action button and keyboard submission while preserving accessible form semantics and multiline prompt editing.

## Assumptions

- ComfyUI remains the primary workflow execution protocol and workflow JSON remains the source format for backend graphs; an OpenAI-compatible image endpoint is supported as a provider adapter (FR-016), not a UI concern.
- The first release supports local ComfyUI, a configured hosted ComfyUI-compatible endpoint, hybrid fallback, and the OpenAI-compatible image endpoint adapter; provider-specific APIs are adapters, not UI concerns.
- The implementation is hardware-agnostic but requires either detected local capability or a user-configured hardware profile.
- Model licenses and commercial-use restrictions must be shown in dependency metadata; the application does not redistribute restricted model weights.
- Existing auth, project, image-upload, and generation persistence mechanisms are reused where possible; if they cannot store the required workflow lineage, a generated Drizzle migration and typed persistence service are added.
- Mobile layout is responsive but high-volume generation is primarily designed for desktop/tablet screens.
- Connection and hardware settings are intentionally not duplicated in every Modify node; node-level advanced controls may expose a non-default target/model override without becoming the primary settings location.
- Exact product geometry cannot be guaranteed by generative models; the UI exposes preservation controls and communicates that limitation.
