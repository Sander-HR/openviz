# AI Interaction Guidelines

## Proxy
All ComfyUI requests must go through the `/comfy-api` proxy (configured in `vite.config.ts`)

## Workflows
AI generation uses a specific JSON workflow payload in `renderService.ts`. Do not modify the structure without verifying node IDs.
