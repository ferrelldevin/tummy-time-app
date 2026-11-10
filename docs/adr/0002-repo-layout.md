# 0002: Repo layout

Status: Proposed (Nov 10, 2026).

## Context
The web app and the API share types and validation rules. Content and docs must be easy for a newcomer to find.

## Decision
One repo, pnpm workspaces:

```text
apps/web/         React PWA
apps/api/         Fastify API
packages/shared/  Types and validation used by both
content/          Lessons and safety card as files
docs/             Plan, decisions, data map, threat model, walkthrough, runbook
infra/            Docker Compose, proxy config, backup scripts
.github/          CI, PR template, Dependabot
```

## Options not taken
- **Two repos (web, api).** Shared types would drift and every feature would need two pull requests.
- **One flat app.** Simpler at first, but it blurs the line between browser code and server code, which matters for security review.

## Consequences
- One clone, one install, one CI run.
- The repo currently lives on the project lead's GitHub account. Moving it to a lab organization later is a GitHub transfer and keeps history.

## Reopen if
- The lab requires its own GitHub organization or a non-GitHub host. CI (GitHub Actions) would need a replacement.
