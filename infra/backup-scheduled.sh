#!/usr/bin/env bash
# NOT YET RUN. Written without Docker; nothing here has been executed. The first check, on a
# machine with Docker and a deployed stack, is the "Practice" section of docs/runbook.md.
#
# Takes one database backup into BACKUP_DIR, then deletes backups older than BACKUP_KEEP_DAYS.
#
#   infra/backup-scheduled.sh [--label <word>]
#
# Meant for a daily timer (infra/systemd/tummy-backup.timer) and for infra/deploy.sh, which
# takes one before every deploy with --label.
#
# It reuses infra/backup.sh, run inside the "dbtools" container on the database's private
# network (the database publishes no port, so nothing on the host can reach it directly).
# Settings come from infra/.env: BACKUP_DIR (required) and BACKUP_KEEP_DAYS (default 30).
#
# WHERE BACKUPS GO: BACKUP_DIR is a folder on the server's disk, OUTSIDE every Docker volume of
# this stack (it is refused if it is under /var/lib/docker). That is only the first step of
# "off the app's own disk" (threat model #26): a different physical disk, and a copy on another
# machine, are decisions that have NOT been made. This script does not do either.
#
# ENCRYPTION IS NOT SOLVED HERE. Each backup file is mode 600 and holds every family's tummy
# logs in the clear. Encrypting backups, and where the key for that is kept, is an open
# decision (with Dr. Gupta and ODU IT). Do not copy these files anywhere until it is made.
#
# CODE_LOOKUP_SECRET IS NOT IN THE BACKUP, on purpose. It must be backed up SEPARATELY from the
# database, by whoever holds the server's other secrets. A database backup without it cannot
# sign anyone in. docs/runbook.md, "Rotate a secret".
#
# RETENTION: after a successful backup, files in BACKUP_DIR (that folder only, not below it)
# whose names start "tummy-time-" and end ".dump" and that are older than BACKUP_KEEP_DAYS are
# deleted. Nothing else in the folder is ever touched. A failed backup deletes nothing.
set -euo pipefail
umask 077

# shellcheck source=infra/prod-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/prod-lib.sh"

label=""
if [ "${1:-}" = "--label" ]; then
  label="${2:-}"
  shift 2 || true
fi
if [ "$#" -ne 0 ] || { [ -n "$label" ] && ! [[ "$label" =~ ^[A-Za-z0-9._-]{1,40}$ ]]; }; then
  echo "usage: infra/backup-scheduled.sh [--label <letters, digits, . _ - only>]" >&2
  exit 2
fi

require_env_file backup-scheduled
use_deployed_version backup-scheduled

dir="$(env_value BACKUP_DIR)"
keep="$(env_value BACKUP_KEEP_DAYS)"
keep="${keep:-30}"

if [[ "$dir" != /* ]] || [ "$dir" = "/" ]; then
  echo "backup-scheduled: BACKUP_DIR must be a full path such as /srv/tummy-backups, not \"/\"." >&2
  exit 1
fi
case "$dir" in
  /var/lib/docker | /var/lib/docker/*)
    echo "backup-scheduled: BACKUP_DIR is inside Docker's own storage. Choose a folder outside it." >&2
    exit 1
    ;;
esac
if [ ! -d "$dir" ] || [ ! -w "$dir" ]; then
  echo "backup-scheduled: BACKUP_DIR ($dir) is not a folder this user can write to." >&2
  exit 1
fi
if ! [[ "$keep" =~ ^[0-9]+$ ]] || [ "$keep" -lt 7 ]; then
  echo "backup-scheduled: BACKUP_KEEP_DAYS must be a whole number, 7 or more." >&2
  exit 1
fi

name="tummy-time-$(date -u +%Y%m%dT%H%M%SZ)${label:+-$label}.dump"

# The container runs as this user, so the file is yours and the pruning below can delete it.
compose --profile tools run --rm -T --user "$(id -u):$(id -g)" dbtools \
  bash /infra/backup.sh "/backups/$name"

if [ ! -s "$dir/$name" ]; then
  echo "backup-scheduled: the backup file is missing or empty. Treat this backup as failed." >&2
  exit 1
fi

old="$(find "$dir" -maxdepth 1 -type f -name 'tummy-time-*.dump' -mtime "+$keep" | wc -l | tr -d ' ')"
find "$dir" -maxdepth 1 -type f -name 'tummy-time-*.dump' -mtime "+$keep" -delete
echo "backup-scheduled: removed $old backups older than $keep days."
echo "backup-scheduled: wrote $dir/$name"
