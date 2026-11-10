#!/bin/sh
# Runs before every commit: lint the staged files, then scan them for secrets.
set -eu

pnpm build:shared
pnpm exec lint-staged

if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks git --help >/dev/null 2>&1; then
    gitleaks git --pre-commit --staged --redact --no-banner
  else
    gitleaks protect --staged --redact --no-banner
  fi
else
  echo "pre-commit: gitleaks is NOT installed, so the secret scan was skipped on this commit." >&2
  echo "pre-commit: install it (https://github.com/gitleaks/gitleaks#installing). CI still scans every push." >&2
fi
