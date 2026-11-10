#!/usr/bin/env bash
# NOT YET RUN. Written without Docker. First check: run it once against a deployed stack and
# expect "db:cleanup: removed 0 ended sessions and 0 old audit events."
#
# Runs the daily cleanup (pnpm db:cleanup, apps/api/src/cli/cleanup.ts) inside the running API
# container. It deletes ended sessions and audit events older than 180 days, and prints only
# counts. It does NOT erase "deleted" tummy log entries yet (docs/adr/0005-sync.md, "Known gap").
# It uses the app user, is safe to run twice, and is safe while the API is serving.
# Meant for infra/systemd/tummy-cleanup.timer.
set -euo pipefail

# shellcheck source=infra/prod-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/prod-lib.sh"

require_env_file cleanup-scheduled
use_deployed_version cleanup-scheduled

compose exec -T api node dist/cli/cleanup.js
