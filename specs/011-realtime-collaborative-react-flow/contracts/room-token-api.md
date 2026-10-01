# Room Token API Contract

## Issue a collaboration token

`POST /api/projects/:id/scenes/collab-token`

The route requires an authenticated user and current project-workspace membership. It identifies the project's main scene and returns a short-lived signed token scoped to that scene. The current token lifetime is approximately five minutes.

### Success response (`200`)

```json
{
  "token": "<short-lived signed token>",
  "sceneId": "<main-scene-id>",
  "projectId": "<project-id>",
  "expiresAt": 0
}
```

`expiresAt` is an epoch-millisecond timestamp. The token is a bearer credential and must not be logged or persisted outside the collaboration provider's connection state.

### Client behavior

- The client requests a token through the workbench session hook; it does not include a long-lived application credential in the WebSocket URL.
- The collaboration server verifies token signature, expiry, and scene scope, then rechecks membership before document synchronization or awareness is admitted.
- Every reconnect is authenticated again. A rejected/expired join stops same-token retries; recovery requests a fresh token.
- The user-facing result for any unavailable/unauthorized join is the same generic message: “Access unavailable. Check that you’re signed in or request access, then retry.” The UI does not disclose whether a project or scene exists or the exact permission failure.
- A rejected session receives no document, cursor, or presence state.

The API's current auth/lookup/configuration failures are represented by HTTP errors; the workbench must not surface their status-specific details in its user-facing collaboration message.
