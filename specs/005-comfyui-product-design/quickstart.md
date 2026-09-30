# Quickstart: Product Design Workflows

## Prerequisites

- Node.js version defined by the repository and pnpm installed.
- Existing OpenViz development environment configured.
- A local ComfyUI endpoint with at least one compatible image workflow, or a configured hosted ComfyUI-compatible endpoint.
- Required model files installed according to the selected official model repository. Do not commit model weights.
- For local automatic tier tests, provide a configured hardware profile or run on a machine where capability detection is supported.

## Validation commands

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm test
pnpm run build
```

Run focused tests during development:

```bash
pnpm exec vitest src/services/ai/workflowRegistry.test.ts
pnpm exec vitest src/services/ai/executionTarget.test.ts
pnpm exec vitest src/services/ai/dependencyPreflight.test.ts
```

## Manual scenarios

1. Open the product workflow interface and confirm task choices for concept, edit, variant, sketch/CAD render, background, and animation.
2. Select `product_concept`, enter a product description, generate a batch, and select one output as a ProductReference.
3. Use `product_edit` with the selected reference, change only the material, and verify the source image, parameters, and output lineage are visible.
4. Upload a sketch or CAD screenshot, adjust structure strength, and run `sketch_to_render`.
5. Generate a material/color variant set and verify partial results are represented if one item fails.
6. Run a background/e-commerce workflow and verify output dimensions/aspect ratio are shown.
7. Run a Wan product animation from a completed hero image and verify video progress and terminal state.
8. Switch between local, hosted, and hybrid targets. Confirm automatic mode explains its model-tier decision and refuses a known-incompatible tier.
9. Remove a required checkpoint/custom node and run preflight. Confirm the job is not queued and missing dependencies are listed.
10. Disconnect the target, submit a job, and verify the request remains retryable with no loss of prompts or references.

## Expected evidence

- Registry tests prove each workflow has typed injection points and dependency metadata.
- Adapter tests prove all target modes normalize health, preflight, submission, status, cancellation, and outputs.
- Hardware selection tests prove compatible tier selection for 12–16 GB, 24 GB, 48 GB+, and unknown profiles.
- Component tests cover keyboard access, accessible labels, status announcements, errors, and output selection.
- Existing render-service tests remain green and existing presets retain their request behavior.

See [`data-model.md`](./data-model.md) and the contracts in [`contracts/`](./contracts/) for field and lifecycle details.
