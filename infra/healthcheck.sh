#!/usr/bin/env bash
# Run in Docker during the Block 8 review, with a test certificate for localhost. Not yet run
# on a real server.
# In the review it worked, and it exited 1 on a wrong address.
#
# An uptime check for the live site. It asks /api/health through the public address, prints ONE
# line, and exits 0 when the answer is {"ok":true}, 1 otherwise. No third-party service, no
# tracker: it is curl.
#
#   HEALTH_URL=https://tummytime.example.org/api/health infra/healthcheck.sh
#   infra/healthcheck.sh https://tummytime.example.org/api/health
#
# HOW TO WIRE AN ALERT. Run this on a DIFFERENT machine from the server (a server that has died
# cannot report that it has died), every few minutes, from cron or a systemd timer, and send a
# message when it exits non-zero. For example, in crontab on that other machine:
#   */5 * * * * /path/to/healthcheck.sh >>/var/log/tummy-health.log 2>&1 || /path/to/tell-someone.sh
# "tell-someone.sh" is not written. WHO RECEIVES THE ALERT, AND HOW (email, text, a chat
# channel), IS AN OPEN DECISION for Devin and Dr. Gupta. Until it is made, nobody is alerted and
# the runbook says so. A failed check can mean the site is down or that the checking machine's
# own network is down: look at both before acting.
set -uo pipefail

url="${1:-${HEALTH_URL:-}}"
if [ -z "$url" ]; then
  echo "healthcheck: FAILED no address. Give one as the first argument or set HEALTH_URL." >&2
  exit 2
fi
case "$url" in
  https://*) ;;
  *)
    echo "healthcheck: FAILED the address must start with https://" >&2
    exit 2
    ;;
esac

stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
body="$(curl -sS --max-time 10 --fail "$url" 2>/dev/null)"
status=$?
if [ "$status" -eq 0 ] && [ "$body" = '{"ok":true}' ]; then
  echo "healthcheck: ok $stamp $url"
  exit 0
fi
echo "healthcheck: FAILED $stamp $url (curl exit $status)"
exit 1
