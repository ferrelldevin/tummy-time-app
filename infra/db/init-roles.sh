#!/usr/bin/env bash
# Creates the two database users and the app's database. Safe to run again: it only fills in
# what is missing and resets the two passwords to the values in the environment.
#
# Run it as a database administrator (the "postgres" superuser or similar), once per machine:
#   set -a; . ./.env; set +a
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres bash infra/db/init-roles.sh
# The administrator's own password, if it has one, comes from PGPASSWORD or ~/.pgpass.
#
# Reads from the environment (never from this file):
#   DB_NAME, DB_APP_USER, DB_APP_PASSWORD, DB_MIGRATOR_USER, DB_MIGRATOR_PASSWORD
# Needs psql 15 or newer (for \getenv).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for name in DB_NAME DB_APP_USER DB_APP_PASSWORD DB_MIGRATOR_USER DB_MIGRATOR_PASSWORD; do
  if [ -z "${!name:-}" ]; then
    echo "init-roles: $name is missing. Set it in .env (see .env.example)." >&2
    exit 1
  fi
done
for name in DB_NAME DB_APP_USER DB_MIGRATOR_USER; do
  if ! [[ "${!name}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
    echo "init-roles: $name must use lowercase letters, digits and _ only." >&2
    exit 1
  fi
done
if [ "$DB_APP_USER" = "$DB_MIGRATOR_USER" ]; then
  echo "init-roles: DB_APP_USER and DB_MIGRATOR_USER must be two different users." >&2
  exit 1
fi

# Passwords travel to psql through the environment, never on the command line, where other
# users of the machine could see them in the process list.
psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 --dbname "${PGDATABASE:-postgres}" \
  --file "$here/init-roles.sql"

echo "init-roles: users \"$DB_MIGRATOR_USER\" and \"$DB_APP_USER\" and database \"$DB_NAME\" are ready."
