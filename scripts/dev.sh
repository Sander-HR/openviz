#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
RUNTIME_DIR="$PWD/.run"
PID_FILE="$RUNTIME_DIR/openviz-dev.pid"
LOCK_DIR="$RUNTIME_DIR/openviz-dev.lock"

mkdir -p "$RUNTIME_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if [[ -f "$PID_FILE" ]]; then
    existing_pid="$(cat "$PID_FILE")"
    echo "[dev] OpenViz development server is already running (launcher PID $existing_pid)." >&2
  else
    echo "[dev] Another OpenViz development launcher is starting. Try again shortly." >&2
  fi
  exit 1
fi

printf '%s\n' "$$" > "$PID_FILE"

remove_runtime_state() {
  if [[ -f "$PID_FILE" ]] && [[ "$(cat "$PID_FILE")" == "$$" ]]; then
    rm -f "$PID_FILE"
  fi
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

trap remove_runtime_state EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "[dev] Docker is required. Start Docker Desktop and try again."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[dev] Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

echo "[dev] Starting PostgreSQL and Redis..."
compose() {
  if [[ -f .env.docker ]]; then
    docker compose --env-file .env.docker "$@"
  else
    docker compose "$@"
  fi
}

if [[ -f .env.docker ]]; then
  compose up -d --wait postgres redis
  export DATABASE_URL="${DATABASE_URL:-postgres://openviz:openviz@localhost:5434/openviz}"
  export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
else
  compose up -d --wait postgres redis
fi

echo "[dev] Starting Next.js and the collaboration WebSocket server..."

APP_PORT="${PORT:-3000}"
COLLAB_PORT="${COLLAB_PORT:-1234}"
REPO_ROOT="$PWD"

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

port_owner() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -Fpct 2>/dev/null \
    | awk -F: '/^p/ { pid=substr($0, 2) } /^c/ { command=substr($0, 2) } END { if (pid) printf "%s (pid %s)", command, pid }'
}

port_pid() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -Fp 2>/dev/null \
    | awk -F: '/^p/ { print substr($0, 2); exit }'
}

port_belongs_to_openviz() {
  local pid
  local cwd
  pid="$(port_pid "$1")"
  [[ -n "$pid" ]] || return 1
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/ { print substr($0, 2); exit }')"
  [[ "$cwd" == "$REPO_ROOT" ]]
}

next_available_port() {
  local port="$1"
  while port_in_use "$port"; do
    port=$((port + 1))
  done
  printf '%s' "$port"
}

resolve_port() {
  local service="$1"
  local requested_port="$2"
  local owner
  owner="$(port_owner "$requested_port")"

  if ! port_in_use "$requested_port"; then
    printf '%s' "$requested_port"
    return
  fi

  if port_belongs_to_openviz "$requested_port"; then
    echo "[dev] $service is already listening on port $requested_port${owner:+ — $owner}; reusing it." >&2
    printf '%s' "$requested_port"
    return
  fi

  if [[ "${OPENVIZ_PORT_CONFLICT:-next}" == "error" ]]; then
    echo "[dev] Cannot start $service: port $requested_port is already in use by an unrelated process${owner:+ ($owner)}." >&2
    echo "[dev] Stop it, choose another port, or unset OPENVIZ_PORT_CONFLICT=error." >&2
    return 1
  fi

  local available_port
  available_port="$(next_available_port "$((requested_port + 1))")"
  echo "[dev] Port $requested_port belongs to another project${owner:+ — $owner}; using port $available_port for $service." >&2
  printf '%s' "$available_port"
}

cleanup() {
  local pid
  for pid in "${NEXT_PID:-}" "${COLLAB_PID:-}"; do
    [[ -n "$pid" ]] || continue
    if kill -0 "$pid" 2>/dev/null; then
      echo "[dev] Stopping process $pid gracefully..."
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  local deadline=$((SECONDS + 10))
  while [[ $SECONDS -lt $deadline ]]; do
    local running=0
    for pid in "${NEXT_PID:-}" "${COLLAB_PID:-}"; do
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        running=1
      fi
    done
    [[ $running -eq 0 ]] && break
    sleep 1
  done

  for pid in "${NEXT_PID:-}" "${COLLAB_PID:-}"; do
    [[ -n "$pid" ]] || continue
    if kill -0 "$pid" 2>/dev/null; then
      echo "[dev] Process $pid did not stop after 10 seconds; terminating it."
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done

  remove_runtime_state
}

handle_signal() {
  local signal="$1"
  echo "[dev] $signal received; shutting down OpenViz development servers..."
  cleanup
  exit 130
}

trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM
trap cleanup EXIT
if port_in_use "$APP_PORT"; then
  APP_PORT="$(resolve_port "Next.js" "$APP_PORT")"
fi
if port_belongs_to_openviz "$APP_PORT"; then
  :
else
  NODE_OPTIONS='--max-old-space-size=8192' pnpm exec next dev -p "$APP_PORT" &
  NEXT_PID=$!
fi

if port_in_use "$COLLAB_PORT"; then
  COLLAB_PORT="$(resolve_port "collaboration server" "$COLLAB_PORT")"
fi
if port_belongs_to_openviz "$COLLAB_PORT"; then
  :
else
  COLLAB_PORT="$COLLAB_PORT" pnpm exec tsx server/collab/index.ts &
  COLLAB_PID=$!
fi

while [[ -n "${NEXT_PID:-}" || -n "${COLLAB_PID:-}" ]]; do
  if [[ -n "${NEXT_PID:-}" ]] && ! kill -0 "$NEXT_PID" 2>/dev/null; then
    wait "$NEXT_PID" || exit_code=$?
    exit "${exit_code:-0}"
  fi
  if [[ -n "${COLLAB_PID:-}" ]] && ! kill -0 "$COLLAB_PID" 2>/dev/null; then
    wait "$COLLAB_PID" || exit_code=$?
    exit "${exit_code:-0}"
  fi
  sleep 1
done

if [[ -z "${NEXT_PID:-}" && -z "${COLLAB_PID:-}" ]]; then
  echo "[dev] Both OpenViz development servers are already running outside this launcher."
  exit 0
fi
while true; do
  sleep 3600
done