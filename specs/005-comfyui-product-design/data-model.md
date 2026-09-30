# Data Model: ComfyUI Product Design Workflows

## ProductWorkflow

A versioned task-oriented graph definition.

| Field | Type | Rules |
|---|---|---|
| id | string | Stable registry ID; required |
| name | string | User-facing label; required |
| category | enum | concept, edit, variant, render, background, animation |
| version | string | Required and changes when graph contract changes |
| type | enum | image or video |
| supportedFamilies | ModelFamily[] | At least one |
| inputs | WorkflowInput[] | Typed input contract |
| dependencies | WorkflowDependency[] | Required and optional dependencies |
| template | ComfyPrompt | Typed prompt graph; no unvalidated dynamic values |
| capabilities | WorkflowCapabilities | Input, resolution, batch, mask, and video requirements |

## ExecutionTarget

| Field | Type | Rules |
|---|---|---|
| id | string | Stable local/hosted target ID |
| kind | enum | local, hosted, hybrid |
| endpoint | URL | Must use configured allowed protocol/host |
| capabilities | TargetCapabilities | Refreshed by health/preflight check |
| authState | enum | unknown, valid, missing, expired, invalid |
| status | enum | unknown, checking, ready, degraded, unavailable |

## HardwareProfile

| Field | Type | Rules |
|---|---|---|
| vramMb | number/null | Non-negative when present |
| systemMemoryMb | number/null | Non-negative when present |
| backend | enum | cuda, rocm, metal, cpu, cloud, unknown |
| supportedPrecisions | Precision[] | Used in compatibility checks |
| source | enum | detected, configured, hosted-capability |

## GenerationJob

| Field | Type | Rules |
|---|---|---|
| id | string | Server/client correlation ID |
| projectId | string | Existing project reference |
| workflowId/version | string | Must resolve in registry |
| targetId | string | Target selected for the job |
| modelTier | enum | bf16, fp8, int8, gguf, hosted-auto |
| prompt/negativePrompt | string | Prompt is required for generation |
| references | ReferenceInput[] | Required for edit/animation workflows |
| mask | AssetReference/null | Optional; required by masked operations |
| parameters | JSON-safe typed object | Validated against workflow input schema |
| seed | number/null | Optional; persisted when assigned |
| status | enum | queued, running, completed, partial, cancelled, failed |
| progress | number | 0–100 |
| outputs | GenerationOutput[] | Empty until result; partial allowed |
| error | JobError/null | Preserves retryable failure details |
| createdAt/updatedAt | timestamp | Required |

## ProductReference

A selected input or output used as the identity source for later work.

- `assetId`, `projectId`, `sourceJobId`
- `width`, `height`, `contentType`
- `role`: sketch, cad, render, selected-concept, hero, mask
- `createdAt`

## ProductVariantSet

Groups related outputs generated from one reference.

- `id`, `referenceId`, `variableType`: material, color, trim, background, camera
- `requestedValues[]`
- `jobIds[]`
- `status`: pending, partial, complete, failed

## WorkflowDependency

- `kind`: checkpoint, diffusion-model, text-encoder, vae, lora, controlnet, custom-node
- `name`, `version/null`, `locations[]`
- `required`: boolean
- `licenseUrl/null`
- `status`: present, missing, incompatible, unknown

## Relationships and transitions

- A `ProductReference` may originate from a `GenerationOutput` and may seed many `GenerationJob` records.
- A `ProductVariantSet` owns one or more jobs and may be partial when a batch has mixed outcomes.
- A job transitions `queued → running → completed|partial|failed|cancelled`; terminal jobs are immutable except for retry linkage.
- Preflight must complete before `queued`; failed preflight creates a failed job draft or actionable validation result without queueing.
