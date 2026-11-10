# Block 8: Deploy, runbook and the daily cleanup

This chapter explains how the app is packaged to run on a server, how a new version goes live, how it goes back when it is broken, and how a backup is put back. It also explains something harder: why a file that has only been read is not a file that works. Read it with the code open. Section 5 tells you how to run it.

**Where this stands.** The server files were first written on a machine with no Docker, so they were only read. A reviewer then ran them in Docker, in one container, during the Block 8 review (`docs/security-review-stage-a.md`). The site used a test certificate that Caddy made for the name `localhost`. It was not a public certificate, not a real server and not real phones. Nothing has been run on a real server yet. The last section lists what is still not proven.

## 1. What was built

| Piece | Where | Has it run? |
|---|---|---|
| Daily cleanup command | `apps/api/src/cli/cleanup.ts`, `apps/api/src/db/maintenance.ts` | Yes. Real tests against a real PostgreSQL, and run by hand in the review |
| Cleanup's place in the account-scope guard | `apps/api/test/account-scope-guard.test.ts` | Yes |
| Test-site banner ("Test site. Sample data.") | `apps/web/src/components/SiteBanner.tsx`, `apps/web/vite.config.ts` | Yes, in unit tests with an accessibility scan, and on the practice stack |
| Production Compose file | `infra/docker-compose.prod.yml` | Yes, in the review container. Every container started with a read-only file system and dropped privileges |
| Caddy proxy settings | `infra/Caddyfile` | Yes, in the review container, with a test certificate |
| Deploy script | `infra/deploy.sh`, `infra/prod-lib.sh` | Yes: a good version, and a version broken on purpose that went back by itself |
| Scheduled backup and cleanup scripts | `infra/backup-scheduled.sh`, `infra/cleanup-scheduled.sh` | Yes, run by hand in the review |
| Daily timers | `infra/systemd/` | No. Checked for syntax only. Not installed anywhere |
| Uptime check | `infra/healthcheck.sh` | Yes in the review. Not from a second machine |
| The web image and the developer stack | `infra/web.Dockerfile`, `infra/docker-compose.yml` | Yes. Running them found two bugs (section 3) |
| Runbook, sections 12 to 24 | `docs/runbook.md` | Documents. Each procedure says what was practiced and what was not |
| Practice stack on your own computer | `docs/runbook.md`, section 13a | Yes, it is how the review ran it |
| Image build check in CI | `.github/workflows/ci.yml`, job "Container images build" | Added so the two image bugs below cannot come back unseen |
| New-student path | `docs/next-student.md` | A person has not followed it yet |
| Hosting questions | `docs/hosting-questions.md` | Not sent |

## 2. Why this way

**Read is not the same as run.** The server files were written, read twice and checked for syntax. That is not testing. The review ran them, and the run found things that reading had not (section 3). The lesson is general: a file nobody has run has bugs you cannot see yet, and the longer it waits, the more it has.

**The cleanup is the one place the "always filter by account" rule cannot apply.** Every query on the sessions and audit tables adds the signed-in account's ID. A cleanup job exists to remove rows that nobody will ever present again, so it has to reach every account at once. Rather than poke a hole in the guard, the job lives in one tiny file with its own entry in the guard's allowlist: one function, no ID, no filter coming in, two counts coming out, deletes only. The next reviewer has one small thing to read.

**It leaves "deleted" log entries alone.** The data map says they go after 90 days. But a phone that has not synced for longer than that would never be told about the delete and would keep showing the entry (`docs/adr/0005-sync.md`, "Known gap"). Erasing them needs a rule for such phones first. That rule is someone else's decision, so the job does not touch those rows, and a comment says why.

**The production file is separate from the development file.** An override file can add to a list but not take from it, so it could not remove the development file's published ports. Keeping them apart makes it hard to leave a development setting in production. The cost is some repeated lines.

**Secrets never in the repo.** Every secret comes from `infra/.env` on the server. The compose file has no default for any of them: a missing value stops Compose with a message naming it. The scripts read single values from the file with `grep` and never `source` it, and never print one.

### What a reverse proxy is, and why exactly one is counted

A reverse proxy is a server that stands in front of another server. The visitor talks to the proxy. The proxy talks to your app and hands the answer back. Here the proxy is Caddy. It ends HTTPS (it holds the certificate), so the app behind it can speak plain HTTP on a private network.

There is a catch. The app sees the proxy's address, not the visitor's. The proxy passes the visitor's address along in a header called `X-Forwarded-For`. But a header is just text, and a visitor can send one too. So the app has to be told how many proxies of its own sit in front of it, and it believes only the address those proxies wrote. Fastify calls this "trust proxy hops". Here the number is one: Caddy.

Why it matters: the sign-in limit counts tries per address. If the number is too low, every visitor looks like Caddy and shares one limit. If it is too high, a visitor can write a fake address and dodge the limit. In the review a made-up `X-Forwarded-For` was sent on every sign-in try. It was ignored, and the eleventh try in a minute was refused whatever address each request claimed.

Two ways to break it by accident are written in the compose file and the runbook. Sending `/api/` through the web container's nginx as well would not make the count two: nginx overwrites the forwarded address with the one it saw, which is Caddy's, so every visitor would look like one person. And if ODU puts its own proxy in front of Caddy, the number becomes two and Caddy has to be told to trust that proxy.

### The three networks

The production stack has three Docker networks:

| Network | Who is on it | Way out to the internet? |
|---|---|---|
| `public` | `caddy` only | Yes. It needs one to get its certificate and answer visitors |
| `proxy` | `caddy`, `web`, `api` | No ("internal") |
| `backend` | `api`, `db`, and the one-off tools | No ("internal") |

Only Caddy has a port on the server (80 and 443). The database is only on `backend` and publishes no port. So a visitor cannot reach the database or the API directly, and even a broken-into container there has no way to call out. The review checked this from inside the database and API containers: neither could reach the internet.

## 3. The steps, in the order they were done

Part one was written with no Docker. Part two is the review.

1. Created the branch `block-8-deploy` from the Block 7 branch.
2. **The banner.** Put the words in the string catalog. Added a `SITE_BANNER` setting read when the app is built (never at run time), passed through `vite.config.ts` as a constant and through `web.Dockerfile` as a build argument. Any value but empty or `test` stops the build. Tests: both states, the default is off, and an accessibility scan on four screens.
3. **The cleanup.** Wrote `maintenance.ts` and the command `pnpm db:cleanup`. A session is over when "now" has reached `expires_at` or its last use plus the idle limit, using the same constants as sign-in. An audit event goes only when strictly older than 180 days. Tests with a clock the test controls, one second before, exactly on and one second after each limit.
4. **Proved the tests catch mistakes.** Broke each boundary on purpose and watched a test fail.
5. Wrote the production Compose file and the Caddy settings.
6. Wrote the deploy, backup, cleanup and health scripts. Tried them against stand-in `docker` and `curl` programs to catch shell mistakes.
7. Wrote the runbook, the new-student page and the hosting questions.
8. **The review ran everything in Docker.** The images, the developer stack, the production stack over HTTPS, a deploy, a broken deploy, backups, a restore, a password change, and locking an account. It found eleven defects and fixed them. The runbook, the threat model and the data map were then updated to say what was and was not run.

### What running it found that reading did not

These are the real examples. Each one passed review by reading.

- **The web image did not build.** `infra/web.Dockerfile` did not copy the `content/` folder. The image had been broken since lessons were added. Only building it shows that. A CI job now builds both images on every pull request.
- **The developer stack's API could not start.** The developer Compose file never gave the API its sign-in settings, and the API refuses to start without them. The README also sent people to `localhost:8080`, an address the API would refuse. Only starting it shows that. The fix gave the port its own name (`DOCKER_WEB_PORT`) and the README the address `http://127.0.0.1:8080`.
- **The security policy had never reached a browser.** The page's Content Security Policy lived in an nginx file. The browser tests used a preview server that sent no policy. So the browser tests passed against a page that was never held to its own rules. The fix makes the preview server read the same nginx file, and adds `apps/web/e2e/policy.spec.ts`, which checks the policy is strict, is live and is never broken by any screen. Two small things then showed up: three tests that added a `<style>` tag, which the policy refuses (so they tested nothing under it), and the next item.
- **The Zod probe.** Zod tries `new Function("")` once per page load to see whether it may generate code. The policy refuses that and reports it every time. That is harmless, but a real violation would have been lost in the noise. `packages/shared/src/zod.ts` now turns the probe off in browsers only, and a unit test fails if any other file imports Zod directly.
- **A deploy did not apply a changed `Caddyfile`.** Caddy reads its file only when it starts, and Compose does not notice that a mounted file changed. So a deploy that changed the Caddyfile changed nothing. `deploy.sh` now starts the proxy, web and API fresh on every deploy. The database is not restarted.

Smaller finds: nginx announced its version, Caddy advertised HTTP/3 on a UDP port nobody could reach, a practice run on a laptop could never pass the health check, an extra image was built only to add `bash`, and one browser test measured a button's colors halfway through a fade.

### What the deploy script does, in order

`infra/deploy.sh <version>` stops at the first thing that fails.

1. Refuses without a private `infra/.env`, and refuses to run as root.
2. Checks that `<version>` is exactly what is checked out, with nothing uncommitted. Checks the settings.
3. Builds the images for this version. Nothing running is touched yet.
4. Starts the database if it is not running, and takes a backup labelled `pre-<version>`. If the backup fails, nothing changes.
5. Runs the migrations as the migrator user.
6. Starts the proxy, web and API fresh, and waits for `/api/health` to answer through Caddy over HTTPS, with the certificate checked.
7. If that fails, starts the previous version again.
8. If it worked, writes the version in `infra/.deployed-version`.

**What "going back" does.** It starts the previous version's program, from the images still on the server. It uses the `Caddyfile` of the checkout you are standing in, not the old version's. The site is down for about a minute and a half before the old version is back, because the script has to wait to learn that the new one is not healthy.

**What it does not undo.** A migration that already ran stays run. Going back puts back the previous program, not the previous tables. That is safe only if the old program can work with the new tables, which is why a migration may add things but must never rename or drop something the old version still reads. If the old program cannot cope, the only way back is to restore the backup from step 4, and that throws away everything written since. The script says all this, loudly, every time it goes back.

### What a restore does, and why the sync counter jumps

A restore puts the database back as it was at the time of the backup. Phones keep a number: the last sync number they saw. When a phone syncs, it asks the server for everything newer than that number.

A restore also takes the server's counter back. Say the phones have seen number 55, and the backup was taken at 40. The first new entry after the restore gets number 41. A phone asks for "newer than 55", and never hears about 41. It would silently miss the entry.

So after a restore, the counter is moved far forward (a million past the highest number now in the table). New entries get numbers no phone has seen. The runbook has the command (section 16, step 4). The review practiced it, and after it, sign-up and sync between two browsers worked and new entries got numbers above the jump. Entries that a phone had and the restore lost stay on that phone until it signs out. That is the price of going back in time.

## 4. How you would build it yourself

For the cleanup:

1. A function that takes the database and "now" and returns two counts. Use `delete().where(...)` and read the row count. No `returning`.
2. A command file that opens the database as the app user, calls it with the real clock and prints counts.
3. A test with a made-up account, rows at fixed distances from "now", and exact count checks. Run the function twice.
4. Add the file to the guard's allowlist for exactly the tables it uses, and add a guard test that it cannot name the other tables.

For the server files, the order that worked:

1. Write the Dockerfiles and build them, from the repo root, before writing anything else. `docker build -f infra/web.Dockerfile .` finds a missing copy at once.
2. Write the developer stack first. Start it. Sign up. Fix what does not start.
3. Write the production stack as its own file. Give only the proxy a `ports:` line. Put the database on an internal network. Run `docker compose ... config --quiet` (always `--quiet`: without it, Compose prints your secrets).
4. Make it read-only (`read_only: true` plus small `tmpfs` folders where a program must write), drop privileges (`cap_drop: [ALL]`, add back only what is needed), and see which containers complain.
5. Write the deploy script as a list of steps that each stop on failure. Test the failure path, not only the good one: deploy something broken on purpose.
6. Write the backup, then write the restore, then restore a backup into a second database and compare row counts. A backup you have not restored is a hope.
7. Run everything, then read the logs of every container for anything private.

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

The production stack on your own computer: follow `docs/runbook.md`, section 13a, step by step. It needs Docker, uses made-up data, and ends with `deploy: 8/8 done.` Your browser will warn about the certificate. That is expected on a practice run, and only on a practice run. Then try the rest of the runbook against it: deploy a second version, deploy a broken one and watch it go back, restore a backup, lock an account.

To check that Compose accepts the production file without starting anything:

Runs in: a machine with Docker, in the `infra` folder, with an `infra/.env` filled in
```bash
TUMMY_VERSION=check docker compose --env-file .env -f docker-compose.prod.yml --profile tools config --quiet
```

## Check yourself

1. The web image had not built since lessons were added, and nobody knew. Why not? What now catches it?
2. The browser tests passed, and the page's security policy had still never been tested. How can both be true?
3. What does Caddy do, and why must the API be told how many proxies are in front of it?
4. Why would sending `/api/` through nginx behind Caddy make every visitor share one sign-in limit?
5. Which containers have a way out to the internet in production, and why only that one?
6. Why did a deploy not apply a changed `Caddyfile`, and what does the script do about it now?
7. A deploy fails after its migration ran, and the script goes back. What is back, and what is not?
8. Why must the sync counter be moved forward after a restore? What would a phone miss if it were not?
9. Why is "I read it carefully" not enough for a deploy script?

## What is still not proven

- **A real server.** Everything ran in one review container, with a test certificate for `localhost`. There was no public DNS name, no ODU network and no hosting provider yet.
- **A public certificate.** HTTPS, the redirect and HSTS were checked only with Caddy's own test certificate.
- **A real phone.** The accessibility pass with VoiceOver and TalkBack, and the two-phone test on a deployed site, need people. Two separate browsers passed.
- **The daily timers.** The systemd files were checked for syntax only. Nothing runs the backup or the cleanup every day.
- **An alert.** Nobody is told when the site is down or a backup fails. Who receives it is undecided.
- **Backups.** They are unencrypted and on the server's own disk. Where a copy is kept off the server, and where `CODE_LOOKUP_SECRET` is kept apart from them, are undecided.
- **Deleted log entries** are not erased, although the data map says 90 days. A rule in sync has to come first (ADR 0005, "Known gap").
- **Limits per address only.** Many addresses at once can still slow sign-in. Decide before real families.
- **One known dependency finding** (`deepmerge`, used only while the site is built) has no fix and awaits a decision.
- **Containers still have some default privileges.** The database and web containers keep them, and nginx's main process runs as root inside its container. A later hardening pass is planned.
- **Hosting answers from ODU**, and who patches the server.
- **A new student** has not yet set up from the README with no help.

Written with AI assistance and reviewed by Devin Ferrell.
