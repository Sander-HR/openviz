# Services & API

## Render Service
Integration with ComfyUI is in `src/services/renderService.ts`

## Error Handling
- Use `try/catch` blocks for all async operations
- Implement timeouts for network requests (default: 5000ms)
- Provide fallback mechanisms (e.g., polling if WebSockets fail)

## Organization
| Directory | Purpose |
|-----------|---------|
| `src/services` | External API interactions |
| `src/utils` | Pure helper functions |
