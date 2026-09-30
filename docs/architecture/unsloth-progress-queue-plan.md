# Plan: Unsloth Progress Polling and Generation Queue

**Generated**: 2026-09-25
**Estimated Complexity**: High
**Status**: In progress; queue foundation, endpoint concurrency setting, OpenAPI capability probing (Task 1.2), and live compute-status visibility implemented

## Overview

Add a provider-aware generation coordinator for the Unsloth OpenAI-compatible image endpoint. It will limit active image generations, queue excess requests FIFO, poll Unsloth's private progress endpoint, expose accessible progress states in the UI, and fall back safely when a provider does not expose progress.

The confirmed design is a FIFO queue scoped per configured endpoint, with a configurable concurrency limit of **1–3 active requests** and a default recommendation of **2**. Jobs are server-recovered across reloads/devices, and the limit applies to all media jobs sharing that endpoint. A server-side coordinator will enforce the limit across tabs and users.

Unsloth-specific endpoints confirmed in its current source:

- `POST /v1/images/generations` — synchronous OpenAI-compatible generation
- `GET /api/inference/images/generate-progress` — active, step, total steps, fraction, ETA
- `POST /api/inference/images/generate/cancel` — cancellation
- `GET /api/inference/images/load-progress` — model loading/download progress
- `GET /openapi.json` — FastAPI schema discovery

The OpenAI-compatible route does not return a job ID and rejects `stream: true`, so polling is out-of-band while the generation request remains pending.

## Assumptions and decisions

- Queue scope: per normalized endpoint, coordinated by the server so tabs, devices, and users share the same capacity policy.
- Queue policy: FIFO; queued jobs can be cancelled before they acquire a slot.
- Concurrency setting: integer from 1 through 3, default 2.
- Limit scope: all media jobs sharing the endpoint; image/video/audio can later receive separate limits if needed.
- Poll interval: start at 750 ms, back off to 1.5 s while unchanged, and stop immediately on request completion/error/cancellation.
- Progress fallback: indeterminate loading state and phase labels; never fabricate a percentage.
- Unsloth progress is opt-in based on endpoint capability detection. Generic OpenAI-compatible providers remain supported without polling.
- The Unsloth progress endpoint has no job ID and exposes engine-level progress. Exact per-job percentages are shown only when one OpenViz request is active for that endpoint; with multiple active requests, the UI shows active/indeterminate state unless a future provider version adds correlation IDs.
- The existing base64 response support remains unchanged.

## Sprint 1: Provider capability and progress API

**Implementation status**: Base64 output support is complete from the preceding fix. OpenAPI capability probing (Task 1.2) is implemented as optional discovery in `src/services/ai/targets/openApiDiscovery.ts` and surfaced in the live workbench compute popup (see [compute-endpoint-status.md](./compute-endpoint-status.md)). Live Unsloth progress polling (Task 1.3) remains for the next increment.

**Goal**: Establish typed, tested Unsloth capability detection and progress polling without changing the generation UI.

**Demo/Validation**: A mocked Unsloth server reports progress from 0% to 100%; a generic OpenAI-compatible server is detected as synchronous-without-progress.

### Task 1.1: Define progress and queue domain types

- **Location**: `src/types/executionTarget.types.ts`, `src/types/generationJob.types.ts`
- **Description**: Add typed provider capability flags, progress snapshots, queue state, concurrency limits, and terminal reasons. Preserve existing normalized job statuses.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Progress supports `queued`, `loading`, `generating`, `saving`, `completed`, `failed`, and `cancelled` phases.
  - Percentage is optional and only present when supplied by the provider.
  - Queue position and configured concurrency are represented separately from provider progress.
- **Validation**: Type-level tests and existing generation-job tests remain green.

### Task 1.2: Add OpenAPI/capability probing

- **Location**: `src/services/ai/targets/openAIImageTarget.ts`
- **Description**: Probe the endpoint's `/openapi.json` when available and detect `/api/inference/images/generate-progress` and `/api/inference/images/generate/cancel`. Treat a 404, auth failure, CORS failure, or malformed schema as normal lack of optional capability—not as generation failure.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Existing `/models` health checks still work.
  - OpenAPI probing never blocks image generation.
  - The endpoint root is derived safely when the configured URL ends in `/v1`.
  - No API key is logged or persisted in probe errors.
- **Validation**: Mock responses for supported, unsupported, malformed, unauthorized, and unreachable OpenAPI documents.
- **Implementation status** (implemented): Endpoint-root derivation (`resolveOpenApiUrl`, strips trailing `/vN`), probe outcomes `supported` / `unavailable` / `unauthorized` / `network` / `malformed`, capability flags for progress telemetry, load progress, and cancellation, Bearer header only when a key is configured and keyless mode is off, 5 s timeout, and per-endpoint caching. Implemented in `src/services/ai/targets/openApiDiscovery.ts` with unit tests; wired into the compute popup via `useAIComputeStatus`. Remaining gap vs. plan: probing currently feeds the status UI only — generation progress polling (Task 1.3) still needs to consume these capability flags.

### Task 1.3: Implement Unsloth progress and cancellation methods

- **Location**: `src/services/ai/targets/openAIImageTarget.ts`
- **Description**: Add typed methods for progress and cancellation. Normalize `fraction`, `step`, `total_steps`, and `eta_seconds`; clamp invalid values and return an idle snapshot for a completed request.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Progress requests use the same authentication policy as generation.
  - Cancellation uses `POST` and treats an already-finished job as harmless.
  - Polling does not report stale progress after terminal completion.
- **Validation**: Unit tests for valid, partial, invalid, 401, 404, and network-error responses.

## Sprint 2: Queue and concurrency coordinator

**Implementation status**: Client-side FIFO throttling and the per-endpoint concurrency setting are implemented. The client queue is exposed as `imageApiQueue` in `renderService` and surfaced live in the workbench compute popup (labeled "OpenViz queue" to make its session scope explicit). Server-backed coordination, recovery, and a shared cross-tab view remain for the next increment (Task 2.1 / Task 4.3).

**Goal**: Ensure no more than the configured number of image generations are active and make queue behavior independent of presentation components.

**Demo/Validation**: Submit five requests with a limit of two; two run, three queue, and queued jobs start FIFO as slots finish.

### Task 2.1: Implement a server-backed FIFO coordinator

- **Location**: `src/services/ai/generationQueue.ts`, `src/services/ai/generationQueue.test.ts`, `src/services/ai/generationQueueRepository.ts`
- **Description**: Create a provider-neutral coordinator with `enqueue`, `cancel`, `setConcurrency`, `subscribe`, and lifecycle transitions. Key queues by normalized endpoint so unrelated providers do not block each other, and persist queue ownership/status through the server job repository.
- **Dependencies**: Sprint 1 types
- **Acceptance Criteria**:
  - Active jobs never exceed the configured limit.
  - The limit is clamped to 1–3.
  - Completion, failure, and cancellation always release a slot.
  - A synchronous OpenAI request occupies a slot until its response is received.
  - A queued cancellation never sends a provider request.
- **Validation**: Fake timers and deferred promises covering FIFO ordering, failure release, cancellation, duplicate completion, and limit changes.

### Task 2.2: Integrate the coordinator with generation services

- **Location**: `src/services/renderService.ts`, `src/services/ai/generationJobService.ts`
- **Description**: Route OpenAI image generation through the coordinator while preserving the existing `RenderService` response contract. Reuse the durable job service for product-design workflows instead of creating a second job lifecycle.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Existing render callers still receive `{ success, images, error }`.
  - Product-design jobs expose queue position and active progress.
  - ComfyUI behavior is unchanged unless it opts into the shared coordinator later.
  - Errors identify whether they occurred while queued, submitting, polling, or downloading.
- **Validation**: Existing render-service tests plus integration tests for multiple simultaneous requests.

### Task 2.3: Add settings state and persistence

- **Location**: `src/types/executionTarget.types.ts`, `src/store/slices/aiComputeSlice.ts`, `src/store/storeTypes.ts`
- **Description**: Add `imageApiConcurrency` with default 2 and bounds 1–3. Persist it with existing compute settings and safely hydrate older settings.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Settings survive reload.
  - Invalid old values normalize to the default.
  - Reducing the limit never cancels active work; it only delays new work.
  - Increasing the limit starts eligible queued work promptly.
- **Validation**: Store migration/hydration tests.

## Sprint 3: Progress polling and UI

**Goal**: Show useful queue and generation status throughout the studio without claiming unsupported precision.

**Demo/Validation**: The UI visibly shows queue position, active slot count, Unsloth denoising percentage/ETA, and an indeterminate state for generic providers.

### Task 3.1: Add a polling hook

- **Location**: `src/components/product-design/hooks/useGenerationProgress.ts` or the relevant feature hook
- **Description**: Keep timers and fetch calls in a feature hook. Poll only active Unsloth jobs, clean up on unmount, use abort signals, and publish snapshots to the queue/job store.
- **Dependencies**: Sprint 2 integration
- **Acceptance Criteria**:
  - Polling starts only after a job is active.
  - Polling stops on completion, error, cancellation, or component cleanup.
  - Temporary polling failures retry with backoff and do not fail the generation request.
  - Stale responses cannot overwrite newer terminal state.
- **Validation**: Hook tests with fake timers, abort assertions, and out-of-order responses.

### Task 3.2: Build queue/progress status UI

- **Location**: `src/components/product-design/ProductVariantGallery.tsx`, relevant studio render panels, new small status component under `src/components/product-design/`
- **Description**: Show queued position, active count, phase, percentage when available, ETA when available, and an indeterminate indicator otherwise. Include cancel actions for queued/running jobs.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Queued jobs say `Queued · position N`.
  - A single active Unsloth job shows `step / total_steps` and percentage when valid.
  - Multiple active jobs on the same Unsloth endpoint show `Generating`/indeterminate rather than attributing global progress to the wrong job.
  - Generic providers show `Generating` without a fake percentage.
  - Status is exposed through `role=status`/live announcements without excessive announcements.
  - Controls are keyboard accessible and have clear labels.
- **Validation**: React Testing Library behavior tests and axe checks at mobile/desktop layouts.

### Task 3.3: Add settings control

- **Location**: `src/components/settings/AIComputeSettings.tsx`
- **Description**: Add an accessible select or segmented control for maximum simultaneous image generations: 1, 2, or 3. Explain that this limits OpenViz submissions, while provider/server limits may still be lower.
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Default is 2.
  - The control is only shown or enabled for image-generation protocols.
  - The current queue and active count are visible near the control.
  - Copy distinguishes local throttling from server-wide throttling.
- **Validation**: Component tests, keyboard tests, and accessibility scan.

## Sprint 4: Persistence, resilience, and operational verification

**Goal**: Make the queue recoverable and safe under reloads, endpoint failures, and provider restarts.

**Demo/Validation**: Reload during queued/running work; the app restores recoverable jobs, marks unknown in-flight work clearly, and does not duplicate submissions.

### Task 4.1: Implement server recovery and reconciliation

- **Location**: Existing generation-job repository/service, new queue repository, and documentation
- **Description**: Persist every queued/running job server-side and reconcile it after reload, across tabs, and across devices. Since Unsloth's synchronous route has no provider job ID, persist the OpenViz submission state and mark an in-flight request interrupted/retryable rather than silently replaying it.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - No request is silently submitted twice after reload.
  - Queued requests are restored if their input and endpoint configuration are still valid.
  - Running synchronous requests are marked `interrupted`/`retryable` unless the original promise is still alive.
  - Multiple tabs and devices observe one endpoint queue and cannot exceed its configured concurrency.
- **Validation**: Reload/recovery tests and duplicate-submission regression test.

### Task 4.2: Add observability and diagnostics

- **Location**: `src/services/ai/targets/openAIImageTarget.ts`, `docs/operations/`
- **Description**: Record sanitized capability, queue, polling, and terminal timing data. Never log bearer tokens, base64 payloads, prompts containing sensitive content, or endpoint query secrets.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Diagnostics distinguish queue wait time from generation time.
  - Polling failures are visible in development diagnostics without turning successful jobs into failures.
  - API monitor/OpenAPI availability can be checked during support investigations.
- **Validation**: Redaction tests and manual smoke test against an Unsloth instance.

### Task 4.3: Document server-side scaling boundary

- **Location**: `docs/architecture/` and `docs/operations/`
- **Description**: Document that the first implementation is browser/session scoped. Define a future backend queue for cross-tab, multi-user, and deployment-wide limits using the existing durable job model.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Operators understand that two browser tabs can still exceed a server GPU's capacity.
  - The migration path to a server-side semaphore/queue is documented.

## Testing Strategy

- Unit tests for endpoint-root derivation, OpenAPI capability detection, response normalization, progress clamping, and cancellation.
- Queue tests with deferred promises and fake timers for strict concurrency and FIFO behavior.
- Hook tests for polling cleanup, backoff, aborts, and stale response protection.
- React behavior and accessibility tests for queued, running, completed, failed, cancelled, and unsupported-progress states.
- Existing `pnpm exec tsc --noEmit`, targeted Vitest tests, full Vitest suite, lint, and build.
- Manual Unsloth smoke test against `/openapi.json`, `/v1/images/generations`, `/api/inference/images/generate-progress`, and cancellation.

## Risks and mitigations

- **OpenAI-compatible providers differ**: capability detection is optional and generation remains functional without progress.
- **Synchronous requests have no remote job ID**: do not replay in-flight requests automatically after reload.
- **Progress is global to the Unsloth diffusion engine**: it has no job ID, so exact progress cannot be correlated safely when multiple jobs share the endpoint; use indeterminate UI for concurrent jobs or serialize when exact progress is required.
- **Polling overload**: one poller per active endpoint, adaptive intervals, and a hard maximum poll frequency.
- **Server coordination complexity**: use atomic claim/lease operations for queue slots, heartbeat running jobs, and reclaim abandoned leases after a timeout.
- **Long base64 responses**: keep polling metadata separate from image payloads and avoid logging response bodies.
- **Cancellation races**: terminal request completion wins; cancellation is idempotent and cannot release a slot twice.

## Rollback Plan

The queue is introduced behind the OpenAI-image coordinator only. Disable the coordinator or set concurrency to 1 to return to serialized behavior. Remove optional progress polling without changing the generation request/response contract. Existing ComfyUI rendering remains unaffected.
