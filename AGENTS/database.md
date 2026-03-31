# Database Schema

```mermaid
erDiagram
    USERS {
        uuid id PK
        text name
        text email UK
        text image
        timestamp emailVerified
        timestamp createdAt
        timestamp updatedAt
    }

    WORKSPACES {
        uuid id PK
        text name
        text slug UK
        uuid ownerId FK
        timestamp createdAt
        timestamp updatedAt
    }

    WORKSPACE_MEMBERSHIPS {
        uuid workspaceId FK
        uuid userId FK
        text role
        timestamp joinedAt
        PK workspaceId, userId
    }

    FOLDERS {
        uuid id PK
        text name
        uuid workspaceId FK
        uuid parentId FK
        timestamp createdAt
        timestamp updatedAt
    }

    PROJECTS {
        uuid id PK
        text name
        text description
        uuid workspaceId FK
        uuid folderId FK
        text thumbnailUrl
        timestamp createdAt
        timestamp updatedAt
        timestamp lastViewedAt
    }

    SCENES {
        uuid id PK
        uuid projectId FK
        text name
        json data
        boolean isMain
        timestamp createdAt
        timestamp updatedAt
    }

    JOBS {
        uuid id PK
        uuid projectId FK
        text type
        text status
        integer progress
        text resultUrl
        text error
        timestamp createdAt
        timestamp updatedAt
    }

    USERS ||--o{ WORKSPACES : "owns"
    USERS ||--o{ WORKSPACE_MEMBERSHIPS : "member of"
    WORKSPACES ||--o{ WORKSPACE_MEMBERSHIPS : "has"
    WORKSPACES ||--o{ FOLDERS : "contains"
    WORKSPACES ||--o{ PROJECTS : "contains"
    FOLDERS ||--o{ FOLDERS : "nested"
    FOLDERS ||--o{ PROJECTS : "contains"
    PROJECTS ||--o{ SCENES : "contains"
    PROJECTS ||--o{ JOBS : "has"
    SCENES }o--|| PROJECTS : "belongs to"
    JOBS }o--|| PROJECTS : "belongs to"
    WORKSPACE_MEMBERSHIPS }o--|| USERS : "references"
    WORKSPACE_MEMBERSHIPS }o--|| WORKSPACES : "references"
```

## Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `workspaces` | Workspaces owned by users |
| `workspace_memberships` | Many-to-many join table (roles: owner/admin/member/viewer) |
| `folders` | Folders for organizing projects (supports nested folders via parentId) |
| `projects` | Projects within workspaces (folderId = null means root level) |
| `scenes` | Scenes belonging to projects (stores JSON data) |
| `jobs` | Render/animate jobs for projects (status: pending/processing/completed/failed) |

## URL Structure

| View | URL |
|------|-----|
| My Files (root) | `/files/{workspaceId}` |
| Recents | `/files/{workspaceId}/recents` |
| Folder view | `/files/{workspaceId}/folder/{folderId}` |
| Project | `/projects/{projectId}` |