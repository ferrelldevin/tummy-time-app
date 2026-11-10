# Block 8 (first part): Deploy scripts, the daily cleanup and the runbook

**This chapter is partly written.** Block 8 has two halves. This is the half that could be built with no server: one real, tested piece of code (the daily cleanup), one small web feature (a test-site banner), and a set of server files and documents that were **written but never run**, because no Docker, no server and no certificate were available. The other half (a real deploy, a timed restore, the stage gate review, the two-phone test) is not done, and this chapter says where it will go. Read the status of each piece in section 1 before trusting any of it.

## 1. What was built, and whether it has run

| Piece | Where | Has it run? |
|---|---|---|
| Daily cleanup command | `apps/api/src/cli/cleanup.ts`, `apps/api/src/db/maintenance.ts` | **Yes.** Real tests against a real PostgreSQL |
| Cleanup's place in the account-scope guard | `apps/api/test/account-scope-guard.test.ts` | **Yes** |
| Test-site banner ("Test site. Sample data.") | `apps/web/src/components/SiteBanner.tsx`, `apps/web/vite.config.ts` | **Yes**, in unit tests with an accessibility scan. Not on a deployed site |
| Production Compose file | `infra/docker-compose.prod.yml` | **No.** Its syntax and required settings were checked with `docker compose config`; no container ever started |
| Caddy proxy settings | `infra/Caddyfile` | **No** |
| Deploy script | `infra/deploy.sh` (and `prod-lib.sh`) | **No** against Docker. Its steps and its go-back path were exercised with stand-in `docker` and `curl` programs, to catch shell mistakes |
| Scheduled backup and cleanup, timers | `infra/backup-scheduled.sh`, `cleanup-scheduled.sh`, `infra/systemd/` | **No**, same stand-in check |
| Uptime check | `infra/healthcheck.sh` | **No**, same stand-in check |
| Runbook, sections 12 to 24 | `docs/runbook.md` | Documents. Each procedure says whether it was practiced; nearly all say not |
| New-student path | `docs/next-student.md` | A person has not followed it yet |
| Hosting questions | `docs/hosting-questions.md` | Not sent |

## 2. Why this way

**The cleanup is the one place the "always filter by account" rule cannot apply.** Every query on the sessions and audit tables adds the signed-in account's ID. A cleanup job exists to remove rows that nobody will ever present again, so it has to reach every account at once. Rather than poke a hole in the guard, the job lives in one tiny file with its own entry in the guard's allowlist: one function, no ID, no filter coming in, two counts coming out, deletes only. The next reviewer has one small thing to read.

**It leaves "deleted" log entries alone.** The data map says they go after 90 days. But a phone that has not synced for longer than that would never be told about the delete and would keep showing the entry (`docs/adr/0005-sync.md`, "Known gap"). Erasing them needs a rule for such phones first. That rule is someone else's decision, so the job does not touch those rows, and a comment says why.

**The production file is separate from the development file.** An override file can add to a list but not take from it, so it could not remove the development file's published ports. Keeping them apart makes it hard to leave a development setting in production. The cost is some repeated lines.

**Three networks, one open door.** Only Caddy has a port on the server. The API and web servers sit on a network with no way out; the database sits on a second one. "Internal" networks in Docker have no route to the internet, so even a compromised container there cannot call out.

**Counting proxies.** The rate limiter needs the visitor's true address, and Fastify finds it by counting proxies. Here the count is one (Caddy sends API requests straight to the API). Sending them through the web container's nginx as well would not give two: nginx overwrites the forwarded address with the one it saw, which is Caddy's, so every visitor would look like the same person. The count and its two traps are written in the compose file and the runbook.

**Secrets never in the repo.** Every secret comes from `infra/.env` on the server. The compose file has no default for any of them: a missing value stops Compose with a message naming it. The scripts read single values from the file with `grep` and never `source` it, and never print one.

**A deploy that can go back, and says what it cannot undo.** If the new version does not answer `/api/health`, the script starts the previous one. But a migration that already ran is not undone by that. The script says so plainly every time, takes a backup first, and the runbook explains how to decide.

## 3. The steps, in the order they were done

1. Created the branch `block-8-deploy` from the Block 7 branch.
2. **The banner.** Put the words in the string catalog (`en.testSiteBanner`). Added a `SITE_BANNER` setting read when the app is built (never at run time), passed through `vite.config.ts` as a constant and through `web.Dockerfile` as a build argument. Any value but empty or `test` stops the build. Added `SiteBanner`, rendered it in the app shell, styled it with existing colors. Tests: both states, the default is off, a full-app test with the banner forced on and an accessibility scan on four screens.
3. **The cleanup.** Wrote `maintenance.ts` and the command `pnpm db:cleanup`. A session is over when "now" has reached `expires_at` or its last use plus the idle limit, using the same constants and the same comparisons as sign-in. An audit event goes only when strictly older than 180 days. Tests with a clock the test controls, one second before, exactly on and one second after each limit.
4. **Proved the tests catch mistakes.** Broke each boundary and each limit on purpose and watched a test fail (section 5).
5. Wrote the production Compose file and Caddy settings, checked syntax with `docker compose config --quiet`, and read the result to confirm which services publish ports.
6. Wrote the deploy, backup, cleanup and health scripts. Ran each against stand-in `docker` and `curl` commands that log what they were asked and answer healthy or not, to try: refusing without the settings file, refusing as root, refusing the wrong checkout, a good deploy, a failed deploy going back, the backup folder checks and the 30-day delete touching only matching files.
7. Wrote the runbook sections, the new-student page and the hosting questions.

## 4. How to build it yourself

For the cleanup:

1. A function that takes the database and "now" and returns two counts. Use `delete().where(...)` and read the row count. No `returning`.
2. A command file that opens the database as the app user, calls it with the real clock and prints counts.
3. A test with a made-up account, rows at fixed distances from "now", and exact count checks. Run the function twice.
4. Add the file to the guard's allowlist for exactly the tables it uses, and add a guard test that it cannot name the other tables.

For the server files, you cannot check them without Docker. On a machine with Docker, follow the practice list in `docs/runbook.md`, section 23, and fix what the first real run shows.

## 5. How to run it and follow along

The cleanup:

Runs in: your terminal, repo root, with the database running and migrated
```bash
pnpm db:cleanup
pnpm --filter @tummy/api exec vitest run test/db/cleanup.test.ts
```

The first prints `db:cleanup: removed 0 ended sessions and 0 old audit events.` on a fresh database. Run it twice to see it is safe to repeat.

The banner:

Runs in: your terminal, repo root
```bash
SITE_BANNER=test pnpm --filter @tummy/web exec vite build
pnpm --filter @tummy/web exec vitest run src/components/SiteBanner.test.tsx src/App.banner.test.tsx
```

Open the built app with `vite preview` and every screen shows "Test site. Sample data." in a strip at the top.

The server files: first check that Compose accepts the production file.

Runs in: a machine with Docker, in the `infra` folder, with an `infra/.env` filled in
```bash
TUMMY_VERSION=check docker compose --env-file .env -f docker-compose.prod.yml --profile tools config --quiet
```

Never run `config` without `--quiet`: it prints every secret.

## 6. What is still open

Hosting answers from ODU (`docs/hosting-questions.md`); where backups go, how they are encrypted and where `CODE_LOOKUP_SECRET` is kept apart from them; who receives an alert; the rule for erasing "deleted" log entries; and everything in the runbook marked "NOT YET PRACTICED".
