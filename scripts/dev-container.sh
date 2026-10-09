#!/usr/bin/env bash
set -euo pipefail

cd /workspace
corepack enable

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[container] Installing pnpm dependencies..."
  pnpm install --frozen-lockfile
fi

echo "[container] Running setup in container mode..."
pnpm run setup:container

echo "[container] Starting development server..."
pnpm run dev
