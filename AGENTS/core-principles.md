# Core Principles

## The 250-Line Rule
If any file exceeds 250 lines, evaluate for immediate splitting.

## Strict Folder Mapping
| Type | Location |
|------|----------|
| Interfaces/Types | `src/types/` (Shared) or local `[ComponentName].types.ts` |
| Business Logic/API | `src/services/` |
| State Logic | `src/store/` |
| Pure UI | `src/components/` |

## Import Paths
Use named exports. Absolute imports `@/features/...` preferred over relative `../../`.
