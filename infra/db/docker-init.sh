#!/usr/bin/env bash
# Runs once, the first time the database container starts with an empty data volume
# (the postgres image runs every script in /docker-entrypoint-initdb.d). It connects as the
# container's administrator (POSTGRES_USER) over the local socket.
set -euo pipefail
export PGUSER="$POSTGRES_USER"
export PGDATABASE=postgres
bash /tummy-db/init-roles.sh
