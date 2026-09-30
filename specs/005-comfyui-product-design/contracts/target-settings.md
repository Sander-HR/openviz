# Execution Target Settings Contract

Settings → AI & Compute owns target configuration. The browser receives normalized capability data and never stores provider secrets.

## Operations

- `listExecutionTargets()` returns configured local/hosted/hybrid targets with health and auth state.
- `saveExecutionTarget(input)` validates the endpoint and persists non-secret target metadata through the server.
- `testExecutionTarget(targetId)` runs health, `/system_stats`, and `/object_info` capability checks.
- `refreshExecutionTargetCapabilities(targetId)` refreshes device, VRAM, node, and model availability.
- `setExecutionPreference(preference)` stores automatic/local/hosted/hybrid preference and optional hardware profile.

## Security rules

- Hosted credentials are stored and used server-side; they are never returned to React components or persisted in browser state.
- User-supplied endpoints are validated against allowed protocols/hosts and cannot create arbitrary server-side network access.
- The client receives redacted errors and normalized capability data only.

## Capability response

The response includes target status, device summaries, free/total VRAM when available, installed node/model capabilities, supported workflow IDs, selected tier, and an explanation. A target may be `ready`, `degraded`, `unavailable`, or `auth-required`.
