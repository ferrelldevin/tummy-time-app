<!-- Copy of the living plan at https://claude.ai/artifact/BRn6V7icQQA4nmUGcEkZdz, exported Nov 10, 2026. If the two differ, the living plan wins; re-export it here. -->

# Tummy Time: Scoped Build Plan

Nov 10, 2026 · Devin Ferrell · Internal, not for the client

## Bottom line

We build the foundation in 9 blocks that need nothing from the client, then 8 product blocks that open after the first client meeting. Security, accessibility and privacy checks run from Block 1, not at the end.

- **First target:** a walking skeleton. Sign in, open one lesson, log one tummy time, see it on a second phone, running on a server, with a README the next student can follow.
- **Everything the client has not confirmed sits behind a seam:** sign-in method, lesson content and pathways, any study or survey, hosting details. A seam is a small, named boundary in the code where one part can be swapped without touching the rest.
- **Stack and block order are proposals.** Dr. Gupta approves the platform. Nothing here is a client commitment, and no dates appear on purpose.
- **This replaces the Nov 7 build plan** (11 phases, sized for a pilot nobody has committed to).

**Needed from Devin to start building**

1. Done Nov 10: the repo is ferrelldevin/tummy-time, and temporary off-campus staging is approved.
2. The note to Dr. Gupta: CMAI Tracker repo access, and who runs its campus server.

**How to use this plan**

- One block at a time, in order, unless the block map shows two can run side by side.
- Each block card names its model, its steps, its checks, and when to stop and ask.
- A block is done only when every check on its card passes and the standards gates pass. No skipped tests, no silenced warnings, no "fix later".
- If the plan is silent or wrong, the builder stops and escalates. It does not guess.
- Labels used below: **Fixed** (Devin's call), **Proposed** (my recommendation, can change), **Open** (waits on a person), **Lead** (from earlier files, not confirmed).

**Standing deliverable (Devin, Nov 10): a student walkthrough**

- Every block ends with a chapter in `docs/walkthrough/` in the repo. A block is not done without it.
- Each chapter covers: what was built, why it was built that way, each step in the order it was done, how to build it yourself from nothing, and how to open and run it while reading along.
- It is written for a CS student, in plain words, with every command labeled with where it runs.

## The rewritten prompt

This is Devin's ask restated so it carries the whole project. It is the brief this plan answers, and it can be pasted to start any future planning session.

```text
ROLE
Act as the technical lead on Tummy Time, working for me (Devin, project lead).
Think like a senior engineer who has shipped health-adjacent web apps:
opinionated, careful, and open about what you don't know.

PROJECT
Tummy Time is a client's learning app for caregivers of premature babies:
why tummy time matters, how to do it safely, and how to keep going when the
baby cries. It is a mobile-first PWA with sign-in and a database on ODU
campus servers, with data synced across a caregiver's phones. No app stores.
It is a prototype foundation that ODU students will keep building and
maintaining, and it could support future grant funding.

WHAT IS FIXED
- The build is happening.
- Sign-in, a database on ODU servers, and sync across phones.
- Team: me as lead, Muhammad building, maybe one occasional helper.
- Clinical content is placeholder until the client's clinician signs off.
- No real participant data. Consent and survey screens ship switched off.
- No dates or time frames go to the client until the project is scoped.

WHAT IS OPEN
Everything else. The brief, mockup, old build plan and decisions log came
from one meeting (rough audio plus a dictation) and a few AI chats. Treat
them as leads to confirm. Mark every assumption as an assumption. Open until
the first client meeting: sign-in method, screens and pathways, any study or
survey, whether ODU has REDCap, and the ODU server details.

THE TASK
1. Write a scoped build plan that maps everything we need, from an empty
   repo to a finished app the client accepts.
2. Break it into blocks small enough that a less capable model can follow
   each one exactly: goal, inputs, steps, files, checks, and when to stop
   and ask. Leave no judgment calls inside a block.
3. Put open decisions behind clean seams so a client answer changes one
   part, not the whole app.
4. Say which model does which block. Keep Fable 5.2 for planning,
   architecture, security design and review. Give routine build work to
   cheaper models that follow the written plan.
5. Then work the plan block by block. The only true end is a complete
   application and a satisfied client.

STANDARD
Build to professional standard from the first commit. Do not cut corners,
silence errors, skip tests or defer security. Bake in from Block 1:
- Security: threat model, OWASP ASVS checks, safe sign-in and sessions,
  dependency and secret scanning, least privilege, tested backups.
- Accessibility: WCAG 2.1 AA as the floor, checked by tools and by hand
  with screen readers on real phones.
- Privacy: collect the least data possible, a data map that the code is
  tested against, no third-party trackers.
- Quality: typed code, tests that can fail, reviewed pull requests, CI
  that blocks a bad merge, decisions recorded, docs a new student can
  follow.
- Clinical safety: nothing medical goes live without named sign-off.

HOW TO WORK WITH ME
- Recommend one option with its tradeoff. Suggest improvements when you
  see them, including to this prompt.
- Bottom line first, short bullets, one question at a time.
- Flag any conflict with an earlier decision instead of quietly choosing.
- Credit people, libraries and sources. Never hide that AI was used.

DONE MEANS
The app works for a tired caregiver on an older phone, the client has used
it and accepted it, and the next student can run, change and deploy it from
the README alone.
```

**What I added to your wording, so you can strike anything you disagree with**

- A plain definition of done (the last block of the prompt).
- "Leave no judgment calls inside a block" as the test for whether a block is small enough.
- Clinical safety and privacy as named standards beside security and accessibility.
- Model routing as part of the task, from your follow-up.

## Fixed, assumed and open

The plan stands on six fixed points. Everything else is a lead or an open question, and each one has a seam or a block that absorbs the answer.

**Fixed (Devin, Nov 9 and 10)**

- The build happens. It is a prototype foundation that keeps being built and maintained, hopefully by ODU students.
- Sign-in and a database on ODU servers. Sync across phones.
- Devin leads. Muhammad builds. Possibly one occasional helper.
- No dates or time frames go to the client until the whole project is scoped.
- Lab data rule: made-up sample data only until Dr. Gupta says in writing where real data may live.
- Clinical content is placeholder until the client's clinician signs off.

**Leads from earlier files (not confirmed)**

| Lead | Source | How the plan treats it |
| --- | --- | --- |
| Mobile-first PWA, no app stores | Decisions log, Nov 6 | Built this way. Low risk if it changes |
| Same stack as CMAI Tracker: React, TypeScript, Vite | Decisions log, Proposed | Used for the front end. Nobody has read CMAI's code yet |
| "No personal information collected" | Decisions log, Nov 6 | Honored by default. Conflicts with email sign-in (see below) |
| Knowledge checks, not tests | Decisions log, Nov 6 | Kept. Built in Block 12 |
| Client supplies scripts, images, videos | Decisions log, Nov 6 | Lessons are content files, so her material drops in without code changes |
| Consent and before/after survey in v1, switched off | Decisions log, Proposed | Reduced to a switched-off seam. Built only if the IRB and client say so (Block 15) |
| WCAG 2.1 AA required of ODU web content by Apr 26, 2027 | Glossary and brief | Used as the floor. Date not re-verified by me |
| ODU has REDCap | Research brief link | Unverified. Block 15 decides in-app survey or REDCap |

**Conflict to flag**

- Email sign-in stores an email address. The Nov 6 line "no personal information collected" says the client asked for none.
- Both are leads. The first client meeting settles it.
- The plan does not wait: the skeleton uses a sign-in that stores no personal information, and email can be added as a second method without a rewrite (Block 4 and Block 10).

**Open, and who answers**

| Question | Who | Absorbed by |
| --- | --- | --- |
| Where the code repo lives | Devin | Block 0 |
| Who runs the campus server, what it runs, which database | Dr. Gupta, then ODU IT | Hosting seam, Block 8 |
| Does Dr. Gupta approve the stack below | Dr. Gupta | Block 0 |
| Sign-in method | Client | Sign-in seam, Block 10 |
| Screens, pathways, intake questions | Client | Block 9, then 11 to 13 |
| Who signs off clinical content | Client | Block 14 |
| Any study or survey, who files the IRB, REDCap | Client, Dr. Gupta | Study seam, Block 15 |
| Where lesson videos live | ODU IT | Media seam, Block 12 |
| Muhammad's email, hours and experience | Muhammad | Sizing of every block |
| Who owns code, content and data after the grant | Dr. Gupta, client | Block 16 |

## Architecture and stack

One web app, one API, one database, all in one repo and one language (TypeScript), packaged so it runs the same on a laptop and on the ODU server. All of it is Proposed until Dr. Gupta approves the platform.

**Stack (Proposed)**

| Layer | Pick | Why | Tradeoff |
| --- | --- | --- | --- |
| Front end | React, TypeScript (strict), Vite, installable PWA | Matches the lead that CMAI Tracker uses it; widely taught | A single-page app needs care to stay light on old phones. A size budget enforces it |
| API | Node.js (current LTS), Fastify, Zod for input checks | Same language as the front end, so one student can work on both | Fewer ODU students know Fastify than Express. It is small and well documented |
| Database | PostgreSQL, Drizzle ORM, SQL migration files in the repo | Free, standard, strong backups. Migrations are readable SQL | If ODU IT only offers another database, the data layer (Block 3) is the one place that changes |
| Sessions | Server-side sessions, random ID in a Secure, HttpOnly, SameSite cookie | Can be revoked. Nothing sensitive in browser storage | Needs a database read per request. Fine at this size |
| Tests | Vitest (unit, API), Playwright (end to end), axe-core (accessibility) | Standard and fast | None worth noting |
| Packaging | Docker Compose: app, database, reverse proxy with HTTPS | One command to run. Same on every machine | If ODU IT does not allow containers, Block 8 documents a plain Node service instead |
| CI | GitHub Actions | Free for this size. Blocks a bad merge | Assumes the repo is on GitHub (open) |

**What the ODU CS Systems Group site says (read Nov 10, public pages)**

- The department's database service is MySQL, "available on research servers". PostgreSQL is not mentioned.
- The research server list includes `handson-web.cs.odu.edu`. That is likely the Hands-On Lab's web server and where CMAI Tracker runs. Unconfirmed.
- Personal web hosting serves files and PHP from `~/secure_html`. It does not run a Node service, so it does not fit this app.
- What this changes: the database pick may have to become MySQL. Drizzle supports both, and Block 3 keeps all SQL in one layer, so the cost is small if we learn it before Block 3. It is now the first question for Dr. Gupta and root@cs.odu.edu.
- Sources: [CS Services](https://systems.cs.odu.edu/services/), [MySQL Database](https://systems.cs.odu.edu/services/mysql/), [Research Servers](https://systems.cs.odu.edu/linux/research/), [Personal CS Webpages](https://systems.cs.odu.edu/services/website/).

**Repo layout (Proposed)**

```text
tummy-time/
  apps/web/        React PWA
  apps/api/        Fastify API
  packages/shared/ Types and validation shared by web and api
  content/         Lessons and safety card as files (no code)
  docs/            This plan, decisions (ADRs), data map, threat model, runbook
  infra/           Docker Compose, proxy config, backup scripts
  .github/         CI workflows, PR template, Dependabot
```

**Seams for open decisions**

Each seam is one folder with one interface. A client answer changes what is inside the folder, nothing else.

| Seam | Lives in | Default for the skeleton | Can become |
| --- | --- | --- | --- |
| Sign-in | `apps/api/src/auth/providers/` | Family code + PIN. Stores no personal information, needs no email service | Email one-time code, or both side by side |
| Lessons and pathways | `content/` plus a schema in `packages/shared` | One placeholder lesson, one placeholder safety card | The client's full library and intake rules, with no code change per lesson |
| Study and survey | Feature flags, off by default | Nothing built, nothing collected | In-app consent and survey, or a link out to REDCap |
| Hosting | `infra/` | Docker Compose on any Linux machine | Whatever ODU IT supports |
| Media | A `videoUrl` field per lesson | No video | ODU-hosted video with captions and transcript |
| Email | One `sendMessage` interface, logs to console in development | No real email sent | An ODU mail service, only if email sign-in is chosen |
| Language | All screen text in a string catalog | English | Spanish or others later, without touching components |

**How sync works (Proposed)**

- The server is the source of truth.
- The phone saves each log entry locally first with a random ID made on the phone, then sends it. Sending twice is harmless because the ID is the same.
- On open and on regaining focus, the phone pulls anything changed since its last pull.
- If two phones edit the same entry, the newest edit wins. Deleted entries are marked deleted, not erased, so a delete also syncs.
- No live push in v1. A second phone sees a new entry when it opens or refreshes.
- Tradeoff: "newest edit wins" can drop one of two edits made offline at the same moment. For a tummy time log that risk is small and the rule is easy for the next student to reason about.

**Three suggestions that differ from earlier plans**

1. **Family code + PIN as the skeleton sign-in.** It works before ODU email exists, stores no personal information, and proves sync on two phones. Tradeoff: a caregiver who loses the code has no email to recover with. Block 10 settles recovery once the client picks.
2. **A temporary staging site off campus, sample data only,** until the ODU server is ready. ODU IT approval was called a long pole, and this keeps demos from waiting on it. Tradeoff: one more environment to keep in step, and it needs your OK since the direction is "on ODU servers". Nothing real ever goes there.
3. **Build to WCAG 2.2 AA,** which includes everything in 2.1 AA plus newer rules on tap target size and focus. Tradeoff: a little more checking per screen.

## Standards gates

Every pull request passes the automatic gate, and every block passes the block gate, starting at Block 1. A gate is never bypassed: a failing check is fixed at its cause or the work stops and escalates.

**Never allowed, in any block**

- Skipping, deleting or weakening a test to get a green build.
- Turning off a lint or type rule without a written reason in the code and the PR.
- Secrets, real names, real emails or real participant data in the repo, logs, test data or AI chats.
- A new stored field that is not in `docs/data-map.md`.
- Medical wording shown without the placeholder label or a recorded clinician sign-off.
- Third-party trackers, analytics, ad scripts, or fonts and scripts loaded from outside our own server.
- Merging your own pull request without a second reviewer.

**Automatic gate (CI, every pull request)**

| Check | Tool | Fails the build when |
| --- | --- | --- |
| Types | TypeScript strict | Any type error, any unexplained `any` |
| Lint | ESLint with accessibility rules (jsx-a11y) | Any error |
| Unit and API tests | Vitest | Any failure, or coverage drops on auth, sync, corrected-age math, safety card |
| End to end | Playwright on a phone-sized screen | The skeleton path breaks |
| Accessibility scan | axe-core on every screen, inside Playwright | Any violation |
| Dependencies | `npm audit` level high, plus OSV scan | A known high or critical flaw with a fix available |
| Secrets | gitleaks | Anything that looks like a key or password |
| Code scanning | GitHub CodeQL | A new high-severity finding |
| Data map | Our own test: database columns must match `docs/data-map.md` | A column exists that the map does not list |
| Content | Our own test: every lesson file matches the schema | A lesson is marked approved with no approver name and date |
| Size | Bundle size check | First load passes the budget set in Block 2 |

**Block gate (people and a senior model, at the end of each block)**

| Area | Standard | What gets checked |
| --- | --- | --- |
| Security | OWASP Application Security Verification Standard (ASVS), Level 1 everywhere, Level 2 for sign-in and sessions. OWASP Top 10. OWASP cheat sheets for sessions, authentication and password storage. NIST SP 800-63B for PIN and code rules | Threat model updated if data flows changed. Fable 5.2 reviews any change to sign-in, sessions, sync or data access against the ASVS items listed on the block card |
| Accessibility | WCAG 2.2 AA (floor: 2.1 AA) | Keyboard only. VoiceOver on iPhone and TalkBack on Android by a person. 200% zoom and a 320 px wide screen. Contrast. Tap targets at least 44 px. Reduced motion honored. Captions and transcript on any video |
| Privacy | Data minimization. Lab data rules | Data map current. No personal information with study data. Sample data only. Consent and survey flags off |
| Plain language | content-style-guide.md, 6th to 8th grade | Reading level scored on any caregiver text. No blame, no jargon |
| Clinical safety | Clinician sign-off before anything is shown as final | Placeholder label visible. "When to call" card reachable in one tap from every screen. Its tests pass |
| Real use | definition-of-done.md | Used on a real iPhone and a real Android phone, one of them older. Works on a slow connection and offline where the block says so |
| Handover | A new student can follow it | README and runbook updated. Decision recorded as an ADR if one was made. Credits added for any library, asset or source |

**Security controls in place from Block 1, 3 and 4 (not added later)**

- HTTPS only, HSTS, a strict Content Security Policy, no inline scripts, same-origin API.
- Every API input validated with a schema. Every database query parameterized by the ORM.
- Every request for data checks that the data belongs to the signed-in account. This rule has its own tests.
- Rate limits and lockouts on sign-in. PINs stored only as Argon2id hashes.
- Session cookies are Secure, HttpOnly and SameSite. State-changing requests check origin. Sessions expire and can be revoked.
- Logs carry no personal information, PINs, codes or session IDs.
- The app connects to the database as a low-privilege user. Migrations use a separate one.
- Dependencies locked, updated weekly by Dependabot, CI actions pinned to exact versions.
- Backups are automatic, and a restore is practiced, not assumed (Block 8).

**Not yet known:** ODU's own security and web standards for campus-hosted apps. That is a question for ODU IT, and Block 8 adds whatever they require.

## Model routing

Fable 5.2 designs and reviews, Opus 5.5 builds the hard parts, Sonnet 5.5 builds everything routine, and Haiku 5.5 does mechanical chores. The writer of a change is never its reviewer.

| Model | Use it for | Do not use it for |
| --- | --- | --- |
| Fable 5.2 | Revising this plan. Decisions and their ADRs. The threat model. Designing sign-in, sessions and sync. Security review at each block gate. Any case where the plan is silent or wrong | Typing routine code. Long open-ended sessions. Give it one question, the block card and the diff |
| Opus 5.5 | Building sign-in, sessions, sync, the offline queue and migrations. Finding the root cause of a hard bug. Reviewing Sonnet's pull requests | Work a block card already spells out step by step |
| Sonnet 5.5 | The default builder: screens, components, plain API routes, tests, content schema, docs, CI setup | Deciding anything the card does not decide |
| Haiku 5.5 | Renames, formatting, changelog lines, reading-level scoring of text, summarizing a dependency update, tidying meeting notes | Anything that touches sign-in, data access or the safety card |

**Rules that make cheaper models safe**

1. A builder gets three things: the block card, the repo's `CLAUDE.md`, and the standards gates. Nothing else is needed, and nothing else should steer it.
2. A builder follows the card's steps in order and stops at the first "stop and ask" trigger. It never widens the task.
3. Two failed attempts at the same step means escalate one level: Haiku to Sonnet, Sonnet to Opus, Opus to Fable. Do not retry a third time at the same level.
4. Review goes up or sideways, never down: Sonnet's work is reviewed by Opus, Opus's security-sensitive work by Fable, each in a fresh session that sees only the diff and the card.
5. People keep three jobs no model does: Devin approves every merge to the main branch, a person tests on real phones with a screen reader, and the client's clinician signs off medical content.

**How Fable 5.2 stays efficient**

- It works at the start of a block (write or tighten the card) and at the end (review), not in the middle.
- Roughly: one Fable session to open a hard block, one to close it. Routine blocks need Fable only at the stage gates (after Block 8 and Block 16).
- If Fable finds the same kind of mistake twice in review, the fix goes into the card or `CLAUDE.md`, so the cheaper model stops making it.

Your own method card on model routing (MC-48) was not readable from this session, so this section has not been checked against it. Where they differ, the card wins.

## Block map

Blocks 0 to 8 build the walking skeleton and wait on no client answer. Blocks 9 to 16 turn it into the client's app, and most of them open only after Block 9 (discovery).

Size is relative effort, not hours: S is a sitting or two, M is several, L is the biggest kind of block here. Hours wait on Muhammad's availability.

```text
Block 0 -> Block 1 -> Block 2 (app shell) -> Block 5 (first lesson) ----------+
                   |             |                                         v
                   |             +--> Block 4 (sign-in) -> Block 6 (log) -> Block 7 (offline) -> Block 8 (deploy, gate)
                   +--> Block 3 (data and API) --^
```

After Block 1 the work splits into a screens lane (2, then 5) and a data lane (3, then 4, then 6). They meet at Block 7.

**Stage A: foundation (the walking skeleton)**

| # | Block | Needs first | Waits on a person | Builder | Reviewer | Size |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Ground rules and records | Nothing | Devin: repo. Dr. Gupta: stack OK | Fable (decisions), Sonnet (files) | Devin | S |
| 1 | Scaffold and quality pipeline | 0 | Nobody | Sonnet | Opus | M |
| 2 | Design foundations and app shell | 1 | Nobody | Sonnet | Opus, plus a person with a screen reader | M |
| 3 | Database and API spine | 1 | Nobody | Opus | Fable | M |
| 4 | Sign-in and sessions | 2, 3 | Nobody | Opus | Fable | L |
| 5 | Content pipeline and first lesson | 2 | Nobody | Sonnet | Opus | M |
| 6 | Tummy time log and sync | 4 | Nobody | Opus | Fable | L |
| 7 | Offline and install | 5, 6 | Nobody | Opus | Fable | M |
| 8 | Deploy, runbook and skeleton gate | 7 | Dr. Gupta and ODU IT: server. Devin: staging OK | Sonnet (scripts), Fable (gate review) | Devin, Muhammad | M |

Blocks 2 and 3 can run side by side. So can 5 and 4.

**Stage B: the client's app**

| # | Block | Needs first | Waits on a person | Builder | Reviewer | Size |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | Discovery and requirements | Nothing. Runs alongside Stage A | Client: first meetings | Devin, with Fable | Client | M |
| 10 | Final sign-in and account recovery | 4, 9 | Client: method. ODU IT: email, if chosen | Opus | Fable | M |
| 11 | Intake and pathways | 5, 9 | Client: pathways and intake questions | Sonnet | Opus | M |
| 12 | Lesson library, media and quick checks | 11 | Client: scripts, images, videos. ODU IT: video hosting | Sonnet | Opus | L |
| 13 | Full log and "Baby crying?" coach | 6, 9 | Client: what the coach should say | Sonnet (screens), Opus (data) | Opus, Fable | L |
| 14 | Safety card and clinical sign-off | 5, 9 | Client's clinician | Sonnet | Fable, clinician | S |
| 15 | Study module | 9 | IRB ruling. Client and Dr. Gupta: measures. REDCap answer | Opus | Fable | M, or none |
| 16 | Hardening, client acceptance and handoff | All that are in scope | Client: acceptance. Dr. Gupta: ownership | Fable (audit), Sonnet (fixes) | Devin, client | L |

**Two stage gates**

- **After Block 8:** the skeleton is reviewed whole. Security review against ASVS, a full accessibility pass, the two-phone test, and a new-student test where Muhammad (or the helper) sets it up from the README alone.
- **After Block 16:** the same, plus the client's acceptance.

The plan is re-read by Fable after Block 9, because the client's answers will change Blocks 10 to 15. Changing those cards then is expected, not a failure.

## Block cards

Stage A cards are detailed enough to build from today. Stage B cards are outlines on purpose: their steps depend on client answers, and Fable rewrites each one to Stage A detail after Block 9.

Every card inherits the standards gates above. "Done when" lists only what is extra for that block.

### Block 0: Ground rules and records

- **Goal:** the repo exists with the rules, decisions and records every later block relies on.
- **Model:** Fable 5.2 writes the ADRs and threat model. Sonnet 5.5 creates the files. Devin approves.
- **Inputs:** this plan, the seven knowledge files, `extras/repo-CLAUDE.md`.

Steps

1. Devin creates a private repo and says where it is. The assistant attaches it.
2. Protect the main branch: pull request required, one approving review, CI must pass, no force push.
3. Add `CLAUDE.md` from `extras/repo-CLAUDE.md`, plus the "never allowed" list and the escalation rules from this plan.
4. Add `docs/`: this plan as `build-plan.md`, the knowledge files, and `definition-of-done.md`.
5. Write `docs/adr/` records, one page each: 001 stack, 002 repo layout, 003 sign-in seam and family code + PIN default, 004 sessions, 005 sync rule, 006 content as files, 007 hosting and packaging. Each states the decision, the options not taken, and what would reopen it.
6. Write `docs/data-map.md`: every stored field, why it is stored, who can read it, when it is deleted. Start with the tables listed in Block 3.
7. Write `docs/threat-model.md` using STRIDE: what we protect, who might attack, each data flow, each risk and its control, and which block builds the control.
8. Add `SECURITY.md` (how to report a problem), `CREDITS.md` (people, libraries, sources, and that AI assistance was used), a PR template, and a license placeholder marked "ownership open".

Done when

- A person who has never seen the project can read `README.md` and `docs/` and say what the app is, what is decided, and what is open.
- Every table planned in Block 3 appears in the data map.
- Dr. Gupta has seen ADR 001 and has not objected, or his answer is recorded.

Stop and ask if

- The repo must live somewhere without GitHub Actions. The CI plan in Block 1 changes.
- Dr. Gupta wants a different stack. Fable revises ADR 001 and the affected cards before any code.

### Block 1: Scaffold and quality pipeline

- **Goal:** an empty app that builds, tests and deploys nothing yet, with every automatic gate already switched on.
- **Model:** Sonnet 5.5 builds. Opus 5.5 reviews.
- **Inputs:** ADR 001, 002. The automatic gate table.

Steps

1. Create the workspace with pnpm: `apps/web`, `apps/api`, `packages/shared`, `content`, `infra`. Pin the Node version in `.nvmrc` and `package.json`.
2. `apps/web`: Vite, React, TypeScript strict. One page that says "Tummy Time" and calls the health check.
3. `apps/api`: Fastify, TypeScript strict. One route, `GET /api/health`, returning `{ "ok": true }`.
4. `packages/shared`: one Zod schema used by both, to prove the sharing works.
5. Add ESLint (with `jsx-a11y` and security rules), Prettier, and a pre-commit hook that runs lint and gitleaks.
6. Add Vitest with one real test in each app. Add Playwright with one test that opens the page on a phone-sized screen and runs axe.
7. Add `infra/docker-compose.yml`: web, api, PostgreSQL, each with a health check. `pnpm dev` starts everything.
8. Add `.env.example` with every variable named and no real values. The app refuses to start if a required one is missing.
9. Add the GitHub Actions workflow with every row of the automatic gate table. Pin each action to a full commit SHA. Give the workflow read-only permissions.
10. Add Dependabot for npm, Docker and Actions, weekly.
11. Write the README: what it is, how to run it in five commands, how to run the tests, where the docs are.

Done when

- A fresh clone runs with the README's commands and nothing else.
- Each gate has been seen to fail once: push a deliberate type error, a failing test, an image with no alt text and a fake secret on a throwaway branch, confirm CI goes red for each, then delete the branch.
- The data-map and content tests exist, even though they have little to check yet.

Stop and ask if

- A gate tool needs a paid plan or an account the lab does not have.
- Any dependency shows a high or critical flaw on day one with no fix available.

### Block 2: Design foundations and app shell

- **Goal:** the frame every screen sits in, accessible by construction, so later screens cannot easily be built wrong.
- **Model:** Sonnet 5.5 builds. Opus 5.5 reviews. A person does the screen reader pass.
- **Inputs:** content-style-guide.md, the concept mockup (as a lead for look and tone only), definition-of-done.md.

Steps

1. Define design tokens in one file: colors (every text pair at 4.5:1 contrast or better), type scale (body text 16 px minimum, in `rem`), spacing, radius. Light theme only for now.
2. Build base components, each with its own tests and axe check: Button, Link, TextField with label and error, Card, Dialog, Alert, Skip link, Spinner with a text alternative.
3. Every tap target is at least 44 by 44 px. Every focus state is clearly visible. Nothing depends on color alone.
4. Build the app shell: a header, a main area, a bottom bar with Home, Lessons, Log, and a "When to call" button that is reachable in one tap from every screen.
5. Build the home screen with two primary actions: "Start tummy time" and "Baby crying? Try this". Both lead to placeholder screens for now.
6. Build the standard states once and reuse them: loading, empty, error with a way forward, offline notice.
7. Put every piece of screen text in a string catalog (`apps/web/src/strings/en.ts`). No text typed inside components.
8. Honor `prefers-reduced-motion`. No animation is required to understand anything.
9. Add a routing layer with a page title and a focus move on every navigation, so screen readers announce the new page.
10. Set the first-load size budget (suggested: 150 KB of compressed script) and add the CI check.
11. Add a `/styleguide` page, visible in development only, showing every component and state.

Done when

- Every screen and the style guide pass axe with zero violations.
- A person completes Home, then "When to call", then back, with keyboard only, with VoiceOver on an iPhone and with TalkBack on an Android phone. Notes go in the PR.
- The layout holds at 320 px wide and at 200% zoom with no sideways scrolling.
- All caregiver text scores at 8th grade or lower.

Stop and ask if

- The client's logo, colors or storyboard arrive. They replace the tokens, and contrast is re-checked.
- A component is needed that is not on the list. Add it to the card first.

### Block 3: Database and API spine

- **Goal:** the database, the migration process and the API rules that every later route follows.
- **Model:** Opus 5.5 builds. Fable 5.2 reviews.
- **Inputs:** ADR 001, 004, 005. `docs/data-map.md`. `docs/threat-model.md`.

Steps

1. Add Drizzle and the first SQL migration. Tables for the skeleton, and nothing more:
   - `accounts`: `id`, `code_lookup`, `pin_hash`, `failed_attempts`, `locked_until`, `created_at`.
   - `sessions`: `id_hash`, `account_id`, `created_at`, `last_seen_at`, `expires_at`.
   - `tummy_logs`: `id` (made on the phone), `account_id`, `started_at`, `duration_seconds`, `rev`, `updated_at`, `deleted_at`.
   - `audit_events`: `id`, `type`, `account_id`, `created_at`.
2. No names, emails, birth dates, free-text notes or IP addresses in any table.
3. Create two database users: one that can only read and write rows (used by the app), one that can change tables (used only by migrations).
4. Add `pnpm db:migrate`, `pnpm db:seed` (made-up data only) and `pnpm db:reset` (development only, refuses to run elsewhere).
5. Make the data-map test real: it reads the live schema and fails if any column is missing from `docs/data-map.md`, or the reverse.
6. Set the API rules in one place: every route declares a Zod schema for its input and output; unknown fields are rejected; errors use one shape, `{ "error": { "code", "message" } }`, and never leak stack traces.
7. Add security headers (CSP with no inline script, HSTS, no-sniff, frame denial, a strict referrer policy), a request size limit, and a general rate limit.
8. Add structured logging with a redaction list: PIN, code, cookie and authorization headers never reach a log. Add a test that proves it.
9. Add one helper that every data query must go through, which always filters by the signed-in account. Add a lint rule or test that fails if a route queries `tummy_logs` without it.
10. Add `infra/backup.sh` and `infra/restore.sh`. Run a backup and a restore locally and record the steps in `docs/runbook.md`.

Done when

- Migrations run from empty to current, and the seed loads.
- The redaction test, the data-map test and the "always filter by account" test each fail when deliberately broken, then pass.
- A backup restores into a fresh database and the seeded rows are there.
- Fable has reviewed against ASVS sections on validation, error handling, logging and data protection.

Stop and ask if

- ODU IT names a database that is not PostgreSQL. Fable revises ADR 001 before more is built on it.
- A field seems needed that is not in the data map. The map changes first, with Devin's OK.

### Block 4: Sign-in and sessions

- **Goal:** a caregiver can create an account and sign in on two phones, through a seam that lets the method change later.
- **Model:** Fable 5.2 confirms the design in ADR 003 and 004 first. Opus 5.5 builds. Fable 5.2 reviews in a fresh session.
- **Inputs:** ADR 003, 004. Threat model. OWASP cheat sheets for authentication, session management and password storage. NIST SP 800-63B.

Steps

1. Define the seam in `apps/api/src/auth/`: an `AuthProvider` interface with `startSignUp`, `finishSignUp`, `startSignIn`, `finishSignIn`. Routes call the interface, never a provider directly.
2. Build the default provider, `family-code-pin`:
   - Sign-up makes a family code: 12 characters from an alphabet with no look-alikes (no 0, O, 1, I, L), shown as three groups of four. It comes from the system's secure random source.
   - The caregiver chooses a 6-digit PIN. Reject the most common ones (123456, 000000, and similar).
   - Store `code_lookup` as a keyed hash (HMAC-SHA-256 with a server secret) so the code can be found but never read back. Store `pin_hash` with Argon2id.
   - The code is shown once, with plain advice to write it down or screenshot it, and a clear note that it cannot be recovered yet.
3. Sign-in takes code and PIN. Wrong code and wrong PIN return the same message and take the same time.
4. Lockout: 5 wrong PINs lock that account for 15 minutes. Separate rate limit per network address on sign-in and sign-up. Neither limit stores the address in the database.
5. Sessions: a 256-bit random token in a cookie that is Secure, HttpOnly, SameSite=Lax, path `/`. Store only its SHA-256 hash. Expire after 30 days unused or 90 days in total. Issue a new token on sign-in.
6. Reject any state-changing request whose `Origin` is not our own site, and require a custom header on API calls.
7. Add `POST /api/auth/sign-out` (this phone) and `POST /api/auth/sign-out-everywhere`.
8. Add `GET /api/me` and `DELETE /api/me`. Delete removes the account, its sessions and its logs for good.
9. Write an `audit_events` row for sign-up, sign-in, failed sign-in, lockout, sign-out and account deletion. No PIN, code or token in any of them.
10. Build the screens with Block 2 components: Welcome, Create account, Your family code, Sign in, Signed out. Show the line "This app does not replace advice from your baby's care team." on sign-up.
11. Add a second provider, `dev-fake`, that works only when the environment is development or test, for end-to-end tests.

Done when

- Tests cover: sign-up, sign-in, wrong PIN, lockout and its release, expired session, sign-out on one phone leaving the other signed in, sign-out everywhere, account deletion removing every row, a request with a foreign `Origin` being refused, and one account being unable to read another's data.
- The same account is signed in on two real phones at once.
- Every sign-in screen passes the screen reader pass, including error messages being announced.
- Fable's review walks the ASVS authentication and session items and each is marked met, not applicable with a reason, or fixed.

Stop and ask if

- The client's sign-in answer arrives mid-block. Finish the seam, then go to Block 10.
- Anything tempts you to write your own cryptography. Use the platform's or a well-known library's, and name it in CREDITS.

### Block 5: Content pipeline and first lesson

- **Goal:** lessons and the safety card are files that non-programmers can supply, and the app refuses to present unsigned medical content as final.
- **Model:** Sonnet 5.5 builds. Opus 5.5 reviews.
- **Inputs:** ADR 006. content-style-guide.md (lesson template). definition-of-done.md.

Steps

1. Define the lesson schema in `packages/shared`: `id`, `title`, `goal`, `body` (Markdown), `steps` (each with text and an optional image and alt text), `videoUrl`, `captionsUrl`, `transcript`, `checks` (questions, added in Block 12), `pathways` (tags), `status` (`placeholder` or `approved`), `approvedBy`, `approvedOn`.
2. Define the safety card schema the same way: `emergencyLine`, `callToday` items, `status`, `approvedBy`, `approvedOn`.
3. The content test fails the build if `status` is `approved` without a name and date, if an image lacks alt text, or if a video lacks captions and a transcript.
4. Write one placeholder lesson and one placeholder safety card in `content/`. Mark both `placeholder`. Take wording only from the style guide's safety basics, and nothing clinical beyond it.
5. Build the lesson screen and the "When to call" screen. Any item with `status: placeholder` shows a visible banner: "Draft. Not yet reviewed by a clinician."
6. Render Markdown with a sanitizer. No raw HTML from content files reaches the page.
7. The emergency line on the safety card is fixed text with its own test: "Trouble breathing or turning blue: call 911."
8. Write `docs/adding-a-lesson.md`: how the client's material becomes a file, step by step, for a student who has never seen the repo.

Done when

- A new lesson appears in the app by adding one file, with no code change.
- Changing the placeholder lesson to `approved` without a name makes CI fail.
- The lesson text scores at 8th grade or lower.
- The safety card opens in one tap from every screen, and its tests pass.

Stop and ask if

- You are about to write medical advice the style guide does not already contain. Leave a marked gap instead.
- The client sends real content. It goes through Block 12 and 14, not here.

### Block 6: Tummy time log and sync

- **Goal:** a caregiver logs one tummy time on one phone and sees it on another.
- **Model:** Opus 5.5 builds. Fable 5.2 reviews.
- **Inputs:** ADR 005. The account-filter helper from Block 3.

Steps

1. API: `PUT /api/logs/:id` creates or updates an entry (the phone makes the ID, a random UUID). `DELETE /api/logs/:id` marks it deleted. `GET /api/logs?since=<rev>` returns every entry changed after that revision, plus the newest revision number.
2. The server gives every write the next number from one counter and stores it in `rev`. "Newest wins" means the last write to reach the server.
3. Validate hard: `duration_seconds` between 1 and 7,200; `started_at` not in the future and not before a year ago; the ID is a valid UUID; the entry belongs to the signed-in account or does not exist yet.
4. On the phone, keep entries in IndexedDB. Every change is saved locally first and added to an outbox. The outbox sends when online and retries with growing waits.
5. Pull on app open, on return to the foreground, and after the outbox empties. Store the last revision number seen.
6. Build the screens: "Start tummy time" with a large start and stop control and a running time that screen readers can query but that does not announce every second; a manual "Add a time" form; a simple list of entries by day; delete with an undo.
7. Show sync state in plain words: "Saved on this phone", "Saved", "Can't reach the server. We'll try again."
8. Praise effort in the wording, per the style guide. No streaks, targets or red marks in the skeleton.

Done when

- Tests cover: create, edit, delete, sending the same write twice, two phones editing the same entry, pull after a long gap, an entry for another account being refused, and each validation limit.
- On two real phones signed in to one account: add on A, open B, it is there. Delete on B, open A, it is gone.
- The timer and the list pass the screen reader pass.

Stop and ask if

- Someone asks for notes, baby names or photos on an entry. That is personal information and a client decision (Block 13).
- Sync needs to be live. That is a design change for Fable, not a patch.

### Block 7: Offline and install

- **Goal:** the app installs from a link and stays useful with no signal.
- **Model:** Opus 5.5 builds. Fable 5.2 reviews the caching rules.
- **Inputs:** Blocks 5 and 6 working.

Steps

1. Add `vite-plugin-pwa`. Write the web app manifest: name, short name, icons including a maskable one, start URL, standalone display, theme colors from the tokens.
2. Cache the app shell and content files for offline use. Never cache API responses in the service worker; the IndexedDB store from Block 6 is the only offline data.
3. When a new version is ready, show "Update available" with a button. Never reload under a running timer.
4. Offline behavior: lessons already loaded open, the safety card always opens, the log accepts entries, sign-in explains that it needs a connection.
5. On sign-out and account deletion, clear IndexedDB and every cache that could hold that account's data.
6. Add an "Add to your home screen" help page with steps for iPhone Safari and Android Chrome, since iPhone has no install prompt.
7. Add Playwright tests that switch the network off: open a lesson, open the safety card, add a log entry, come back online, confirm it reaches the server.

Done when

- Installed to the home screen on a real iPhone and a real Android phone, and opened in airplane mode.
- An entry made offline appears on the second phone after the first reconnects.
- After sign-out, nothing from the account can be read on the phone, checked in the browser's storage tools.
- Lighthouse on a simulated mid-range phone: performance 90 or better, accessibility 100, PWA installable.

Stop and ask if

- A caching rule would keep a safety card or lesson on a phone after its content changed. Stale medical text is a safety problem; Fable decides the rule.

### Block 8: Deploy, runbook and skeleton gate

- **Goal:** the skeleton runs on a server with HTTPS, backups and a runbook, and passes the first stage gate.
- **Model:** Sonnet 5.5 writes scripts and docs. Fable 5.2 runs the gate review. Devin handles ODU IT.
- **Inputs:** answers from Dr. Gupta and ODU IT. Devin's OK for temporary staging, if used.

Steps

1. Send ODU IT the hosting questions: what the server runs, whether containers are allowed, which database, how HTTPS certificates are issued, who patches it, how backups work, what security review they require, where video can live.
2. If Devin approves, stand up temporary staging with sample data only, using the same Docker Compose files. Label every page "Test site. Sample data."
3. Write the production Compose file: reverse proxy with HTTPS, the app, the database not reachable from outside, secrets from the server's environment and never from the repo.
4. Add a deploy script that runs migrations, starts the new version, checks health, and rolls back if the check fails.
5. Schedule the backup script. Store backups off the app's own disk. Restore one into a clean database and time it.
6. Add basic monitoring: an uptime check on `/api/health` and an alert to a person when it fails.
7. Write `docs/runbook.md`: deploy, roll back, restore, rotate a secret, lock an account, read logs, who to call at ODU IT.
8. Write `docs/next-student.md`: a one-hour path from zero to a first small change merged.
9. Run the stage gate: Fable reviews the whole app against ASVS Level 1 and the threat model; a person does the full accessibility pass; Muhammad or the helper sets up from the README with no help; the two-phone test runs on the deployed site.
10. Record every finding as an issue. Fix all high and medium findings before Stage B work merges.

Done when

- The skeleton path works on the deployed site from two real phones.
- A restore has been performed and written up.
- The new-student test passes without the tester asking anyone a question, or each question became a README fix.
- Devin has demoed it to Dr. Gupta.

Stop and ask if

- ODU IT's setup rules out part of the stack. Fable revises the ADRs and this card.
- ODU IT asks for a security review or scan. Do it before going live, and add it to the runbook.

### Block 9: Discovery and requirements

- **Goal:** replace leads with the client's own answers, written down and confirmed by her.
- **Who:** Devin runs the meetings. Fable 5.2 turns notes into requirements and revises Blocks 10 to 15.
- **Runs alongside Stage A.** It does not wait for the skeleton, and the skeleton does not wait for it.

Steps

1. First meeting, three questions before any demo: tell us about a family who gave up on tummy time; what content exists today and who signs it off; what the grant needs to show at the end.
2. Show four mockup screens, not nine: home, a lesson, "Baby crying?", "When to call". Ask what is wrong, not whether she likes it.
3. Work through the open questions by block: sign-in method and the "no personal information" line (10), pathways and intake (11), content supply and video (12), what the log and the crying coach should do (13), the clinician (14), any study, the IRB and REDCap (15), ownership after the grant (16).
4. Send a "what we heard" recap within a day, using the meeting notes template. No dates in it.
5. Update decisions-log.md and open-questions.md. Mark each old lead confirmed, changed or dropped.
6. Write `docs/requirements.md`: users, what each screen must do, what is out, and how the client will judge it done.
7. Fable rewrites the Stage B cards to Stage A detail and re-sizes them.

Done when

- The client has read the requirements and said yes in writing.
- No Stage B card still rests on a lead.

### Block 10: Final sign-in and account recovery

- **Goal:** the sign-in the client chose, with a way back in for a caregiver who is locked out.
- **Model:** Opus 5.5 builds. Fable 5.2 designs recovery and reviews.
- **Depends on the answer:**
  - Family code + PIN stays: add recovery (for example a one-time recovery phrase shown at sign-up, or reset by the clinic). Add a "show my code" screen for a signed-in phone.
  - Email one-time code: add the `email-otp` provider behind the same seam and the ODU mail service behind `sendMessage`. The email address goes in the data map, stored apart from any study data. Codes expire in 10 minutes and are single use.
  - Both: a caregiver may attach an email to a family code account as their recovery method.
- **Always:** the Block 4 tests are extended to the new method, the threat model is updated, and Fable repeats the ASVS review.
- **Stop and ask if:** anyone proposes ODU's own account sign-in (MIDAS) for caregivers. The glossary notes they will not have accounts.

### Block 11: Intake and pathways

- **Goal:** a short set of questions picks which lessons a caregiver sees.
- **Model:** Sonnet 5.5 builds. Opus 5.5 reviews.
- **Outline:** intake questions and the rules that map answers to pathway tags live in a content file, not in code. The questions ask for ranges, not birth dates. Corrected-age math, if used, is one small function with its own tests. A caregiver can change answers later, and can skip intake and browse everything.
- **Open:** which pathways exist, what routes into each, whether intake answers are stored on the server.

### Block 12: Lesson library, media and quick checks

- **Goal:** the client's real lessons, with video, in the app.
- **Model:** Sonnet 5.5 builds. Opus 5.5 reviews. Haiku 5.5 scores reading level.
- **Outline:** lesson list by pathway with progress; video player with captions, transcript, no autoplay and working keyboard controls; quick checks of one or two friendly questions with feedback and no score; images with alt text supplied by the client or drafted for her approval. Each lesson passes the content test and is `placeholder` until Block 14 signs it off.
- **Open:** where video is hosted, how many lessons, whether quick-check answers are stored.

### Block 13: Full log and "Baby crying?" coach

- **Goal:** the two things a caregiver does mid-session, done well.
- **Model:** Sonnet 5.5 builds screens. Opus 5.5 builds data changes. Fable 5.2 reviews anything that adds stored fields.
- **Outline:** log history with a gentle weekly view and no blame; edit and delete; optional sharing between caregivers of one baby, which is already true for anyone using the same family code. The coach is a short, calm, step-by-step screen reachable from home and from a running timer: what to try, when to stop, when to call. Every word of it is clinical content and is placeholder until signed off.
- **Open:** what the coach says (the client and her clinician), whether reminders are wanted, whether any goal or target is shown.

### Block 14: Safety card and clinical sign-off

- **Goal:** every medical word in the app has a named clinician and a date behind it.
- **Model:** Sonnet 5.5 prepares the review pack. Fable 5.2 checks nothing slipped through. The clinician decides.
- **Outline:** export every lesson, the coach and the safety card to one review document; the clinician marks each approved or changes it; changes go into the content files with `approvedBy` and `approvedOn`; the placeholder banner disappears only for approved items; a release with any unapproved item visible to caregivers cannot be tagged as final. A content change after approval resets that item to `placeholder`.
- **Open:** who the clinician is.

### Block 15: Study module

- **Goal:** whatever data collection the IRB approves, and nothing before it does.
- **Model:** Opus 5.5 builds. Fable 5.2 designs the data separation and reviews.
- **This block may be empty.** If the client wants no study, or the survey runs in REDCap, the app needs at most a link.
- **Outline, if in-app:** consent screen and surveys behind flags that are off by default and can only be switched on with a recorded IRB approval; study answers stored under a random study ID with no link to sign-in details; validated questionnaires used word for word with permission recorded; an export for the researchers; a way for a participant to withdraw.
- **Stop and ask if:** anyone wants to collect anything "just to test" before the IRB rules. Use made-up data.

### Block 16: Hardening, client acceptance and handoff

- **Goal:** the client accepts the app, and the next student can own it.
- **Model:** Fable 5.2 runs the audit. Sonnet 5.5 fixes. People do the testing.

Steps

1. Full security review against ASVS and the threat model. Run a web scanner (OWASP ZAP) against staging. Fix every high and medium finding.
2. Full accessibility audit of every screen by hand, WCAG 2.2 AA, on real phones with VoiceOver and TalkBack. Write the accessibility statement.
3. Field test with the nurse and the respiratory therapist Devin offered, on their own phones, with sample data. Watch where they hesitate.
4. Performance check on an older phone and a slow connection.
5. Write the plain-language privacy notice from the data map, for the client's approval.
6. Client acceptance: she walks the requirements from Block 9 on her own phone and signs off, or lists what is left.
7. Handoff: runbook, next-student guide, list of every account and secret and who holds it, the dependency update routine, and a recorded answer on who owns code, content and data.
8. Tag the release. Update CREDITS.

Done when

- The client has accepted in writing.
- A student who was not on the team has deployed a small change using only the docs.

## Risks, asks and sources

The biggest risk is waiting: on the ODU server, on the client's content, and on clinical sign-off. The plan is ordered so that none of them stops Stage A.

**Risks**

| Risk | What happens | What the plan does |
| --- | --- | --- |
| ODU IT approval is slow | No campus server when the skeleton is ready | Same packaging runs anywhere. Temporary staging with sample data, if Devin approves |
| CMAI Tracker's setup differs from this stack | Rework to match the lab's server | Read CMAI's repo before Block 3. Hosting and database each sit behind one seam |
| Client content arrives late or unsigned | Lessons stay placeholder | Content is files, so the app is finished without it and fills in as material arrives. The banner keeps drafts honest |
| Sign-in decision changes late | Rework of accounts | The seam in Block 4. Both methods can live side by side |
| One part-time builder | Slow progress, single point of failure | Small blocks, written cards, routine work done by cheaper models, docs that let a helper join mid-way |
| A study is wanted but the IRB is slow | Pressure to collect early | Flags off by default. Block 15 cannot start without the ruling |
| Scope grows meeting by meeting | The foundation never finishes | Stage A is closed to new features. New asks go to Block 9 and get a card before any code |
| AI-written code nobody on the team understands | The next student cannot maintain it | Every decision has an ADR, every PR has a human approver, and the new-student test is a gate |

**Asks**

| From | What | Unblocks |
| --- | --- | --- |
| Devin | A private repo for the code, and where it should live | Block 0, and everything after |
| Devin | Yes or no to temporary off-campus staging with sample data | Block 8 demos before ODU IT answers |
| Dr. Gupta | CMAI Tracker repo access. Who set up and patches its server. OK on the stack | Blocks 0, 3, 8 |
| Dr. Gupta | In writing, where real data may live, before any real user touches the app | Anything past sample data |
| Muhammad | Email, weekly hours, what he has built before | Sizing and who builds what |
| Client | The first meeting | Block 9, then all of Stage B |
| ODU IT | The hosting questions in Block 8 | Block 8 |

**What I did not do**

- I did not re-check the earlier research brief's sources or the WCAG deadline date.
- I did not read CMAI Tracker's code. Nobody on the project has yet.
- I could not open your method cards from this session (MC-48 routing, MC-93 testing, MC-98 secure coding, MC-102 hosting, MC-103 sign-in and backups). Where a card disagrees with this plan, the card wins and the plan should change.
- The standards below are named from working knowledge. Block 0 confirms the current version of each before the ADRs cite them.

**Standards and sources named in this plan**

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) (authentication, session management, password storage)
- [NIST SP 800-63B, Digital Identity Guidelines](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C
- [AHRQ PEMAT](https://www.ahrq.gov/health-literacy/patient-education/pemat.html) and the CDC Clear Communication Index, from content-style-guide.md
- Project knowledge files: project-brief.md, decisions-log.md, open-questions.md, stakeholders.md, definition-of-done.md, content-style-guide.md, glossary.md
- The Nov 9 and 10 project reevaluation and Devin's direction that followed it

Selection and arrangement by Devin Ferrell, produced with AI assistance.
