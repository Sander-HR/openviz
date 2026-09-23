# Contract: Room Token API

## Endpoint

`POST /api/projects/:id/scenes/collab-token`

Next.js App Router route handler. Issues a short-lived collaboration room token for the project's main scene after full access verification.

## Request

- **Auth**: NextAuth session (existing `auth()` from `@/lib/auth`).
- **Body**: none required. Optional `{ "sceneId": string }` to target a non-main scene is NOT supported in v1 — the endpoint always resolves the project's main scene (one room per project main scene).

## Response

### 200 OK

```json
{
  "token": "<signed token, self-describing>",
  "sceneId": "<uuid>",
  "projectId": "<uuid>",
  "expiresAt": 1790000000000
}
```

- `token`: signed (HMAC/JWT) with fields `{ projectId, sceneId, userId, issuedAt, expiresAt }`; TTL ≈ 5 minutes.
- The token is the only credential the WebSocket transport accepts (see [collab-transport.md](./collab-transport.md)).

## Errors

| Status | Condition | Body |
|--------|-----------|------|
| 401 | No authenticated session | `{ "error": "Unauthorized" }` |
| 403 | Authenticated user lacks workspace membership for the project (existing `canAccessProject` check) | `{ "error": "Forbidden" }` |
| 404 | Project does not exist | `{ "error": "Not Found" }` |
| 404 | Project exists but has no main scene | `{ "error": "No main scene" }` |

## Behavioral Rules

- Access verification reuses the exact membership pattern of the existing scenes routes (workspace membership of the project's workspace); this endpoint creates **no new access path** (spec FR-009).
- Tokens are stateless: no database row is created or updated on issuance.
- The same user may hold multiple live tokens (one per tab/session); each is independently scoped and expiring.
- Token verification logic lives in a shared service (`src/services/collab/roomTokenService.ts`) used by this route for issuance and by the collab server for verification, so secret handling and format have one implementation.

## Testing Requirements (per constitution, test-first)

- 401 without session; 403 for non-member of the project's workspace; 404 for missing project / missing main scene.
- Issued token verifies successfully in the shared service; expired, tampered, and out-of-scope tokens are rejected.
- Token payload contains exactly the scoped fields above (no extra user data beyond `userId`).
