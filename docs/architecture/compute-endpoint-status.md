# Compute Endpoint Status (Workbench Compute Popup)

The workbench **Compute** popup is a live dashboard for the active AI compute endpoint. It answers three questions at a glance: *is the endpoint reachable, what can it do, and what is currently running?* All data is read-only; the popup never submits work.

## Data flow

```text
computeSettings (zustand)
        ↓ resolveComputeEndpoint()
   protocol + normalized endpoint
        ↓
┌───────────────────────┬──────────────────────────────┐
│ comfyui               │ openai-image                 │
│ GET /system_stats     │ GET /models                  │
│ GET /object_info      │ GET /openapi.json (optional) │
│ GET /queue (optional) │ imageApiQueue snapshot       │
└───────────┬───────────┴──────────────┬───────────────┘
            ↓                          ↓
        useAIComputeStatus()  →  AIComputeStatus view model
            ↓
        ComputePopover (pure render)
```

- `src/services/ai/computeStatusService.ts` — endpoint resolution (`resolveComputeEndpoint`, `normalizeImageApiEndpoint`) and the best-effort ComfyUI queue read (`fetchComfyQueueInfo`).
- `src/services/ai/targets/openApiDiscovery.ts` — optional OpenAPI capability probe (`probeEndpointCapabilities`, `resolveOpenApiUrl`).
- `src/components/product-design/hooks/useAIComputeStatus.ts` — all fetch/effect/timer logic; returns the `AIComputeStatus` view model plus a `refresh()` callback.
- `src/components/product-design/ComputePopover.tsx` — presentation only. Compact layout: trigger pill shows the active model name for image APIs (capped at 20 characters, "Endpoint" fallback when none is selected) or "ComfyUI" locally; the panel opens with a status row (badge + "Checked …" + refresh icon), then job queue, an interactive model `<select>` (writes `imageApiModel` via `setImageApiModel`, which re-triggers the hook's probe), capabilities, hardware, and the error box.

## Endpoint resolution

| Protocol | Source setting | Normalization | Fallback |
|---|---|---|---|
| `comfyui` | `localEndpoint` | trim | `/comfy-api` (Vite/Next rewrite to local ComfyUI) |
| `openai-image` | `imageApiEndpoint` | trim + strip trailing slashes | empty → status `unavailable`, message "No image API endpoint configured." |

The normalized endpoint is the single key used for queue scoping, probe caching, and request URLs.

## Probed routes

### ComfyUI (local, via `/comfy-api`)

| Route | Purpose | Failure behavior |
|---|---|---|
| `GET /system_stats` | Devices + VRAM (`vram_total`, `vram_free`, …) | health → `unavailable` with message |
| `GET /object_info` | Node/model inventory (capability check) | health → `unavailable` with message |
| `GET /queue` | Server-side queue: `queue_running` / `queue_pending` lengths | **optional** — older builds lack the route; returns `null`, popup simply omits the row |

### OpenAI-compatible image API (e.g. Unsloth)

| Route | Purpose | Failure behavior |
|---|---|---|
| `GET /models` | Model list + connectivity/auth check | 401/403 → `auth-required`; other errors → `unavailable` with the provider message |
| `GET /openapi.json` | Optional capability discovery (see below) | **never** affects connection status |

### OpenAPI capability discovery

The schema root is derived from the configured endpoint: a trailing `/vN` segment is stripped (`http://host:8001/v1` → `http://host:8001/openapi.json`); bare roots keep the conventional path. The probe (5 s timeout, Bearer header only when an API key is configured and keyless mode is off) classifies the outcome as:

- `supported` — schema parsed; capability flags are set from path matching:
  - **Progress telemetry**: any `GET` path matching `/generate-progress|progress/i` (e.g. Unsloth's `/api/inference/images/generate-progress`)
  - **Load progress**: any `GET` path matching `/load-progress/i`
  - **Cancellation**: any `POST` path matching `/cancel/i`
- `unavailable` — route missing or non-2xx (other than auth)
- `unauthorized` — 401/403
- `network` — CORS block or connectivity failure
- `malformed` — unparseable JSON or empty `paths`

A probe that is not `supported` renders as a single "Generic OpenAI-compatible endpoint" chip. Probes are cached per endpoint for the lifetime of the hook and never block or fail the health check.

## Refresh behavior

- Initial check on mount and whenever the resolved endpoint or credentials change (settings edits re-check immediately).
- While the popup is **open**: re-check on open, then every 30 s; a manual **Refresh** button triggers an immediate check.
- A sequence counter discards stale responses so an out-of-order probe can never overwrite a newer result.
- The client-side image API queue (`imageApiQueue` in `renderService`) is subscribed live and filtered to the active endpoint, so queue counts update without waiting for the next poll.

## Queue scope (important)

The popup shows two distinct queues:

1. **OpenViz queue** — the client-side FIFO coordinator in this browser session (`active/concurrency active · N queued`). It reflects only work submitted from *this* tab/session; it is not a server-wide view.
2. **ComfyUI server** — the real server queue read from `GET /queue` (when available), covering all clients of that ComfyUI instance.

A future server-backed coordinator (see [Unsloth progress & queue plan](./unsloth-progress-queue-plan.md)) will replace the session-scoped view with a shared one; until then the UI labels make the scope explicit.

## Status model

`AIComputeStatus.status` reuses `ExecutionTargetStatus`: `unknown`, `checking`, `ready`, `degraded`, `unavailable`, `auth-required`. The popup maps these to Connected / Checking / Unknown / Degraded / Auth required / Offline with matching dot colors, exposes the badge through `role="status"` + `aria-live="polite"`, and wraps the panel in `role="dialog"`.

## Graceful degradation rules

- Any optional read (`/queue`, `/openapi.json`) failing must never change a healthy endpoint's status.
- Network/CORS failures on the probe are reported as capability gaps, not errors.
- No API key is sent to the probe in keyless mode, and probe errors never include credentials.
