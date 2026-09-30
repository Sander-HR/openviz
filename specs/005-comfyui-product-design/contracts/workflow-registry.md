# Workflow Registry Contract

The registry exposes typed task workflows to the UI and execution adapters.

Required operations:

- `listWorkflows(filters?)` returns workflow metadata, supported model families, capabilities, and dependency summary.
- `getWorkflow(id, version?)` returns a versioned workflow definition.
- `validateInputs(workflow, inputs)` returns typed field errors without queuing.
- `buildPrompt(workflow, inputs, selection)` returns a ComfyUI API-format prompt with validated injection points.

Every definition must identify prompt, seed, reference, mask, output, and progress nodes where applicable. A workflow must not depend on UI components mutating arbitrary JSON paths.
