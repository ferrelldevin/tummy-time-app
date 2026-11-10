#!/usr/bin/env bash
# Restores a backup made by infra/backup.sh into a database.
#
#   infra/restore.sh <backup-file> [--replace-existing-data]
#
# The target database (PGDATABASE) must already exist with its two users: run
# infra/db/init-roles.sh first. By default this refuses to restore into a database that already
# has tables, so a restore can never overwrite live data by accident. --replace-existing-data
# drops what is there first; only use it when you mean to throw that data away.
#
# Connection settings and the password come from the environment (PGHOST, PGPORT, PGDATABASE,
# PGUSER, PGPASSWORD or ~/.pgpass), never from this file. Use the migrator user.
set -euo pipefail

usage="usage: infra/restore.sh <backup-file> [--replace-existing-data]"
file="${1:-}"
replace="no"
if [ "$#" -gt 2 ] || [ -z "$file" ]; then
  echo "$usage" >&2
  exit 2
fi
if [ "$#" -eq 2 ]; then
  if [ "$2" != "--replace-existing-data" ]; then
    echo "$usage" >&2
    exit 2
  fi
  replace="yes"
fi
for name in PGHOST PGDATABASE PGUSER; do
  if [ -z "${!name:-}" ]; then
    echo "restore: $name is not set. See docs/runbook.md." >&2
    exit 1
  fi
done
if [ ! -r "$file" ]; then
  echo "restore: cannot read $file." >&2
  exit 1
fi
pg_restore --list "$file" >/dev/null

tables="$(psql --no-psqlrc --no-password --tuples-only --no-align -v ON_ERROR_STOP=1 -c \
  "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')")"

if [ "$tables" != "0" ] && [ "$replace" != "yes" ]; then
  echo "restore: refused. Database \"$PGDATABASE\" already has $tables tables." >&2
  echo "restore: restore into a new, empty database, or add --replace-existing-data to drop them first." >&2
  exit 1
fi

clean=()
if [ "$tables" != "0" ]; then
  clean=(--clean --if-exists)
fi
# One transaction: either the whole backup goes in, or nothing changes.
pg_restore --no-password --single-transaction --exit-on-error ${clean[@]+"${clean[@]}"} \
  --dbname="$PGDATABASE" "$file"

echo "restore: $file restored into \"$PGDATABASE\"."
