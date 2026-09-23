# Scene Persistence Contract

This feature reuses the existing main-scene persistence interface. It does not add a new public endpoint.

## Read Existing Scene

**Request**

```text
GET /api/projects/{projectId}/scenes
```

**Success response**

An array of scene records containing at least:

- `id`
- `projectId`
- `data` with `nodes` and `connections`
- `isMain`
- `version`

The client uses the main scene, or the first scene when no main scene is marked.

## Persist Completed Gesture State

**Request**

```text
PATCH /api/projects/{projectId}/scenes
Content-Type: application/json
```

```json
{
  "data": {
    "nodes": "<final Workbench node array>",
    "connections": "<final connection array>"
  },
  "expectedVersion": "<current scene version when known>"
}
```

The request is sent only for a completed changed gesture or another existing completed Workbench action. Intermediate pointer updates are not individual persistence requests.

**Success response**

```json
{
  "scene": "<saved scene data>",
  "version": "<new scene version>"
}
```

The client records the returned version as the current scene version and treats the final state as durably saved.

## Failure behavior

- `401 Unauthorized`: preserve the local final state and log the persistence failure.
- `403 Forbidden` or `404 Not Found`: preserve the local final state and log the persistence failure.
- `409 Conflict`: preserve the local final state and use the existing version-conflict/retry behavior; conflict resolution is not defined by this feature.
- Network or server error: preserve the local final state, log diagnostic details, and retain existing pending-save/retry behavior.

## Contract invariants

1. A completed gesture’s final state is the payload state.
2. No intermediate active-gesture state is treated as a completed gesture write.
3. A cancelled gesture sends no completed-gesture write.
4. Persistence does not change the local Undo/Redo before/after semantics.
5. Authentication and workspace membership rules remain those of the existing route.
