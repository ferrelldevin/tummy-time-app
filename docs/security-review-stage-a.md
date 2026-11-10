# Stage gate review: the skeleton (Blocks 0 to 8)

This is the first of the two stage gates in `docs/build-plan.md`. The whole app was reviewed against the threat model (`docs/threat-model.md`) and the OWASP Application Security Verification Standard (ASVS), Level 1, with Level 2 expectations for sign-in and sessions.

Reviewer: Claude (the senior reviewer for this project). The reviewer did not write the code under review, with one exception that is called out below: the fixes made during this review were written by the reviewer and were then checked by a second, separate reviewer.

**Bottom line.** Eleven defects were found and fixed, most of them in server files that had never been run. Six items stay open, four of them medium; each needs a decision from a person, a design that does not exist yet, or a real server. One of them is in the app's own behaviour: "deleted" entries are kept longer than the data map says (item C). A person has still not done the screen reader pass, the real-phone pass or the new-student test, so the gate is **not passed yet**.

## How the review was done

Reading alone had already been done block by block. This review added the one thing no earlier block could: **running it.** A Docker service was started in the review machine and the real files were used, unchanged.

| What was run | Result |
|---|---|
| The web image (`infra/web.Dockerfile`) | Did not build. Fixed (finding 1). Then: `nginx -t` passes, and every header in runbook section 11 was read with `curl` on `/`, `/sw.js`, the manifest, an icon, a hashed file and a missing file |
| The developer stack (`infra/docker-compose.yml`) | The API could not start. Fixed (finding 2). Then: sign up, timer, save, and the entry appearing in a second browser |
| The production stack (`infra/docker-compose.prod.yml`, `infra/Caddyfile`) with HTTPS | Every container starts with its read-only file system and dropped privileges. Only the proxy has ports (80, 443). The database and the API have no route out to the internet (tested from inside each) |
| `infra/deploy.sh`, a good version | Backup, migration, start, health check over HTTPS with the certificate verified, version recorded |
| `infra/deploy.sh`, a version broken on purpose | The script went back to the last good version by itself and said so. The site was down for about a minute and a half while it found out |
| `infra/backup-scheduled.sh`, `infra/cleanup-scheduled.sh`, `infra/healthcheck.sh` | All work. The health check exits 1 on a wrong address |
| Restore into a separate database (runbook section 16, drill) | Worked as written. About 1 second for the sample data. Row counts matched |
| Restore over the live database (runbook section 16) | Worked as written, including "move the sync counter forward". Sign-up and sync between two browsers worked afterwards, and new entries got numbers above the jump |
| Change the database passwords (runbook section 17) | Worked as written. The database container restarts for a few seconds too, because its settings changed |
| Lock and unlock one account by hand (runbook section 18) | Worked as written. A locked account answers "locked" even to the right PIN; unlocked, it signs in |
| A visitor sending a made-up `X-Forwarded-For` to dodge the sign-in limit | Ignored. The eleventh try in a minute was refused whatever address each request claimed |
| A state-changing request from another origin, through the real proxy | Refused (403) |
| The logs of all four containers after all of the above | No visitor address, PIN, family code, cookie or request body. The only addresses are the containers' own "listening on" lines |
| Every browser test, under the page's real Content Security Policy | 63 pass. Before the fixes, the policy had never been sent to a browser by anything |

**Not practiced:** going back to an older version by hand (runbook section 15, steps 2 to 4), changing the database administrator's password, and anything about certificates from a public authority.

**What this does not prove.** The certificate was Caddy's own test certificate for `localhost`, not a public one. There was no public DNS name, no ODU network, no real phone and no person. The systemd timer files were checked for syntax only. Image tags were pulled through a mirror of the public registry.

## Findings that were fixed

| # | Severity | What was wrong | Fix | How it is kept fixed |
|---|---|---|---|---|
| 1 | High (nothing could be deployed) | `infra/web.Dockerfile` did not copy `content/`, so the web image has not built since lessons were added | Copy it | Building the image; a CI build of the images is recommended below |
| 2 | High (same) | The developer Compose file never gave the API its sign-in settings, so the API refused to start. The README sent people to `localhost:8080`, an origin the API would refuse | Settings added; the port has its own name (`DOCKER_WEB_PORT`); README corrected | Running it |
| 3 | Medium | The page's Content Security Policy lived only in an nginx file. The browser tests used a preview server that sent no policy, so nobody knew whether the app worked under it | The preview server reads its headers from nginx's own file. `e2e/policy.spec.ts` checks the policy is strict, is live, and is never broken by any screen | Every CI run |
| 4 | Low | Zod tried `new Function("")` once per page load to see if it may generate code. The policy refused and reported it every time, so a real violation would have been lost in the noise | `packages/shared/src/zod.ts` turns that off in browsers only. Every schema file imports Zod from there | `policy.spec.ts`, and a unit test that no other file imports Zod directly |
| 5 | Low (a test that tested nothing under the policy) | Three large-text tests added a `<style>` tag, which the policy refuses | `doubleTextSize()` sets the size from script and fails if it did not double | The helper itself |
| 6 | Low | nginx announced its version; text files had no character set in `Content-Type` | `server_tokens off`, `charset utf-8` | Header check in the runbook |
| 7 | Low | Caddy advertised HTTP/3 on a UDP port that is not published | HTTP/1.1 and HTTP/2 only | Header check |
| 8 | Medium | A changed `Caddyfile` was not applied by a deploy: Caddy reads it only at start | `deploy.sh` starts the proxy, web and API fresh each time. The database keeps running | Found and confirmed by deploying |
| 9 | Low | `deploy.sh` could only verify a certificate from a public authority, so a practice run on your own computer always "failed" | Optional `HEALTH_CA_FILE`. The certificate is still always verified | Practice run |
| 10 | Low | An extra image was built only to add `bash`, which the database image already has | Removed | Running it |
| 11 | Low | A browser test measured a button's colors halfway through a 150 ms fade and failed on the build server only | The accessibility helper waits for fades to end | Reproduced by slowing the fade, then fixed |

## Open items

None of these is a defect in code that more code would close today. Each has an owner.

| # | Severity | What | Why it is open | Owner |
|---|---|---|---|---|
| A | Medium | `deepmerge` 4.3.1 has a known flaw (prototype poisoning) and no fixed version. It is used only while the site is being built, by a build tool of the offline feature. It is not in what phones or the server run, and no visitor input reaches it. The OSV scan in CI fails on it | Passing over a scanner finding is a decision, not a fix | Devin: dated exception, leave red, or replace the tool |
| B | Medium | Backups are unencrypted and on the server's own disk. Where `CODE_LOOKUP_SECRET` is kept safe apart from them is undecided | Depends on what ODU provides | Devin and Dr. Gupta, with ODU IT |
| C | Medium | "Deleted" log entries are never erased, although the data map says 90 days | A phone that was offline longer than that would never hear of the delete. It needs a "start again from zero" rule in sync first (ADR 0005, "Known gap") | A later block; Devin to schedule |
| D | Medium | Limits on sign-in and sign-up are per network address only. Many addresses at once can still slow sign-in (threat model 15b). Caddy has no built-in limit and adding one means a plug-in build | Acceptable for a test site with sample data. Decide before real families | Devin; ask ODU IT what sits in front |
| E | Low | The database and web containers keep the default privileges, and nginx's main process runs as root inside its container. The API and the proxy drop all they can | Finding the smallest set means trying each; the stack is otherwise isolated (no route out, read-only) | A later hardening pass (Block 16) |
| F | Low | When the server answers with an error, the signed-in screens show a message and a "Try again" button but no page heading | Small accessibility defect, found while the API was stopped | Next web change |

Also noted, accepted as designed: a failed deploy means about a minute and a half of downtime before the last good version is back; a migration that already ran is not undone by going back (the script says so, loudly).

## ASVS Level 1, by chapter

Section numbers are not cited: the threat model still asks that the current ASVS version be confirmed before anyone cites them. Each line says where the evidence is.

| Chapter | Result | Evidence or reason |
|---|---|---|
| Architecture and threat modeling | Met | `docs/threat-model.md`, ADRs 0001 to 0009, this review |
| Authentication | Met with one recorded deviation | Argon2id above the OWASP minimum; lockout after 5 wrong PINs, counted and locked in one statement; the same answer and the same cost for an unknown code and a wrong PIN; per-address limits. **Deviation:** a 6-digit PIN is shorter than ASVS asks of a password. It is never the only secret: the family code is 12 random characters that nobody chooses, and both are needed. Recorded in ADR 0003. There is no recovery yet (Block 10), so there is no recovery flow to attack |
| Session management | Met | 256-bit random token; only its hash is stored; `__Host-` cookie, Secure, HttpOnly, SameSite=Lax (read back from a browser on the deployed stack); 30-day idle and 90-day absolute ends; a new session on every sign-in; sign out here and everywhere; ended sessions are removed by `pnpm db:cleanup`, which exists and was run by hand; its daily timer is not installed anywhere yet |
| Access control | Met | One door to an account's rows (`forAccount`), a test that fails if a query goes around it, cross-account tests on every route. The two files allowed around it (sign-in lookups, the cleanup job) are named in that test with their reasons and take no ID from a request |
| Validation, sanitization and encoding | Met | Strict schemas on every input and output; parameterized SQL only; React escaping; Markdown rendered without HTML; no `dangerouslySetInnerHTML`, `eval` or inline script anywhere, now enforced by the page policy in tests |
| Stored cryptography | Met | No cryptography of our own: Argon2id, HMAC-SHA-256 and SHA-256 from maintained libraries and Node |
| Error handling and logging | Met | One error shape, fixed messages, no stack traces sent; logs read after a full run and found clean; audit events for sign-up, sign-in, failures, lockout, sign-out and deletion |
| Data protection | Met for the skeleton; items B and C open | Only what `docs/data-map.md` lists is stored; `no-store` on every API answer; the phone's copy is wiped on sign-out; nothing from the API is ever cached by the service worker |
| Communications | Met on the test stack; not yet shown with a public certificate | HTTPS only, HTTP redirects, HSTS, verified end to end with Caddy's own certificate |
| Malicious code | Met | Lockfile, pinned CI actions, secret scan, CodeQL, dependency scans (item A is the one finding) |
| Business logic | Met | Time and duration limits on entries; writes for one account happen in order (ADR 0009) |
| Files and resources | Not applicable | The app takes no uploads |
| API and web service | Met | Origin check plus a custom header on every state-changing request; 16 KB body limit; JSON only; unknown fields refused |
| Configuration | Met, with item E | Secrets only in a private file on the server; the app's database user cannot change tables; the test sign-in method cannot be turned on in production; security headers verified on the running server |

## What a person still has to do before this gate is passed

1. The full accessibility pass by hand: VoiceOver and TalkBack on real phones, every screen.
2. The two-phone test on a deployed site from two real phones. (Two separate browsers passed here.)
3. The new-student test: someone sets up from the README with no help.
4. Devin's decisions on items A, B and D.
5. A deploy on a server with a real name and a public certificate, then the practice list in runbook section 23.

## Recommended next

- Build both images in CI on every pull request. It needs no secrets and would have caught findings 1 and 2 the day they were made.
- Run `docker compose config --quiet` on the production file in the same job.
