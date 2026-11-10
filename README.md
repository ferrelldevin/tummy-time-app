# Tummy Time

A learning app for caregivers of babies born early: why tummy time matters, how to do it safely, and how to keep going when the baby cries.

Built by Dr. Ajay Gupta's Hands-On Lab at Old Dominion University for the client who owns the app. It is a prototype foundation that ODU students keep building and maintaining.

**Status:** Block 1 of 17. The app is an empty scaffold with its quality checks switched on: one page that asks the server if it is up. There are no features yet.

## Start here

| If you want to | Read |
|---|---|
| Understand what was built and how, step by step | [docs/walkthrough/](docs/walkthrough/README.md) |
| See the whole plan, block by block | [docs/build-plan.md](docs/build-plan.md) |
| Know why a technical choice was made | [docs/adr/](docs/adr/README.md) |
| Know what data the app may store | [docs/data-map.md](docs/data-map.md) |
| Know what could go wrong and what stops it | [docs/threat-model.md](docs/threat-model.md) |
| Know the writing rules, the definition of done and the glossary | [docs/knowledge/](docs/knowledge/) |

## Rules that never bend

- Made-up sample data only. No real participant data or personal information in this repo, its issues, its logs or any AI chat.
- Medical content is a placeholder until the client's clinician signs it off by name and date.
- Nothing for a study is collected before the IRB rules. Consent and survey screens ship switched off.
- No stored field exists unless it is listed in `docs/data-map.md`.
- Not a certification. Not medical advice.

## Running it

### You need

- [Node.js](https://nodejs.org/) 22.23.4 (the version in `.nvmrc`; `nvm use` picks it).
- [pnpm](https://pnpm.io/) 10. Run `corepack enable` once and Node fetches the right version for you.
- Optional: [Docker](https://www.docker.com/) to run the whole stack in containers, and [gitleaks](https://github.com/gitleaks/gitleaks#installing) so the pre-commit hook can scan for secrets (the hook says so if it is missing; CI always scans).

### Run it in five commands

```sh
git clone https://github.com/ferrelldevin/tummy-time.git && cd tummy-time
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Open http://localhost:5173. You should see "Tummy Time" and "Server is reachable". The API listens on port 3001. If the API says its settings are not right, `.env` is missing or incomplete.

### Run the tests

| What | Command |
|---|---|
| Lint (ESLint with accessibility and security rules, and Prettier) | `pnpm lint` |
| Types (TypeScript strict) | `pnpm typecheck` |
| Unit and API tests (Vitest) | `pnpm test` |
| Phone-sized end-to-end test with the axe accessibility scan (Playwright) | `pnpm test:e2e` |
| Production build | `pnpm build` |
| First-load size budget (run after `pnpm build`) | `pnpm check:size` |

The first time you run the end-to-end test on your own machine, install the browser with `pnpm --filter @tummy/web exec playwright install chromium`. If your machine already has a Chromium somewhere else, set `PW_CHROMIUM_PATH` to its executable instead.

### Run it in containers (optional)

Fill in the three `POSTGRES_` lines in `.env` with values you make up, then `pnpm docker:up`. The app is at http://localhost:8080.

### Where things are

- `apps/web` is the phone app (React). `apps/api` is the server (Fastify). `packages/shared` is code both use. `content/` will hold lessons. `infra/` holds the container files.
- Plans, decisions, the data map and the threat model are in `docs/` (see the table at the top of this page). Decisions are in `docs/adr/`.
- A step-by-step account of how each block was built is in `docs/walkthrough/`.

## Credit

See [CREDITS.md](CREDITS.md). This project is built with AI assistance, reviewed and approved by people.
