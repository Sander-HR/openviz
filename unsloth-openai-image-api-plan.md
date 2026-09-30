# Plan: Unsloth OpenAI-Compatible Image API

**Generated**: 2026-09-24
**Estimated Complexity**: Medium

## Overview

Add a practical first-version adapter for Unsloth and other OpenAI-compatible image-generation servers using the supplied `/v1/models` and `/v1/images/generations` contract. The adapter will coexist with ComfyUI, support all existing OpenViz image-generation entry points, discover models from the configured API, let the user choose a model in Settings, send Bearer authentication, and import returned remote image URLs into OpenViz assets.

The implementation will avoid changing ComfyUI workflow JSON or ComfyUI job semantics. It will add an API protocol alongside the existing ComfyUI protocol and normalize synchronous API responses into the existing generation result/job model.

## Confirmed First-Version Decisions

- Scope includes all existing image-generation flows; video generation remains ComfyUI-only.
- The API key is configured in browser/local settings for speed. It must not be persisted in the server database or logged.
- The configured endpoint includes `/v1`, for example `http://192.168.1.100:8001/v1`.
- Models are loaded from `GET /models` and displayed in Settings for explicit user selection.
- Returned image URLs are downloaded/imported into OpenViz assets rather than used only as remote links.
- The API must send `Authorization: Bearer <key>` unless an explicit keyless option is enabled.

## Prerequisites

- Existing OpenViz development environment and ComfyUI tests remain passing.
- A reachable Unsloth-compatible server for manual smoke testing.
- A valid API key unless the server explicitly supports keyless requests.
- No new dependency is required; use the existing `fetch` and asset/import services.

## Sprint 1: Protocol and Adapter Core

**Goal**: Implement and test the provider-neutral synchronous image API adapter without changing the UI.

**Demo/Validation**:
- Unit tests pass for model discovery, authenticated generation, 401/403 handling, malformed responses, and image URL normalization.
- Existing ComfyUI tests remain unchanged and passing.

### Task 1.1: Define API target configuration types

- **Location**: `src/types/executionTarget.types.ts`, `src/store/slices/aiComputeSlice.ts`, `src/store/storeTypes.ts`
- **Description**: Add a protocol/provider distinction and configuration fields for an OpenAI-compatible image API: endpoint, API key, keyless flag, available models, selected model, and selected image size. Keep credentials out of persisted execution-target database metadata.
- **Dependencies**: None
- **Acceptance Criteria**:
  - ComfyUI target types remain source-compatible.
  - API configuration supports an endpoint already containing `/v1`.
  - API key is represented in client settings but is never included in redacted database target records.
  - No `any` types are introduced.
- **Validation**: `pnpm exec tsc --noEmit`; focused store/type tests.

### Task 1.2: Implement OpenAI-compatible image target adapter

- **Location**: `src/services/ai/targets/openAIImageTarget.ts`
- **Description**: Create an adapter that implements the existing execution-target contract. Add `GET /models` discovery and `POST /images/generations` generation. Normalize `data[].url` responses into `GenerationOutput` values. Use Bearer authentication by default and only omit it when keyless access is explicitly enabled.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Endpoint paths are appended without duplicating `/v1` or slash separators.
  - Model discovery rejects an empty or malformed model list.
  - Generation uses the explicitly selected model and requested size.
  - 401/403 errors produce actionable API-key errors.
  - Other non-2xx responses preserve useful server error text.
  - Remote output URLs are validated as HTTP(S) URLs.
  - Synchronous completion is represented consistently for the existing job service.
- **Validation**: Adapter unit tests with injected fetcher.

### Task 1.3: Add image URL download/import service

- **Location**: Existing image/asset service location identified during implementation; likely `src/services`, plus tests
- **Description**: Add a service-level helper that downloads each returned image URL, verifies a successful response and image content type, and passes the blob/data to the existing OpenViz asset import path. Keep network effects out of React components.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Successful remote images become normal OpenViz image assets.
  - Failed downloads produce retryable errors without discarding the generation request.
  - Unsupported content types are rejected clearly.
  - The API key is not forwarded when downloading the generated image URL unless the response contract explicitly requires it.
- **Validation**: Service tests for successful download, non-2xx response, invalid content type, and URL failure.

## Sprint 2: Settings and Target Routing

**Goal**: Allow users to configure the API, discover models, and select the active model.

**Demo/Validation**:
- Settings shows an OpenAI-compatible image API option.
- Entering an endpoint and key, then testing the connection, loads available models.
- A selected model persists for the current browser session and is visibly required before generation.

### Task 2.1: Add API connection settings UI

- **Location**: `src/components/settings/AIComputeSettings.tsx`, `src/components/settings/hooks/useAIComputeSettings.ts`, related tests
- **Description**: Add protocol selection, API endpoint, API key input, keyless toggle, model discovery action, model selector, and image-size selector. Preserve the existing ComfyUI settings UI and hardware/dependency sections for ComfyUI targets.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - API key input is masked and never rendered as plain text elsewhere.
  - Model list is loaded from the configured server and displayed for explicit selection.
  - Empty model lists and connection failures are announced accessibly.
  - 401/403 messages specifically mention checking the API key and Authorization header.
  - Controls are keyboard-operable and have accessible labels/status announcements.
- **Validation**: React Testing Library tests for switching protocols, loading models, selection, auth failure, and keyless mode.

### Task 2.2: Add API target factory and route selection

- **Location**: `src/services/ai/targets`, `src/app/api/ai/targets/route.ts`, `src/app/api/ai/targets/[id]/route.ts`, related factory tests
- **Description**: Introduce a target factory that chooses ComfyUI or OpenAI-compatible adapter based on protocol. Pass client-only credentials only through the client adapter path for this first version, and ensure server-side redacted target APIs never accept or return API keys.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Existing local/hosted/hybrid ComfyUI behavior is preserved.
  - API targets do not accidentally call `/system_stats` or `/object_info`.
  - Target route validation rejects unsupported protocols and invalid endpoints.
  - API keys never reach database writes, logs, or API responses.
- **Validation**: Factory and route tests; `pnpm exec tsc --noEmit`.

### Task 2.3: Wire model discovery into connection testing

- **Location**: `src/services/ai/targetSettingsService.ts`, settings hook, tests
- **Description**: Extend connection testing for API targets to call `/models`, mark the target ready only when the model response is valid, and preserve the selected model when still available.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Connection status distinguishes unavailable from authentication failure.
  - Selected model is cleared or flagged when no longer returned by the server.
  - No ComfyUI capability assumptions are applied to API targets.
- **Validation**: Focused target settings tests.

## Sprint 3: Generation Integration

**Goal**: Route all existing image-generation entry points through the selected target and import API outputs into the existing gallery/workbench flow.

**Demo/Validation**:
- Product concept generation works through the Unsloth API.
- Legacy image render generation works through the API without affecting video generation.
- Imported results appear in the existing gallery and can be added to the Workbench.

### Task 3.1: Normalize synchronous API jobs in generation services

- **Location**: `src/services/ai/generationJobService.ts`, adapter-specific normalization, tests
- **Description**: Support adapters that complete synchronously while preserving queued/running/completed/failed state behavior expected by the UI. Avoid polling or cancellation requests for the API protocol.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - A successful API request creates a completed job with outputs.
  - API failures retain the original prompt/model/size for retry.
  - Cancellation is reported as unsupported or no-op without sending an invalid API request.
  - Existing ComfyUI lifecycle behavior remains unchanged.
- **Validation**: Generation job service tests for immediate success, failure, retry, and unsupported cancellation.

### Task 3.2: Wire product-design generation to the selected protocol

- **Location**: `src/components/product-design/ProductWorkflowPanel.tsx`, `src/components/product-design/hooks/useProductGeneration.ts`, related target hook/factory
- **Description**: Replace local-ComfyUI-only adapter construction with selected-target construction. Keep ComfyUI preflight for ComfyUI workflows and use API-specific validation for prompt/model/size.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Product concept requests use the selected API model and size.
  - No ComfyUI workflow JSON is sent to the generic API.
  - Missing selected model prevents submission with a clear message.
  - Existing ComfyUI product workflows still function.
- **Validation**: Product generation hook and panel tests.

### Task 3.3: Wire legacy image rendering to the selected protocol

- **Location**: `src/services/renderService.ts`, render hooks/components, related tests
- **Description**: Add a protocol-aware image generation path for the existing render flow. Translate the current prompt, dimensions, and requested count into the API request. Keep upload/workflow/WebSocket behavior exclusively on the ComfyUI path and leave animation ComfyUI-only.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Existing render UI can generate images through the API.
  - API requests use the configured model and selected size.
  - Video/animation requests cannot silently route to the image API.
  - Existing ComfyUI render tests and behavior remain intact.
- **Validation**: Focused render service tests plus existing `RenderPanel` tests.

### Task 3.4: Import generated outputs into existing asset flow

- **Location**: Product gallery/render result integration and asset service files identified in Task 1.3
- **Description**: Ensure API outputs are downloaded and passed through the same metadata, project-reference, gallery, and Workbench insertion paths used by ComfyUI outputs.
- **Dependencies**: Tasks 1.3, 3.2, 3.3
- **Acceptance Criteria**:
  - Imported images retain source job, model, prompt, dimensions, and content type metadata where supported.
  - Multiple returned images are grouped as one generation result.
  - A failed import does not remove successfully imported sibling images.
- **Validation**: Integration tests for one image, batch images, and partial download failure.

## Sprint 4: Hardening and Verification

**Goal**: Validate the practical first version against real and mocked servers without regressing ComfyUI.

**Demo/Validation**:
- Full lint, typecheck, and test suite passes.
- Manual smoke test succeeds against an Unsloth-compatible endpoint.
- API keys are absent from logs, persisted target metadata, and rendered UI diagnostics.

### Task 4.1: Add security and error handling checks

- **Location**: API adapter, settings hook, route validation, tests
- **Description**: Audit logging and error propagation. Redact Authorization values, API keys, and sensitive endpoint query strings. Add explicit handling for 401, 403, timeout, invalid JSON, missing URL, and remote image download errors.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - No credential appears in thrown errors, console logs, test snapshots, or server responses.
  - Auth failures recommend checking API key and Authorization header.
  - Keyless mode is opt-in and visibly labeled.
- **Validation**: Redaction tests and manual log review.

### Task 4.2: Run complete automated verification

- **Location**: Repository-wide
- **Description**: Run focused tests, full tests, lint, and TypeScript validation. Fix only issues caused by this feature and document unrelated pre-existing failures.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - `pnpm run lint` passes.
  - `pnpm exec tsc --noEmit` passes.
  - Relevant Vitest suites pass.
  - Existing ComfyUI tests remain green.
- **Validation**: Commands above and coverage comparison against the baseline.

### Task 4.3: Manual Unsloth smoke test

- **Location**: `docs/development/local-development.md` or a short feature note
- **Description**: Document endpoint format, key configuration, model discovery, test-connection behavior, and manual generation verification. Do not include real credentials.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - A developer can configure `http://host:port/v1`, load models, select one, generate an image, and see it imported.
  - Documentation explains that the server must explicitly support keyless access before enabling keyless mode.
- **Validation**: Follow the documented smoke test against a reachable server.

## Testing Strategy

- Adapter unit tests with injected `fetch` implementations.
- Store and settings component tests for protocol switching, model discovery, and selection.
- Generation service tests for synchronous completion and failure/retry behavior.
- Asset import tests for remote image download and partial failures.
- Regression coverage for existing ComfyUI adapters, render service, product generation, and animation flows.
- Full validation with lint, TypeScript, Vitest, and a manual endpoint smoke test.

## Potential Risks & Gotchas

- **Browser CORS**: A private Unsloth host may not allow browser requests. The first version assumes CORS is configured; otherwise the adapter must move behind a server proxy.
- **API key exposure**: Browser-local storage is acceptable only for this rapid first version. It should be clearly labeled as local configuration and never logged or persisted server-side.
- **Synchronous job mismatch**: The adapter should not invent polling endpoints. Represent the request as immediately completed after output validation.
- **Remote URL lifetime**: Importing the image immediately is important because generated URLs may expire.
- **Model response variance**: `/models` may return OpenAI-style objects with `id`, not a plain string list. Normalize both only if the contract is explicit and tested.
- **Image URL authentication**: Do not assume the returned URL accepts the original Bearer key; download it as returned and surface a clear error if access fails.
- **Legacy render divergence**: `src/services/renderService.ts` and the newer target abstraction are separate paths. Both must be wired deliberately.
- **Target persistence**: Existing database records are redacted. Do not add an API key column as part of this first version.
- **File size limits**: Keep new files below the repository’s 300-line guideline by splitting types, adapter, response parsing, and download logic.

## Rollback Plan

1. Disable the new protocol option behind a feature flag or remove it from the settings selector.
2. Leave the ComfyUI adapter and workflow templates unchanged.
3. Revert the target factory branch for API targets while retaining isolated adapter tests if useful.
4. Restore the previous ComfyUI-only construction in product and legacy render paths.
5. Remove only client-side API settings fields; do not alter existing ComfyUI database records or migrations.
