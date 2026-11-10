#!/usr/bin/env bash
# NOT YET RUN. Written without Docker, a server or a certificate. It has been read and checked
# with "bash -n" only. The first check, on a server with Docker, is the "Practice" section of
# docs/runbook.md: deploy a version, then deploy a deliberately broken one and watch it go back.
#
# Puts a version of the app on this server.
#
#   infra/deploy.sh <version> [--allow-root]
#
# <version> is a git tag or commit that is ALREADY CHECKED OUT here (git checkout <version>),
# with no uncommitted changes. This script never changes what is checked out. The version is
# also the label on the Docker images, so an older version's images stay on the server and can
# be started again. Do not prune them.
#
# What it does, in order. It stops at the first thing that fails.
#   1. Refuses to run without infra/.env (mode 600, yours), or as root unless --allow-root.
#   2. Checks the settings (Compose names any missing one; it never prints a value).
#   3. Builds the images for this version. Nothing running is touched yet.
#   4. Starts the database if it is not running, and takes a backup (infra/backup-scheduled.sh).
#   5. Runs the migrations as the migrator user.
#   6. Starts this version, and waits up to HEALTH_TIMEOUT_SECONDS (default 120) for
#      /api/health to answer through the proxy, over HTTPS, with the real certificate.
#   7. If that fails, starts the previous version again and exits non-zero.
#   8. If it works, records this version in infra/.deployed-version.
#
# A MIGRATION THAT ALREADY RAN IS NOT ROLLED BACK. Going back to the previous version puts back
# the previous CODE, not the previous TABLES. That is safe only if every migration can be run
# under the old code too (add things; never rename or drop in the same release). If the old code
# cannot work with the new tables, the way back is to restore the backup taken in step 4
# (docs/runbook.md, "Roll back") and move the sync counter forward.
#
# No secret is printed: the script never uses "set -x" and never prints the settings file.
set -euo pipefail

# shellcheck source=infra/prod-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/prod-lib.sh"

usage="usage: infra/deploy.sh <version> [--allow-root]"
version=""
allow_root="no"
for arg in "$@"; do
  case "$arg" in
    --allow-root) allow_root="yes" ;;
    -*)
      echo "$usage" >&2
      exit 2
      ;;
    *)
      if [ -n "$version" ]; then
        echo "$usage" >&2
        exit 2
      fi
      version="$arg"
      ;;
  esac
done
if [ -z "$version" ] || ! [[ "$version" =~ ^[A-Za-z0-9._-]{1,60}$ ]]; then
  echo "$usage" >&2
  echo "deploy: <version> is a git tag or commit; letters, digits, . _ - only." >&2
  exit 2
fi

if [ "$(id -u)" = "0" ] && [ "$allow_root" != "yes" ]; then
  echo "deploy: refusing to run as root. Use the deploy user, or add --allow-root if you mean it." >&2
  exit 1
fi

require_env_file deploy
for tool in docker curl git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "deploy: $tool is not installed." >&2
    exit 1
  fi
done

# ---- The version asked for must be the one checked out, and clean.
want="$(git -C "$INFRA_DIR" rev-parse --verify --quiet "${version}^{commit}" || true)"
have="$(git -C "$INFRA_DIR" rev-parse HEAD)"
if [ -z "$want" ]; then
  echo "deploy: git does not know \"$version\"." >&2
  exit 1
fi
if [ "$want" != "$have" ]; then
  echo "deploy: \"$version\" is not what is checked out. Run: git checkout $version" >&2
  exit 1
fi
if [ -n "$(git -C "$INFRA_DIR" status --porcelain)" ]; then
  echo "deploy: the checkout has uncommitted changes. Deploy only what is committed." >&2
  exit 1
fi

# ---- Settings that must be right before anything starts.
origin="$(env_value APP_ORIGIN)"
site="$(env_value SITE_ADDRESS)"
if [[ "$origin" != https://* ]] || [[ "${origin#https://}" == *[:/]* ]]; then
  echo "deploy: APP_ORIGIN must be https://<name> with no port and no path." >&2
  exit 1
fi
host="${origin#https://}"
if [ "$host" != "$site" ]; then
  echo "deploy: SITE_ADDRESS must be the same name as in APP_ORIGIN (\"$host\")." >&2
  exit 1
fi
# Optional: a certificate authority file for the health check to trust, for a site whose
# certificate does not come from a public authority (a practice run on your own computer with
# SITE_ADDRESS=localhost, where Caddy makes its own; or an ODU-internal authority). Empty means
# the system's normal list. The check never runs without verifying the certificate.
ca_file="$(env_value HEALTH_CA_FILE)"
if [ -n "$ca_file" ] && [ ! -r "$ca_file" ]; then
  echo "deploy: HEALTH_CA_FILE ($ca_file) cannot be read." >&2
  exit 1
fi
timeout="$(env_value HEALTH_TIMEOUT_SECONDS)"
timeout="${timeout:-120}"
if ! [[ "$timeout" =~ ^[0-9]+$ ]] || [ "$timeout" -lt 10 ]; then
  echo "deploy: HEALTH_TIMEOUT_SECONDS must be a whole number, 10 or more." >&2
  exit 1
fi

export TUMMY_VERSION="$version"
TUMMY_BUILD_ID="$(git -C "$INFRA_DIR" rev-parse --short=12 HEAD)"
export TUMMY_BUILD_ID
previous=""
if [ -s "$STATE_FILE" ]; then
  previous="$(head -n 1 "$STATE_FILE")"
fi

# Compose checks that every required setting is present. --quiet: it must not print the values.
compose --profile tools config --quiet

# wait_for_health: asks the local proxy for /api/health under the site's own name, so the real
# certificate is checked, without depending on the server being able to reach itself by name.
wait_for_health() {
  local deadline=$((SECONDS + timeout)) body
  local -a trust=()
  if [ -n "$ca_file" ]; then
    trust=(--cacert "$ca_file")
  fi
  while [ "$SECONDS" -lt "$deadline" ]; do
    # --noproxy: this request is to this machine and must never leave it through a web proxy.
    body="$(curl -sS --fail --max-time 5 --noproxy '*' ${trust[@]+"${trust[@]}"} --resolve "$host:443:127.0.0.1" "https://$host/api/health" 2>/dev/null || true)"
    if [ "$body" = '{"ok":true}' ]; then
      return 0
    fi
    sleep 5
  done
  return 1
}

migration_warning() {
  echo "deploy: A MIGRATION THAT ALREADY RAN WAS NOT ROLLED BACK. If this version ran a migration," >&2
  echo "deploy: the tables are now the new ones. If the old version misbehaves on them, restore the" >&2
  echo "deploy: backup from step 4 (docs/runbook.md, \"Roll back\"). Do not guess; ask Devin." >&2
}

echo "deploy: version $version (build $TUMMY_BUILD_ID). Previous: ${previous:-none}."

echo "deploy: 3/8 building images. Nothing running is changed yet."
compose --profile tools build

echo "deploy: 4/8 starting the database if needed, then taking a backup."
compose up -d --no-build --wait db
if ! backup_out="$(bash "$INFRA_DIR/backup-scheduled.sh" --label "pre-$version")"; then
  echo "deploy: the backup failed, so nothing was changed. The running version is untouched." >&2
  exit 1
fi
echo "$backup_out"
backup_file="$(printf '%s\n' "$backup_out" | sed -n 's/^backup-scheduled: wrote //p' | tail -n 1)"

echo "deploy: 5/8 running migrations as the migrator user."
if ! compose --profile tools run --rm -T migrate; then
  echo "deploy: the migration failed. The running version was not stopped." >&2
  echo "deploy: the migration may have partly run. Backup from before it: ${backup_file:-unknown}" >&2
  migration_warning
  exit 1
fi

echo "deploy: 6/8 starting version $version and waiting up to ${timeout}s for /api/health."
healthy="no"
# --force-recreate caddy web api: the proxy reads infra/Caddyfile only when it starts, and Compose
# does not notice that a mounted file changed. Starting the three fresh on every deploy means a
# changed Caddyfile always takes effect. The database is not named, so it keeps running.
if compose up -d --no-build --remove-orphans --force-recreate caddy web api && wait_for_health; then
  healthy="yes"
fi

if [ "$healthy" = "yes" ]; then
  printf '%s\n' "$version" >"$STATE_FILE.tmp"
  mv "$STATE_FILE.tmp" "$STATE_FILE"
  echo "deploy: 8/8 done. Version $version is answering at $origin/api/health."
  exit 0
fi

# ---- It did not come up healthy: go back.
echo "deploy: version $version did NOT answer /api/health in time." >&2
if [ -z "$previous" ]; then
  echo "deploy: there is no previous version to go back to. The new one is left as it is: read its logs" >&2
  echo "deploy: (docs/runbook.md, \"Read the logs\")." >&2
  migration_warning
  exit 1
fi
if ! docker image inspect "tummy-time-api:$previous" "tummy-time-web:$previous" >/dev/null 2>&1; then
  echo "deploy: the images for the previous version ($previous) are not on this server any more." >&2
  echo "deploy: check it out and run infra/deploy.sh $previous (it rebuilds)." >&2
  migration_warning
  exit 1
fi
echo "deploy: starting the previous version ($previous) again." >&2
(
  export TUMMY_VERSION="$previous"
  compose up -d --no-build --remove-orphans --force-recreate caddy web api
) || true
if wait_for_health; then
  echo "deploy: the previous version ($previous) is answering again. $STATE_FILE still says $previous." >&2
else
  echo "deploy: the previous version ($previous) is NOT answering either. This is an outage:" >&2
  echo "deploy: follow docs/runbook.md, \"Roll back\" and \"Read the logs\", and call the people in" >&2
  echo "deploy: \"Who to call\"." >&2
fi
echo "deploy: backup from before this deploy: ${backup_file:-unknown}" >&2
migration_warning
exit 1
