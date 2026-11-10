# Threat model

What we protect, who might attack it, what could go wrong, and the control that stops each thing. Written before any code so the controls are built in, not bolted on.

Method: STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), a checklist from Microsoft for asking "what could go wrong" at every point where data moves.

Status: first version, Nov 10, 2026, for the walking skeleton. Update it whenever a data flow changes; the block gate asks.

## What we protect

| Asset | Why it matters |
|---|---|
| A family's tummy time log | Private, even with no name attached. A caregiver must trust the app |
| The family code and PIN | They are the keys to the account |
| Session tokens | A stolen token is a stolen account until it expires |
| Lesson and safety content | If altered, a caregiver could get wrong medical guidance. This is the highest-harm asset |
| The server and database | A foothold on an ODU machine |
| The team's and university's reputation | A leak in a health-related app for vulnerable families is serious even if the data is thin |

## Who might attack

| Who | What they want | How capable |
|---|---|---|
| Automated scanners and bots | Any weak site: spam, hosting malware, stolen credentials | Low skill, constant |
| A curious or malicious user | Other families' data | Low to medium |
| Someone with a caregiver's unlocked phone | That family's account | Physical access |
| A compromised dependency | Whatever the app can reach | High, and invisible |
| A well-meaning team member | Nothing. They leak a secret or real data by mistake | The most likely of all |

Not in scope for a prototype: a targeted attack by a skilled, funded group. We do not ignore it; we rely on ODU's network and server protections for it.

## How data moves

```text
Phone (browser, PWA)
   |  HTTPS only
   v
Reverse proxy  -- serves the web app's files
   |
   v
API (Fastify)  -- checks session, validates input, filters by account
   |
   v
Database       -- not reachable from outside the server

Separate path:  developer -> GitHub -> CI -> deploy -> server
Separate path:  content file -> pull request -> clinician sign-off -> build -> phone
```

Trust boundaries (where we stop trusting what arrives): phone to proxy, API to database, GitHub to server, and content author to published lesson.

## Risks and controls

Severity is harm if it happened: High, Medium, Low. "Block" is where the control is built.

### Sign-in and sessions

| # | What could go wrong | STRIDE | Severity | Control | Block |
|---|---|---|---|---|---|
| 1 | Guessing a 6-digit PIN | Spoofing | High | PIN is useless without the 12-character random family code. 5 wrong PINs lock the account 15 minutes; the count and the lock are one database step, so guesses sent at the same time cannot get past 5. Common PINs are refused at sign-up. Sign-in is limited to 10 a minute per network address. Built and tested in Block 4 | 4 |
| 2 | Guessing family codes in bulk | Spoofing | High | About 60 bits of randomness. Rate limit on sign-in. Wrong code and wrong PIN get the same answer and each cost one full Argon2id check (a test measures both). The "locked" answer can only be reached with a real code. Built and tested in Block 4 | 4 |
| 3 | Database leak exposes codes or PINs | Information disclosure | High | Only a keyed hash of the code and an Argon2id hash of the PIN are stored. The key (`CODE_LOOKUP_SECRET`) is a server secret, not in the database; the API refuses to start without a strong one. Where the key is kept on the server, and its backup, are Block 8 | 4, 8 |
| 4 | Stolen session token | Spoofing | High | HttpOnly cookie (scripts cannot read it), HTTPS only, `__Host-` name so no other site can set it, hash stored server-side, ends after 30 days unused or 90 days in total, new token at every sign-in, "sign out everywhere". Built and tested in Block 4. Rows of ended sessions are removed when next presented, and the daily cleanup (`pnpm db:cleanup`, run by `infra/cleanup-scheduled.sh`) removes the rest. It was run by hand in the Block 8 review; the timer that would run it every day is not installed anywhere yet | 4, 8 |
| 5 | Another site makes the phone send requests (CSRF) | Tampering | Medium | SameSite cookie, exact origin check against a configured address (never the Host header), required custom header. Refused before the body is read. Fails closed when no origin is configured. Built and tested in Block 4 | 4 |
| 6 | Someone picks up an unlocked phone | Spoofing | Medium | Accepted for now: a caregiver holding a baby should not re-enter a PIN. Sign out everywhere exists. Revisit for shared clinic devices | 10 |
| 7 | Caregiver loses the code | Denial of service (to themselves) | Medium | Clear warning at sign-up. Recovery designed in Block 10 | 10 |

### Data access

| # | What could go wrong | STRIDE | Severity | Control | Block |
|---|---|---|---|---|---|
| 8 | One account reads or changes another's logs | Elevation of privilege | High | Every query goes through one helper that filters by the signed-in account. A test fails if a route skips it. Tests try cross-account access on every route, including every log route (Block 6). One small leak is left: saving an entry under an ID that another account already uses answers "not found" where a fresh ID would succeed, so it shows that the ID is taken. It shows no content and no owner, and IDs are random 122-bit values | 3, 6 |
| 9 | Malicious input reaches the database (SQL injection) | Tampering | High | All queries parameterized by the ORM. Every input validated by a schema. Unknown fields rejected | 3 |
| 10 | Malicious content runs in the page (XSS) | Tampering | High | React escapes output. Markdown is sanitized. Content Security Policy forbids inline scripts. No free-text fields from users in the skeleton. Every browser test now runs under the page's real policy, and `apps/web/e2e/policy.spec.ts` checks that the policy is strict, is live, and is never broken by any screen (before the Block 8 review, no test had ever sent the policy to a browser) | 3, 5, 8 |
| 11 | Secrets or tokens end up in logs | Information disclosure | Medium | Log redaction list, with a test that proves it | 3 |
| 12 | Error messages reveal internals | Information disclosure | Low | One error shape, no stack traces sent to the phone | 3 |
| 13 | Account data left on the phone after sign-out | Information disclosure | Medium | The phone's whole IndexedDB database is deleted on sign-out here, sign-out everywhere, account deletion, any "not signed in" answer from the server, and before a new sign-in or sign-up. Unit and browser tests cover each (Block 6). Unsent changes are lost when the server ends the session; a planned sign-out warns first. Cached files hold no account data by design: the service worker never stores an API answer, checked at build time and by a browser test that reads every cache (Block 7). A check by hand in the browser's storage tools is still owed. Note: Safari on iPhone deletes a site's storage after 7 days without use unless the app is on the home screen, so unsent changes there could be lost; the install help page is the mitigation and the client should know | 6, 7 |
| 14 | Flooding the API | Denial of service | Medium | Rate limits, request size limit, validation limits on every number. Log limits and a 500-entry page cap built in Block 6. Writes for one account wait in line for that account's lock and each holds a database connection while it waits; the general rate limit bounds this, and a lock timeout is a possible later guard | 3, 6 |
| 15 | "Who deleted this?" cannot be answered | Repudiation | Low | Audit events for sign-up, sign-in, failed sign-in, lockout, sign-out and account deletion. They hold a type, a time and an account ID, nothing else. Built in Block 4 | 4 |
| 14a | A phone silently misses an entry because two writes finished in the opposite order to their sync numbers | Tampering (integrity) | High | Each account's writes are done one at a time under a lock, so they finish in number order. A sync answer's "newest number" comes only from the rows it returned. Tests hold one write open and run many at once (ADR 0009, Block 6) | 6 |
| 15a | The sign-in lookups go around the account filter, because nobody is signed in yet | Elevation of privilege | High | They live in one file, `apps/api/src/auth/credential-store.ts`, named in the guard test's allowlist with its reason. It cannot touch tummy logs. Any change to that file or the allowlist is a security review | 4 |
| 15b | Flooding sign-up to fill the database, or sign-in to use up the server's memory with PIN checks | Denial of service | Medium | Sign-up 20 an hour and sign-in 10 a minute per network address. Each PIN check uses about 46 MB for under a tenth of a second, at most 4 at once. Limits are per address and in memory, so many addresses at once are not stopped here. The visitor's address comes from the one proxy in front (Caddy, with `API_TRUST_PROXY_HOPS=1`). In the Block 8 review a made-up `X-Forwarded-For` was tested and ignored: the eleventh sign-in in a minute was refused whatever address each request claimed. Two ways to break this by accident: sending `/api/` through nginx behind Caddy would put every visitor in one bucket, and an ODU proxy in front of Caddy makes the number 2 and needs Caddy's `trusted_proxies`. Still per-address only: Caddy has no built-in limit and adding one means a plug-in build (open item D in `docs/security-review-stage-a.md`) | 4, 8 |

### Content and safety

| # | What could go wrong | STRIDE | Severity | Control | Block |
|---|---|---|---|---|---|
| 16 | Unreviewed medical text shown as final | Tampering (of trust) | High | `status` field, build check, visible "Draft" banner, sign-off recorded by name and date | 5, 14 |
| 17 | A phone keeps showing an old safety card after it was corrected | Tampering | High | Lessons and the safety card are compiled into the app, so content and code are always one version and are cached as one set. The phone looks for a new version at every start, every return to the front, when it comes back online and hourly; the server tells browsers never to reuse the worker file or the page without asking. A waiting version shows a notice with a button and is applied by itself at the next safe moment (start, return to the front, change of screen), never under a running timer. The emergency line is fixed text with its own test. Left over: a phone that stays offline, or sits open on one screen, keeps the old version until then. Built in Block 7; server headers not yet seen running (Block 8) | 7, 8 |
| 17a | A phone opened with no signal shows its saved log even though the account was signed out from another phone | Information disclosure | Low | Accepted: the copy was already on that phone, and it is deleted the moment the phone reaches the server and hears it is signed out | 7 |
| 18 | Someone changes a lesson without review | Tampering | High | Protected main branch, required review, content changes reset sign-off | 0, 14 |

### Supply chain and people

| # | What could go wrong | STRIDE | Severity | Control | Block |
|---|---|---|---|---|---|
| 19 | A dependency with a known flaw, or a hijacked one | Tampering | High | Lockfile, weekly Dependabot, audit and OSV scan in CI, few dependencies, CI actions pinned to exact versions. One known finding has no fix: `deepmerge` 4.3.1 (prototype poisoning), used only while the site is built, not in what phones or the server run. The OSV scan in CI fails on it, and someone has to decide what to do with it (open item A in `docs/security-review-stage-a.md`) | 1, 8 |
| 20 | A secret committed to the repo | Information disclosure | High | gitleaks before commit and in CI, `.env` ignored, secrets only in the server's environment | 1 |
| 21 | Real participant data pasted into the repo, an issue or an AI chat | Information disclosure | High | Standing rule in CLAUDE.md and README, sample-data seed, PR checklist. No tool fully prevents this; people do | 0 |
| 22 | AI-written code merged without understanding | Tampering | Medium | Writer never reviews. Human approves every merge. Walkthrough chapter per block. ADR per decision | 0 |
| 23 | Data collected before IRB approval | Legal and ethical | High | Flags off by default. Block 15 cannot start without the ruling | 15 |

### Server

| # | What could go wrong | STRIDE | Severity | Control | Block |
|---|---|---|---|---|---|
| 24 | Database reachable from the internet | Information disclosure | High | The production stack has three networks. The database is on an internal one with no published port, and only the proxy (Caddy, ports 80 and 443) has ports. Checked in the Block 8 review from inside the containers: the database and the API have no route out to the internet. Run with a test certificate for `localhost`, not on a real server | 8 |
| 25 | App's database user can drop tables | Elevation of privilege | Medium | Two users: the app's can only read and write rows | 3 |
| 26 | Data lost with no way back | Denial of service | High | A scheduled backup script exists (`infra/backup-scheduled.sh`, also run before every deploy), and a restore was practiced in the Block 8 review, both as a drill into a separate database and over live data. The timer that would run it every day is not installed anywhere. Backups are unencrypted and on the same disk as the app. Whether and where an off-server copy is kept is undecided (open item B in `docs/security-review-stage-a.md`) | 3, 8 |
| 27 | Unpatched server | Elevation of privilege | High | Open question: who patches the lab server. Recorded in the runbook in Block 8 | 8 |
| 28 | Traffic read or changed in transit | Information disclosure | High | Caddy ends HTTPS, port 80 redirects to 443, and the HSTS header is sent. Checked in the Block 8 review with Caddy's own test certificate for `localhost` only; not yet with a public certificate | 8 |
| 29 | Backup files hold every family's tummy logs in the clear on the server's disk, and someone who reads them has them all | Information disclosure | Medium | Each file is mode 600 in a private folder outside Docker's storage. Encryption, and who holds a key, are undecided (open item B) | 8 |
| 30 | Anyone in the server's `docker` group can read every secret and all the data, and change the app, so they are effectively its administrator | Elevation of privilege | Medium | Keep that group to the deploy user. Open question for ODU IT: who else has it on the server | 8 |
| 31 | "Deleted" tummy log entries are kept longer than the 90 days the data map states | Information disclosure | Medium | Known gap: a phone offline longer than that would never hear of the delete, so a "start again from zero" rule in sync has to come first (ADR 0005, "Known gap"; open item C). Account deletion still erases every row | 8 |

## Open questions that affect this model

- Who administers and patches the lab server, and what does ODU require before an app goes live on it?
- If email sign-in is chosen: mail spoofing, code interception, and storing an email address all join this table.
- Where is the separate backup of `CODE_LOOKUP_SECRET` kept, who can read it, and is it encrypted? Without it a database backup cannot sign anyone in.
- Is any recruiting clinic part of a HIPAA-covered system? If so, a compliance review comes before real users.

## Standards this model is checked against

OWASP ASVS (Level 1 everywhere, Level 2 for sign-in and sessions), OWASP Top 10, OWASP cheat sheets for authentication, session management and password storage, NIST SP 800-63B. Block 0's follow-up is to confirm the current version of each before code cites section numbers.
