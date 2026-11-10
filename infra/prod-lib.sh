#!/usr/bin/env bash
# NOT YET RUN. Shared helpers for the production scripts (deploy.sh, backup-scheduled.sh,
# cleanup-scheduled.sh). Source it; do not run it. It sets no shell options of its own.
#
# The server's settings live in infra/.env (not in git, mode 600). These helpers read single
# values from it with grep rather than "source" it, so a value with a space or a $ in it is
# never run as shell code, and no value is ever printed.

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$INFRA_DIR/.env"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
# The version that is running now (one line). Written by deploy.sh after a healthy deploy.
STATE_FILE="$INFRA_DIR/.deployed-version"

# require_env_file <script-name>: stops unless infra/.env exists, is yours, and is private.
require_env_file() {
  local who="$1" mode owner
  if [ ! -f "$ENV_FILE" ]; then
    echo "$who: $ENV_FILE does not exist. Make it from .env.example: docs/runbook.md, \"First-time server setup\"." >&2
    exit 1
  fi
  mode="$(stat -c '%a' "$ENV_FILE")"
  owner="$(stat -c '%u' "$ENV_FILE")"
  if [ "$mode" != "600" ] && [ "$mode" != "400" ]; then
    echo "$who: $ENV_FILE has mode $mode. It holds the server's secrets: run chmod 600 on it." >&2
    exit 1
  fi
  if [ "$owner" != "$(id -u)" ]; then
    echo "$who: $ENV_FILE belongs to another user. Run this as the user that owns it." >&2
    exit 1
  fi
}

# env_value <NAME>: the value of NAME in infra/.env (the last one wins), without quotes. Empty
# when missing. Only ever call it with a fixed name.
env_value() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

# compose <args>: docker compose with the production file and infra/.env. TUMMY_VERSION must
# be set in the environment. Never call "compose config" without --quiet: it prints secrets.
compose() {
  docker compose --project-directory "$INFRA_DIR" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# use_deployed_version <script-name>: sets TUMMY_VERSION to the running version if the caller
# has not set it, and stops if nothing has been deployed yet.
use_deployed_version() {
  if [ -z "${TUMMY_VERSION:-}" ]; then
    if [ ! -s "$STATE_FILE" ]; then
      echo "$1: nothing has been deployed yet ($STATE_FILE is missing). Run infra/deploy.sh first." >&2
      exit 1
    fi
    TUMMY_VERSION="$(head -n 1 "$STATE_FILE")"
  fi
  export TUMMY_VERSION
}
