# Next student: from nothing to your first merged change

This page is for a second-year CS student who has never seen this project. It is a path, not a lecture. Follow it top to bottom and you will have the app running on your computer, make one tiny change, and have it ready for review. If a step is unclear, or you have to ask someone a question, that is a bug in this page: tell Devin, or fix the page in your pull request.

**Not covered here:** putting the app on a server (that is [docs/runbook.md](runbook.md), sections 12 to 24; the deploy files have been run in Docker with a test certificate, never on a real server, and section 13a shows how to practice the production setup on your own computer) and the plan for what to build next ([docs/build-plan.md](build-plan.md)).

## 0. Three rules before you touch anything

1. **Made-up data only.** Never put a real name, email, phone number, family code or anything about a real baby in the code, in a test, in a screenshot, in an issue or in an AI chat. The sample data the project makes is invented.
2. **Medical words are not yours to write.** Any sentence about babies' health stays a placeholder until a clinician signs it off. Do not "improve" the wording of lessons, the "When to call" card or the "Baby crying?" screen.
3. **Nobody reviews their own change.** You open a pull request; a different person reads it; Devin approves every merge to `main`.

The full rules are in [CLAUDE.md](../CLAUDE.md). Read it once. It is short.

## 1. Install

You need:

| Tool | Why | How to check |
|---|---|---|
| Git | Gets and saves the code | `git --version` |
| Node.js 22.23.4 | Runs the app. The exact version is in `.nvmrc` | `node --version` |
| pnpm 10 | Installs the libraries. Run `corepack enable` once and Node fetches the right pnpm | `pnpm --version` |
| PostgreSQL 16 or 17, with its command-line tools (`psql`, `pg_dump`, `pg_restore`), **or** Docker | The API will not start without a database | `psql --version` or `docker --version` |
| An editor, such as VS Code | | |

[README.md](../README.md) links each one. Windows users: use Git Bash for the commands on this page.

## 2. Get the code

Runs in: your terminal
```bash
git clone https://github.com/ferrelldevin/tummy-time.git
cd tummy-time
corepack enable
pnpm install --frozen-lockfile
```

`--frozen-lockfile` installs exactly the library versions the project was tested with and refuses to change them.

## 3. Your settings file (`.env`)

Runs in: your terminal, in the `tummy-time` folder
```bash
cp .env.example .env
```

Open `.env` in your editor. For your own computer you need to fill in:

- `DB_APP_PASSWORD` and `DB_MIGRATOR_PASSWORD`: make up two passwords. They only protect a database on your own machine.
- `CODE_LOOKUP_SECRET`: make one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and paste it after the `=`.
- If you will use Docker for the database: `POSTGRES_USER` and `POSTGRES_PASSWORD`, any values you make up.

Leave everything else. Everything below the line that says "Production server only" is for servers; ignore it. **`.env` is never committed.** Git ignores it, and a secret scan runs on every commit.

## 4. The database

The API needs two database users and a database. [docs/runbook.md](runbook.md), section 2, has the full steps for both ways. In short:

- **With Docker:** `pnpm db:up` (starts only the database; it makes the two users by itself).
- **Without Docker:** run `infra/db/init-roles.sh` as your PostgreSQL administrator, as section 2 shows.

Then make the tables and add made-up sample data.

Runs in: your terminal, in the `tummy-time` folder
```bash
pnpm db:migrate
pnpm db:seed
```

Why two users? The app's user can only read and write rows, so a bug in the app cannot drop a table. Chapter 3 of the walkthrough explains it.

## 5. Run it

Runs in: your terminal, in the `tummy-time` folder
```bash
pnpm dev
```

Open <http://localhost:5173>. You should see "Tummy Time" and "Server is reachable". If the API says its settings are not right, `.env` is missing something; the message names it. If it says it cannot reach the database, start the database. Section 9 of the runbook lists the messages.

Stop it with `Ctrl+C`.

To run the whole app in containers instead, fill in `CODE_LOOKUP_SECRET` as well, then `pnpm docker:up`. The app is then at <http://127.0.0.1:8080> (use that exact address, not `localhost`). Set `DOCKER_WEB_PORT` in `.env` to use another port.

## 6. Where things are

| Folder | What is in it | Read this chapter |
|---|---|---|
| `apps/web` | The phone app (React) | [Block 2: design and app shell](walkthrough/02-design-foundations.md), [Block 7: offline and install](walkthrough/07-offline-and-install.md) |
| `apps/api` | The server (Fastify) | [Block 3: database and API](walkthrough/03-database-and-api-spine.md), [Block 4: sign-in and sessions](walkthrough/04-sign-in-and-sessions.md) |
| `packages/shared` | Types both sides use | [Block 1: scaffold](walkthrough/01-scaffold.md) |
| `content/` | Lessons and the safety card, as files | [Block 5: content pipeline](walkthrough/05-content-pipeline.md) |
| `apps/web/src/strings/en.ts` | **All text shown on screen** | [Block 2](walkthrough/02-design-foundations.md) |
| `infra/` | Container files, database setup, backup, deploy | [Block 3](walkthrough/03-database-and-api-spine.md), [runbook](runbook.md) |
| `docs/` | Plan, decisions (`adr/`), data map, threat model, style guide | [Walkthrough index](walkthrough/README.md) |

Also read: [docs/data-map.md](data-map.md) (the only data the app may store) and [docs/knowledge/content-style-guide.md](knowledge/content-style-guide.md) (how words are written for caregivers: plain, 6th to 8th grade).

## 7. Make one tiny change

The point of this step is to walk the whole loop once: change, test, commit, review. Do it on a branch.

Runs in: your terminal, in the `tummy-time` folder
```bash
git checkout -b my-first-change
```

**A safe change to try:** a wording fix in the string catalog. All screen text lives in `apps/web/src/strings/en.ts`, so a wording change touches one line and nothing else. Find the Home screen's intro line:

```ts
home: {
  title: "Tummy Time",
  intro: "Pick what you need right now.",
```

Change `intro` to a different plain sentence of your own and save. Choose only a non-medical line like this one. Keep it short, in plain words, with no dates or time frames. If you cannot find a wording fix that is truly better, make the change anyway to learn the loop, and **do not ask for it to be merged**; say so in the pull request.

See it: with `pnpm dev` running, the Home screen updates by itself.

**Which tests will run on your change.** Run them all before you commit:

Runs in: your terminal, in the `tummy-time` folder
```bash
pnpm lint
pnpm typecheck
pnpm test
```

- `pnpm lint` checks code style, accessibility and security rules, and formatting. If it complains about formatting, `pnpm format` fixes it.
- `pnpm test` runs, among others, the **reading-level test** (`apps/web/src/strings/readability.test.ts`): every string must score at 8th grade or lower. A word that is too long or too fancy fails it. That is the test most likely to catch a wording change. It runs on all text in the catalog together and on every sentence-length string.
- The Home screen tests (`apps/web/src/App.test.tsx`) read the text from the catalog, so they follow your change.
- `pnpm test:e2e` runs the phone-sized browser tests with an accessibility scan. It needs a browser; the README says how. Some of those tests look for text by its exact words, so a wording change on a different screen can fail them. If one fails and the message shows the old words, update that test's expected text in the same commit.
- Never skip, delete or weaken a test to get green. If a test seems wrong, say so in the pull request.

Then save it.

Runs in: your terminal, in the `tummy-time` folder
```bash
git add apps/web/src/strings/en.ts
git commit -m "Reword the Home screen intro"
```

A pre-commit hook runs the linters on your changed files. If it prints that `gitleaks` is not installed, the secret scan was skipped on your computer; CI still runs it.

## 8. Open a pull request

Runs in: your terminal, in the `tummy-time` folder
```bash
git push -u origin my-first-change
```

Then open the link Git prints. The pull request form (`.github/pull_request_template.md`) asks for:

- **What changed.** One or two sentences, plain.
- **Why.**
- **Block and card.** Which step of [docs/build-plan.md](build-plan.md) it belongs to.
- **How it was checked.** Tick what you ran. Do not tick what you did not.
- **Credit.** Any library, picture or source you used, and which parts an AI helped draft. Also add it to `CREDITS.md`.

If your change adds a library, a stored field, medical wording or a setting, stop: those each have their own rule in `CLAUDE.md` and need Devin first.

## 9. What review looks like

- A **continuous-integration run** starts by itself: lint, types, tests, build, size budget, browser tests, secret scan. It must be green.
- **A person who is not you** reads the change. Expect questions, such as "why this way?" and "what happens if...?". Answer in the pull request. Small fixes you push to the same branch show up there.
- **Devin approves every merge to `main`.** A change that touches sign-in, sessions, the data map, the server setup or anything about medical words gets a closer read, and may get a second reviewer.
- A change to the structure of the app (a new library, a new kind of storage, a different way to deploy) needs a short decision record in `docs/adr/` first.
- When a block of work is finished, a walkthrough chapter is written for the next student. If your change is more than a small fix, add or update the chapter ([walkthrough/README.md](walkthrough/README.md) shows the five questions each chapter answers).

## 10. If you get stuck

- The message names the problem more often than you expect. Read it twice, then look it up in [runbook.md](runbook.md), section 9.
- Two tries at the same step is the limit: after that, stop and ask, with what you ran and what it printed. (Do not paste a secret into the message.)
- If something on this page was wrong or missing, fixing the page is a good first pull request.
