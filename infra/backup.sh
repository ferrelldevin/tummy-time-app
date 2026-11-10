#!/usr/bin/env bash
# Writes a backup of the app's database to one file (PostgreSQL "custom" format).
#
#   infra/backup.sh [output-file]
#
# Connection settings and the password come from the environment, never from this file:
# PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD (or a ~/.pgpass file). Use the migrator
# user, which owns every table. docs/runbook.md shows the exact commands.
#
# The backup holds every family's tummy logs. It is written readable by you only; keep it off
# shared folders and never commit it (backups/ is in .gitignore).
set -euo pipefail
umask 077

for name in PGHOST PGDATABASE PGUSER; do
  if [ -z "${!name:-}" ]; then
    echo "backup: $name is not set. See docs/runbook.md." >&2
    exit 1
  fi
done

out="${1:-backups/${PGDATABASE}-$(date -u +%Y%m%dT%H%M%SZ).dump}"
if [ -e "$out" ]; then
  echo "backup: $out already exists. Choose another file name." >&2
  exit 1
fi
mkdir -p "$(dirname "$out")"

# Write to a temporary name first so a failed run never leaves a half file that looks complete.
partial="$out.partial"
trap 'rm -f "$partial"' EXIT
pg_dump --format=custom --compress=6 --no-password --file="$partial"
pg_restore --list "$partial" >/dev/null # proves the file is a readable backup
mv "$partial" "$out"
trap - EXIT

echo "backup: wrote $out ($(wc -c <"$out" | tr -d ' ') bytes)."
