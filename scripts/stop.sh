#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/.run"
PID_FILE="$RUNTIME_DIR/openviz-dev.pid"
LOCK_DIR="$RUNTIME_DIR/openviz-dev.lock"

is_openviz_launcher() {
  local pid="$1"
  local command cwd

  kill -0 "$pid" 2>/dev/null || return 1
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/ { print substr($0, 2); exit }')"

  [[ "$cwd" == "$REPO_ROOT" ]] || return 1
  [[ "$command" == *"scripts/dev.sh"* || "$command" == *"bash scripts/dev.sh"* ]]
}

wait_for_exit() {
  local pid="$1"
  local deadline=$((SECONDS + 10))

  while kill -0 "$pid" 2>/dev/null && [[ $SECONDS -lt $deadline ]]; do
    sleep 1
  done
  ! kill -0 "$pid" 2>/dev/null
}

remove_runtime_state() {
  rm -f "$PID_FILE"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

stop_host_launcher() {
  local pid

  if [[ ! -f "$PID_FILE" ]]; then
    echo "[stop] OpenViz host development server is not running."
    return
  fi

  pid="$(cat "$PID_FILE")"
  if [[ ! "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "[stop] Removing stale OpenViz launcher state."
    remove_runtime_state
    return
  fi

  if ! is_openviz_launcher "$pid"; then
    echo "[stop] Refusing to signal PID $pid because it is not an OpenViz launcher." >&2
    echo "[stop] Remove .run/openviz-dev.pid and .run/openviz-dev.lock manually if they are stale." >&2
    return 1
  fi

  echo "[stop] Stopping OpenViz host development server (launcher PID $pid)..."
  kill -TERM "$pid"
  if ! wait_for_exit "$pid"; then
    echo "[stop] Launcher did not stop after 10 seconds; terminating it."
    kill -KILL "$pid" 2>/dev/null || true
    wait_for_exit "$pid" || true
  fi
  remove_runtime_state
}

compose() {
  if [[ -f "$REPO_ROOT/.env.docker" ]]; then
    docker compose --env-file "$REPO_ROOT/.env.docker" "$@"
  else
    docker compose "$@"
  fi
}

stop_host_launcher

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "[stop] Stopping PostgreSQL and Redis..."
  compose down
else
  echo "[stop] Docker is unavailable; skipped Compose shutdown." >&2
fi