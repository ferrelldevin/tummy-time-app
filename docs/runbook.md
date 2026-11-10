# Runbook

How to get a database, change it, back it up and put a backup back. Every command says where it runs. Commands are written for Git Bash on Windows, or any terminal on macOS and Linux, from the repo root unless the label says otherwise.

Sections 1 to 11 come from Blocks 3, 4 and 7: a database and sign-in settings on your own machine. Sections 12 to 24 are Block 8: the server (deploys, rolling back, restoring, secrets, locking an account, logs, the daily jobs, who to call).

**Read this first about sections 12 to 24.** They were written without Docker. A reviewer then ran them in Docker during the Block 8 review (`docs/security-review-stage-a.md` says exactly what was run). That run used a test certificate that Caddy made for the name `localhost`. It was not a public certificate, not a real server and not real phones. Each section says what was practiced there and what was not. The table in section 22 and the list in section 23 say what to try first on a real server. When a step here is wrong, fix this page in the same pull request that finds it.

## 1. The pieces

| Piece | What it is | Who uses it |
|---|---|---|
| PostgreSQL 16 or 17 | The database server | Everything below |
| The app user (`DB_APP_USER`) | Can read and write rows. Cannot create, change or drop tables | The API, `pnpm db:seed` |
| The migrator user (`DB_MIGRATOR_USER`) | Owns the tables | `pnpm db:migrate`, `pnpm db:reset`, backups and restores |
| An administrator (`postgres` or similar) | Creates the two users and the database, once | `infra/db/init-roles.sh` |
| `apps/api/drizzle/` | The SQL migration files, in order | `pnpm db:migrate` |

Passwords live only in `.env` on your machine (or the server's environment). `.env` is never committed. `.env.example` lists every setting with the passwords left blank.

The API checks at start-up that it is connected as the app user. If it is connected as the migrator or an administrator, it refuses to start and says so.

## 2. Get a database on your machine

Do **one** of these.

### Option A: without Docker

1. Install PostgreSQL 16 or 17 with its command-line tools (`psql`, `pg_dump`, `pg_restore`). On Windows, the installer from postgresql.org includes them; tick "Command Line Tools". On macOS, Homebrew (`brew install postgresql@17`) or Postgres.app. On Ubuntu, `sudo apt install postgresql`. Note the administrator's name (usually `postgres`), its password, and the port (usually `5432`).
2. Make your settings file.

   Runs in: your terminal, repo root
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in `DB_APP_PASSWORD` and `DB_MIGRATOR_PASSWORD` with two passwords you make up. Change `DB_PORT` if your PostgreSQL does not use 5432. Leave the `POSTGRES_` lines empty; they are for Docker only.
3. Create the two users and the database. This connects as the administrator; give its password when asked, or set `PGPASSWORD` for this one command.

   Runs in: your terminal, repo root
   ```bash
   set -a; . ./.env; set +a
   PGHOST=127.0.0.1 PGPORT="$DB_PORT" PGUSER=postgres bash infra/db/init-roles.sh
   ```
   It prints `init-roles: users ... and database ... are ready.` It is safe to run again; it resets the two passwords to what `.env` says.

### Option B: with Docker

1. Make your settings file.

   Runs in: your terminal, repo root
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in `DB_APP_PASSWORD`, `DB_MIGRATOR_PASSWORD`, `POSTGRES_USER` and `POSTGRES_PASSWORD` with values you make up.
2. Start only the database. The first start creates the two users and the database by itself (`infra/db/docker-init.sh`). The dev file publishes the database on `127.0.0.1` only, so nothing outside your machine can reach it.

   Runs in: your terminal, repo root
   ```bash
   pnpm db:up
   ```
   That runs `docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d db`.

To run the whole app in containers on your own machine (not only the database), fill in `CODE_LOOKUP_SECRET` too (section 10), then run `pnpm docker:up` as the README says. The app is then at `http://127.0.0.1:8080`. Use that exact address, not `localhost`: the API only accepts sign-in from the one address it was told is the app's. To use another port, set `DOCKER_WEB_PORT` in `.env` (`WEB_PORT` is only for `pnpm dev`). This is the developer stack. For the production stack on your own machine, see section 13a.

The users are made only on the very first start, from the values in `.env` at that moment. If you change the passwords later, either run step 3 of Option A against the container, or remove the container's data volume (`docker compose -f infra/docker-compose.yml down -v`, which erases the database) and start again.

## 3. Build the tables and load sample data

Runs in: your terminal, repo root
```bash
pnpm db:migrate
pnpm db:seed
```

- `db:migrate` runs every migration file that has not run yet, as the migrator user, then gives the app user row access to every table. Running it twice is safe: the second time it does nothing.
- `db:seed` adds two made-up accounts and a few made-up tummy times, as the app user. Nothing in it is real, and the sample accounts cannot sign in. Running it twice is safe.

Now `pnpm dev`, `pnpm test` and `pnpm test:e2e` work. The API and its tests need the database; without it they stop with a message that names the missing setting or says the database cannot be reached. Database tests never skip themselves.

`pnpm test` runs the migrations itself first, and its tests add and then remove their own made-up rows.

## 4. Start again from empty

Runs in: your terminal, repo root
```bash
NODE_ENV=development pnpm db:reset
```

This erases every table, migrates from empty and seeds. It refuses, and changes nothing, unless `NODE_ENV` is `development` or `test` **and** `DB_HOST` is this machine (`127.0.0.1`, `localhost`, `::1` or a socket path). That is why `NODE_ENV` is typed on the command line and is not in `.env`: the web build reads `.env` too.

## 5. Change a table

1. Read `docs/data-map.md`. A new field needs a row there first, in its own pull request, with Devin's approval. The data-map test fails the build on any column the map does not list, and on any map field the database does not have.
2. Edit `apps/api/src/db/schema.ts`.
3. Write the migration file from it.

   Runs in: your terminal, repo root
   ```bash
   pnpm --filter @tummy/api db:generate
   ```
   This writes a new numbered `.sql` file in `apps/api/drizzle/` and updates `apps/api/drizzle/meta/`. It does not touch any database.
4. Read the new SQL file line by line. It is what will run on the real database.
5. Run `pnpm db:migrate`, then `pnpm test`. Commit the schema change, the SQL file and the `meta/` changes together.

Never edit a migration file that has already been merged: write a new one.

## 6. Back up

`infra/backup.sh` writes the whole database to one file with `pg_dump`. It takes the connection from the standard PostgreSQL settings in the environment, never from the script. Use the migrator user. The file holds every family's tummy logs: it is written readable by you only, `backups/` is in `.gitignore`, and it must never be committed or put in a shared folder.

`pg_dump` must be the same major version as the server or newer.

Runs in: your terminal, repo root (Option A, or Option B with PostgreSQL 17 tools installed)
```bash
set -a; . ./.env; set +a
PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGDATABASE="$DB_NAME" PGUSER="$DB_MIGRATOR_USER" \
  PGPASSWORD="$DB_MIGRATOR_PASSWORD" bash infra/backup.sh
```

It prints `backup: wrote backups/<database>-<time>.dump`. Give a file name as the first argument to choose your own. It refuses to overwrite a file that exists, and checks the file can be read back before it finishes.

## 7. Restore

`infra/restore.sh` puts a backup into a database with `pg_restore`, in one transaction: all of it goes in, or nothing changes. It refuses to restore into a database that already has tables, unless you add `--replace-existing-data`, which drops what is there first.

To restore into a new, empty database (the safe way, and the way to test a backup):

1. Create the new database and its users, as the administrator. `DB_NAME` names the new database for this one command.

   Runs in: your terminal, repo root
   ```bash
   set -a; . ./.env; set +a
   DB_NAME=tummy_restore PGHOST=127.0.0.1 PGPORT="$DB_PORT" PGUSER=postgres bash infra/db/init-roles.sh
   ```
2. Restore, as the migrator user.

   Runs in: your terminal, repo root
   ```bash
   PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGDATABASE=tummy_restore PGUSER="$DB_MIGRATOR_USER" \
     PGPASSWORD="$DB_MIGRATOR_PASSWORD" bash infra/restore.sh backups/<file>.dump
   ```
3. Check the rows are there, as the app user.

   Runs in: your terminal, repo root
   ```bash
   PGPASSWORD="$DB_APP_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_APP_USER" -d tummy_restore \
     -c "SELECT (SELECT count(*) FROM accounts) AS accounts, (SELECT count(*) FROM tummy_logs) AS tummy_logs"
   ```
   With only the seed loaded you see 2 accounts and 5 tummy logs.
4. Check the migrations are recorded: `DB_NAME=tummy_restore pnpm db:migrate` says the database is up to date.
5. When you are done, remove the test copy as the administrator: `psql -h 127.0.0.1 -p "$DB_PORT" -U postgres -d postgres -c "DROP DATABASE tummy_restore"`.

### After a restore: move the sync counter forward (Block 6)

Phones remember the last sync number they saw. A restore takes the database back in time, so the counter may now be behind what some phones remember. New changes would then get numbers those phones think they already have, and the phones would skip them.

Runs in: `psql`, connected as the migrator user, right after the restore and before the API starts

```sql
SELECT setval('tummy_logs_rev_seq', (SELECT COALESCE(MAX(rev), 0) FROM tummy_logs) + 1000000);
```

The exact jump does not matter. It only has to be larger than the number of changes lost. Entries a phone had that the restore lost stay on that phone until it signs out; they are not sent again. This step has not been practiced on a real restore yet. Block 8 adds it to the drill.

### The restore drill, as practiced in Block 3

Done on a local PostgreSQL 16 with the seed loaded, following steps 6 and 7 above exactly:

| Step | Result |
|---|---|
| Back up `tummy_time` as the migrator | One file, readable by its owner only |
| Create `tummy_restore` with `init-roles.sh` | Users and an empty database ready |
| Restore into `tummy_restore` | Restored, exit code 0 |
| Count rows as the app user | 2 accounts, 5 tummy logs, 2 audit events, the same IDs and `rev` values as the original |
| Next number from the `rev` counter | Continues after the original's last number, so no `rev` is ever reused |
| Restore again into the same, now full, database | Refused, exit code 1, nothing changed |
| Restore again with `--replace-existing-data` | Restored, exit code 0 |
| `pnpm db:migrate` against the copy | Up to date |

A backup and restore inside the Docker containers were practiced during the Block 8 review (section 16). Not yet practiced: a backup and restore on a real server, including the ODU server.

## 8. In CI

`.github/workflows/ci.yml` starts a throwaway PostgreSQL 17 container next to the "Lint, types, tests" job and the "End to end" job. Each job creates the two users with `infra/db/init-roles.sh`, runs `pnpm db:migrate`, then runs its checks. The passwords in the workflow are for that throwaway database only and are not secrets. If the database does not start, those steps fail and the job fails.

## 9. When something goes wrong

| Message | What it means | What to do |
|---|---|---|
| `The database settings are not right: - DB_APP_PASSWORD: missing` | `.env` is missing or a value is blank | Fill it in from `.env.example` |
| `The API failed to start (ECONNREFUSED). Is the database running?` | Nothing answers at `DB_HOST:DB_PORT` | Start PostgreSQL, or `pnpm db:up`; check `DB_PORT` |
| `... (28P01)` | Wrong password for that user | Run `infra/db/init-roles.sh` again to reset both passwords to `.env` |
| `... (3D000)` | The database does not exist | Run `infra/db/init-roles.sh` |
| `The API's database user has too much power` | The API is set to use the migrator or an administrator | Set `DB_APP_USER` and `DB_APP_PASSWORD` to the app user |
| `db:reset: refused.` | Not development or test, or not this machine | That is the guard working. Use `NODE_ENV=development` on your own machine only |
| `restore: refused. Database ... already has N tables.` | You are restoring over data | Restore into a new database, or add `--replace-existing-data` if you mean to erase it |
| `init-roles: ... \getenv` error | `psql` is older than 15 | Install the PostgreSQL 16 or 17 command-line tools |
| `The API cannot start because its sign-in settings are not right: - CODE_LOOKUP_SECRET: missing` | No sign-in key in `.env` | Make one (section 10) |
| `- CODE_LOOKUP_SECRET: does not look random` | The key was typed by hand or is a placeholder | Make one with the command in section 10 |
| `- APP_ORIGIN: must be an origin ...` | The address has a path, a trailing slash, or is plain http on a real host | Use exactly scheme, host and port, such as `http://127.0.0.1:5173` |
| Every button that saves something answers "This request is not allowed." | `APP_ORIGIN` does not match the address in the browser's address bar | Make them the same, character for character (`localhost` and `127.0.0.1` are different) |
| `AUTH_PROVIDER is dev-fake ...` | The no-PIN test provider is set outside development or test | Remove `AUTH_PROVIDER` from the environment |

## 10. Sign-in settings (Block 4)

The API needs two more settings and refuses to start without them.

| Setting | What it is | Rule |
|---|---|---|
| `CODE_LOOKUP_SECRET` | The key used to find an account from its family code | At least 32 random bytes in base64. Different on every machine and server. Never in git, chat, a ticket or a log |
| `APP_ORIGIN` | The app's address as the browser shows it | Scheme, host and port only. `https` everywhere except your own machine |
| `AUTH_PROVIDER` | `family-code-pin` (default) or `dev-fake` | Leave it out. `dev-fake` needs no PIN and only runs in development and test |

Runs in: a terminal, in the repo folder. It prints a new key. Paste it after `CODE_LOOKUP_SECRET=` in `.env`.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

**If the key is lost or changed, every family code made before stops working.** The codes are not stored, only a keyed hash of each, and the key is the other half. There is no way to work them out again. So on a real server:

- The key is backed up separately from the database, by whoever holds the server's other secrets. A database backup without the key cannot sign anyone in. A key without the database is useless. Keeping them apart is the point.
- Where it is kept and who can read it is still an open decision (section 17 says what is known). Until it is made, no real family data may go on a server.

On your own machine, losing the key only costs your local test accounts: run `NODE_ENV=development pnpm db:reset`, then migrate and seed again.

Each PIN check uses about 46 MB of memory for under a tenth of a second, and at most 4 run at once. Leave about 200 MB of room for the API on the server.

## 11. Header checks (Block 7, done in Block 8)

Status: **done in the Block 8 review, with a test certificate for `localhost`. Not yet done on a real server.** The web image's `nginx -t` passed, and every header below was read with `curl` on `/`, `/sw.js`, the manifest, an icon, a hashed file and a missing file. Repeat the checks on a real server before anyone uses it. They are the same commands:

Runs in: a terminal that can reach the server. Replace the address.

```bash
for p in / /index.html /sw.js /manifest.webmanifest; do curl -sI "https://SERVER$p" | grep -i -E "^HTTP|cache-control|content-security-policy|strict-transport-security|content-type"; done
```

- `/`, `/index.html`, `/sw.js` and the manifest must say `Cache-Control: no-cache`. If `sw.js` is cached, phones do not hear about new versions.
- One file under `/assets/` must say `max-age=31536000, immutable`.
- Every one must carry the Content-Security-Policy line, and (over HTTPS) the Strict-Transport-Security line.
- A missing file under `/assets/` must answer 404, never the page.
- Set `TUMMY_BUILD_ID` to the commit when building, so a phone's version can be read from the page. `infra/deploy.sh` does this.
- Keep the previous release's `/assets/` files for one release. A phone part-way through an update may still ask for one.

## 12. The production server: what runs and what is reachable

Status of this whole part of the page: **practiced in the review container, not on a real server.** In the Block 8 review every container started with its read-only file system and dropped privileges, only `caddy` had ports (80 and 443), and the database and the API were shown, from inside each, to have no route out to the internet. All of that was with a test certificate for `localhost`.

The production stack is `infra/docker-compose.prod.yml`. It is separate from the development file on purpose (see the comment at the top of that file). Everything in it runs in containers on one Linux machine.

| Service | What it is | Reachable from outside the server? |
|---|---|---|
| `caddy` | The outer proxy. Ends HTTPS, gets and renews its own certificate by default, sends port 80 to port 443 | **Yes: ports 80 and 443. The only thing that is** |
| `web` | nginx with the app's files and their caching and security headers | No |
| `api` | The Fastify API. Connects to the database as the app user | No |
| `db` | PostgreSQL 17 | No. Publishes no port. On a private network with no way out |
| `migrate` | Runs the migrations as the migrator user, then exits. Only when `deploy.sh` asks | No |
| `dbtools` | `psql`, `pg_dump` and `pg_restore` on the database's private network, for backup and restore scripts. Only on demand | No |

Files on the server that are not in git, and why each matters:

| File or folder | What it holds | Rule |
|---|---|---|
| `infra/.env` | Every secret and setting for this server | Mode 600, owned by the deploy user. Never in git, chat, a ticket or a log. `deploy.sh` refuses to run if it is open to others |
| `infra/.deployed-version` | The version that is running now, one line | Written by `deploy.sh` only after a healthy start |
| `BACKUP_DIR` (set in `.env`) | Database backups, readable by the deploy user only | Outside Docker's own storage. Holds every family's tummy logs in the clear: see section 20 |
| Docker volume `tummy-time-prod_db-data` | The live database files | Not a backup. Never copy it as one |
| Docker volume `tummy-time-prod_caddy-data` | The HTTPS certificate, its private key and Caddy's account with the certificate authority | Back up with the other secrets. Losing it means a new certificate, and certificate authorities limit how often they issue one |

### How many proxies sit in front of the API

**One** (Caddy), so `API_TRUST_PROXY_HOPS` is `1` in the compose file. The rate limiter (threat model #15b) is keyed on the address the API reads from that one hop. Too low and every visitor shares one limit; too high and a visitor can write their own address and escape it. Two ways to break it by accident: sending `/api/` through the `web` container's nginx (its own rule would replace the address with Caddy's), and putting another proxy in front of Caddy (ODU's, for example) without changing the number to 2 and telling Caddy to trust that proxy. `infra/Caddyfile` and the top of `infra/docker-compose.prod.yml` explain both.

### Two shapes: a temporary test site and the ODU server

- **Temporary test site (the default path).** A server we can reach off campus, with a real DNS name pointing at it, ports 80 and 443 open to the internet, and Caddy getting its own certificate. Sample data only. Set `SITE_BANNER=test` in `infra/.env` before deploying, so every screen says "Test site. Sample data." Devin approved temporary staging; the hosting provider is not chosen.
- **The ODU server.** Different, and not yet known: who issues the certificate, whether ODU puts its own proxy in front, whether containers are allowed at all, who patches the machine, how backups work. The questions are in `docs/hosting-questions.md`. Until ODU IT answers, treat every line of this page that mentions ODU as a question, not a fact. `infra/Caddyfile` lists the two shapes we can already see.

## 13. First-time server setup

Status: **Partly practiced.** The settings file and the first deploy (steps 5 to 7) were run in Docker during the Block 8 review, with a test certificate for `localhost` (section 13a shows how to repeat that on your own computer). **NOT YET PRACTICED on a real server:** the Linux user and `docker` group, the DNS name, open ports, a public certificate, and the checks from outside (steps 1 to 4, 8 to 10). The first person to do it fixes this page as they go.

You need: a Linux server you may run Docker on; a DNS name that points at it; ports 80 and 443 open to the internet (the test-site path needs both for the certificate); and a user that is not root, here called `tummydeploy`. Anyone who can run Docker on a machine can read everything on it, so the `docker` group is as powerful as root: keep it to people who need it.

1. Install Docker Engine and its Compose plugin from Docker's own instructions for your Linux. Also install `git` and `curl`.

   Runs in: the server, as an administrator. Check:
   ```bash
   docker compose version && git --version && curl --version | head -n 1
   ```
2. Make the deploy user and let it run Docker.

   Runs in: the server, as an administrator
   ```bash
   sudo adduser tummydeploy
   sudo usermod -aG docker tummydeploy
   ```
3. Make the backup folder, outside Docker's storage.

   Runs in: the server, as an administrator
   ```bash
   sudo mkdir -p /srv/tummy-backups
   sudo chown tummydeploy:tummydeploy /srv/tummy-backups
   sudo chmod 700 /srv/tummy-backups
   ```
   A different physical disk is better than the same one, and an encrypted copy somewhere else is better still. Neither is decided (section 20).
4. Get the code.

   Runs in: the server, as `tummydeploy`
   ```bash
   sudo mkdir -p /opt/tummy-time && sudo chown tummydeploy:tummydeploy /opt/tummy-time
   git clone https://github.com/ferrelldevin/tummy-time.git /opt/tummy-time
   cd /opt/tummy-time
   ```
5. Make the settings file. It starts as a copy of `.env.example` and must be private from the first second.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time`
   ```bash
   install -m 600 .env.example infra/.env
   ```
   Open `infra/.env` in an editor (`nano infra/.env`) and fill in every line. Do not paste values into a terminal command line or into any chat: they land in shell history. Make each password and key with the commands below, one per value, and copy it straight into the editor.

   Runs in: the server, as `tummydeploy`. Each prints one new value.
   ```bash
   openssl rand -hex 24                 # once for each of the three passwords
   openssl rand -base64 32              # for CODE_LOOKUP_SECRET only
   ```
   What to set:
   - `APP_ORIGIN`: `https://` and the DNS name, nothing else. `SITE_ADDRESS`: the same name, without `https://`.
   - `DB_APP_PASSWORD`, `DB_MIGRATOR_PASSWORD`, `POSTGRES_PASSWORD`: three different passwords. `POSTGRES_USER`, `DB_APP_USER`, `DB_MIGRATOR_USER`, `DB_NAME`: names as in `.env.example`.
   - `CODE_LOOKUP_SECRET`: the base64 value. **Copy it to its separate, safe place now** (section 17). If it is lost, every family code stops working.
   - `BACKUP_DIR=/srv/tummy-backups`. `SITE_BANNER=test` on a test site, empty on the real one.
   - Leave `AUTH_PROVIDER`, `API_HOST`, `API_TRUST_PROXY_HOPS`, `DB_HOST` and `DB_PORT` alone: the compose file sets them.
6. Check the file is private and the settings are complete. This prints nothing when everything is fine and names the missing setting when not. It never prints a value.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
   ```bash
   ls -l .env
   TUMMY_VERSION=check docker compose --env-file .env -f docker-compose.prod.yml --profile tools config --quiet
   ```
   `ls` must show `-rw-------`. **Never run `docker compose config` without `--quiet`: it prints every secret.**
7. First deploy. Pick the version (a git tag, or a commit) and check it out first; `deploy.sh` refuses to run on anything else.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time`
   ```bash
   git checkout <version>
   infra/deploy.sh <version>
   ```
   On the very first run the database container makes the two users and the database by itself, then the script backs up the empty database, migrates, starts everything and waits for `/api/health`. The first certificate can take a short while; the script waits.
8. Check from outside, from your own computer: only 80 and 443 answer, and the database does not.

   Runs in: your own computer. Replace the name.
   ```bash
   curl -sI http://YOUR-NAME/ | head -n 3            # expect a redirect to https
   curl -sS https://YOUR-NAME/api/health             # expect {"ok":true}
   nc -zv -w 3 YOUR-NAME 5432; nc -zv -w 3 YOUR-NAME 3001   # expect both to fail
   ```
   And on the server: `docker compose --env-file .env -f docker-compose.prod.yml ps` must show a port only on `caddy`.
9. Do the checks section 11 owes (cache and security headers on `/`, `/sw.js`, the manifest and one `/assets/` file) against `https://YOUR-NAME`.
10. Install the daily timers (section 20), the uptime check (section 21 explains where it runs), and do the practice list in section 23 once, on the test site, before any real family uses a server.

## 13a. Practice on your own computer

Use this to run the production stack on a laptop, with made-up data, before anyone touches a server. It is how the Block 8 review ran it, in a Linux container with Docker. It uses Caddy's own certificate for the name `localhost`, so **your browser will warn that the connection is not private. That is expected on a practice run, and only on a practice run.** A real server never asks anyone to click past that warning.

You need: Docker with the Compose plugin, `git` and `curl`, on Linux or in WSL on Windows (the scripts use Linux's `stat -c`, which the macOS `stat` does not have). Ports 80 and 443 must be free on your computer. A practice run holds sample data only: never real families' data.

1. Check out the version to practice with, with nothing uncommitted. `infra/deploy.sh` refuses anything else. A commit is a version too; this prints the short name of the current one.

   Runs in: your terminal, repo root
   ```bash
   git status --short            # must print nothing
   git rev-parse --short HEAD    # use this as <version> below
   ```
2. Make a folder for backups, outside the repo.

   Runs in: your terminal
   ```bash
   mkdir -p "$HOME/tummy-practice-backups"
   ```
3. Make the settings file, private from the first second, then fill it in. This is the same file section 13 step 5 describes, with the practice values below.

   Runs in: your terminal, repo root
   ```bash
   cp .env.example infra/.env
   chmod 600 infra/.env
   ```
   Open `infra/.env` in an editor and set:
   - `DB_APP_PASSWORD`, `DB_MIGRATOR_PASSWORD`, `POSTGRES_PASSWORD`: three different passwords you make up (`openssl rand -hex 24`). `POSTGRES_USER`, `DB_APP_USER`, `DB_MIGRATOR_USER`, `DB_NAME`: names as in `.env.example`.
   - `CODE_LOOKUP_SECRET`: `openssl rand -base64 32`.
   - `SITE_ADDRESS=localhost`
   - `APP_ORIGIN=https://localhost`
   - `SITE_BANNER=test`
   - `BACKUP_DIR`: the full path of the folder from step 2, such as `/home/you/tummy-practice-backups`.
   - Leave `HEALTH_CA_FILE` empty for now.
4. Deploy once.

   Runs in: your terminal, repo root
   ```bash
   infra/deploy.sh <version>
   ```
   **The health check will fail this first time, and that is expected.** Caddy made its own certificate authority, and nothing on your computer trusts it yet, so the script's check (which always verifies the certificate) refuses it. With no earlier version to go back to, the script says so and **leaves the stack running**. That is what you want here.
5. Copy Caddy's certificate authority out of the running container. This is a public certificate, not a secret. Put it outside the repo.

   Runs in: your terminal, in `infra/`
   ```bash
   export TUMMY_VERSION=<version>
   docker compose --env-file .env -f docker-compose.prod.yml exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > "$HOME/tummy-practice-ca.crt"
   ```
6. Tell the script to trust it. In `infra/.env` set `HEALTH_CA_FILE` to the full path of that file, such as `/home/you/tummy-practice-ca.crt`.
7. Deploy again.

   Runs in: your terminal, repo root
   ```bash
   infra/deploy.sh <version>
   ```
   Expect the last line to say `deploy: 8/8 done.` The certificate is still verified; the script now trusts one more authority, yours.
8. Look at it. Open `https://localhost` in a browser and click through the warning. You should see the "Test site. Sample data." strip. Then try the rest of this page against it: section 14 (deploy a second version, and a broken one), section 16 (restore), section 17, section 18 and section 19. In every command from those sections, `YOUR-NAME` is `localhost`, and `curl` needs `--cacert "$HOME/tummy-practice-ca.crt"`.
9. Clean up when you are done. This removes the practice database and certificate for good.

   Runs in: your terminal, in `infra/`
   ```bash
   docker compose --env-file .env -f docker-compose.prod.yml down -v
   ```

## 14. Deploy

Status: **practiced in the review container, not on a real server.** A good version deployed (backup, migration, start, health check over HTTPS with the certificate verified, version recorded). A version broken on purpose went back to the last good one by itself. Both were with a test certificate for `localhost`.

Runs in: the server, as `tummydeploy`, in `/opt/tummy-time`
```bash
git fetch --tags
git checkout <version>
infra/deploy.sh <version>
```

What the script does, in order, and where it stops: it refuses without a private `infra/.env`; refuses as root unless `--allow-root`; refuses unless `<version>` is exactly what is checked out and clean; builds the images (nothing running changes); takes a backup labelled `pre-<version>`; runs the migrations as the migrator user; starts the new version; waits for `/api/health` through Caddy over HTTPS; on success records the version in `infra/.deployed-version`. If the health check fails it starts the previous version again and exits with a failure.

**What "starts the new version" means.** The script starts the proxy (`caddy`), `web` and `api` fresh on every deploy, even if their settings did not change. Caddy reads `infra/Caddyfile` only when it starts, so a changed Caddyfile would otherwise be ignored. The database is not restarted. When the script goes back to the previous version, it uses the **Caddyfile of the checkout you are standing in**, not the old version's. If the old version needs its own Caddyfile, check it out and deploy it again.

| What the script says | What it means | What to do |
|---|---|---|
| `refusing to run as root` | You are root | Use `tummydeploy` |
| `has mode 644` (or similar) | `infra/.env` can be read by others | `chmod 600 infra/.env`, then ask who might have read it |
| `"<version>" is not what is checked out` | The checkout differs | `git checkout <version>` |
| `the backup failed, so nothing was changed` | No backup was taken, so nothing else was either | Fix the cause (disk full? `BACKUP_DIR` missing?) and run again. Never skip the backup |
| `the migration failed. The running version was not stopped` | A migration stopped part-way | Read section 15 before running anything else. The old version is still running |
| `version ... did NOT answer /api/health in time` and `the previous version is answering again` | The new version is bad; the old one is back | Read the new version's logs (section 19) and fix it in a new version. Remember the migration caveat in section 15 |
| `the previous version is NOT answering either` | **An outage** | Section 15, then section 19, then the people in section 24 |

A rule for every migration, so rolling back stays possible: a migration may **add** things (a column that allows empty, a new table), and a later release may remove what nothing uses any more. It must never rename or drop something the previous version still reads, in one release.

Keep the old images. `deploy.sh` rolls back by starting the previous version's images, which stay on the server unless someone runs `docker image prune` or `docker system prune`. Do not.

## 15. Roll back

Status: **the automatic return was practiced in the review container, not on a real server.** A deploy broken on purpose went back to the last good version by itself and said so. **A failed deploy means about a minute and a half of downtime** before the last good version is back, because the script has to wait to find out the new one is not healthy. The by-hand way back (step 2 below) and the cases where a migration ran (steps 3 and 4) were not practiced.

**The caveat, in plain words: a migration that already ran is NOT rolled back.** Going back to the previous version puts back the previous program, not the previous tables. Whether that is enough depends on whether the bad version changed the tables.

1. See what the bad version changed in the tables. Nothing printed means no migration.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time`
   ```bash
   git diff --stat <previous-version> <bad-version> -- apps/api/drizzle
   ```
2. No migration: going back is enough. `deploy.sh` already did it when the health check failed. To do it by hand:

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
   ```bash
   export TUMMY_VERSION=<previous-version>
   docker compose --env-file .env -f docker-compose.prod.yml up -d --no-build --remove-orphans --force-recreate caddy web api
   printf '%s\n' "$TUMMY_VERSION" > .deployed-version
   curl -sS https://YOUR-NAME/api/health
   ```
3. A migration ran, and the old version works with the new tables (the migration only added things): do step 2. Done.
4. A migration ran, and the old version does NOT work with the new tables: stop and call Devin before doing anything. The only way back is to **restore the backup that `deploy.sh` took just before** (its path is in the script's last messages, and the file name ends `-pre-<version>.dump`), which **throws away everything written since that backup**: every log entry and sign-up in between. Section 16 is the procedure. Decide with Devin first; this is a loss of families' data.
5. Write down what happened, and make a new version that fixes it. Never edit a migration that has already run on a server.

## 16. Restore on the server

Status: **practiced in the review container, not on a real server.** The drill (restore into a separate database) and the restore over the live database both worked as written, including the "move the sync counter forward" step. After the live restore, sign-up and sync between two browsers worked, and new entries got numbers above the jump. The first real-server drill must time it again and write the result in the table below.

A restore takes the database back in time and the site is down while it runs. Use it when data is lost or damaged, or when section 15 step 4 says so. For a **drill**, restore into a separate database instead (second half of this section), which touches nothing live.

Set up the short form once per terminal. Every command below needs `TUMMY_VERSION` set.

Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
```bash
export TUMMY_VERSION="$(cat .deployed-version)"
dc() { docker compose --env-file .env -f docker-compose.prod.yml "$@"; }
ls -l /srv/tummy-backups        # choose the backup file; note its name
```

### Restore over the live database

1. Stop the three services that use the database. The site is now down.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
   ```bash
   dc stop caddy web api
   ```
2. Restore. `--replace-existing-data` drops the current tables first; that is the point here, and the script's one safeguard against doing it by accident. The file name is inside the container, under `/backups`.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
   ```bash
   time dc --profile tools run --rm -T dbtools bash /infra/restore.sh /backups/<file>.dump --replace-existing-data
   ```
3. Run the migrations. They change nothing if the backup was current, and they give the app user its row access again.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
   ```bash
   dc --profile tools run --rm -T migrate
   ```
4. **Move the sync counter forward** (Block 6). Phones remember the last sync number they saw. A restore takes the counter back, so new changes could get numbers that phones believe they already have, and those phones would skip them. The jump only has to be larger than the number of changes lost.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`. The connection is the migrator user's, set up by the `dbtools` service.
   ```bash
   dc --profile tools run --rm -T dbtools psql --no-psqlrc -v ON_ERROR_STOP=1 -c \
     "SELECT setval('tummy_logs_rev_seq', (SELECT COALESCE(MAX(rev), 0) FROM tummy_logs) + 1000000)"
   ```
   Entries a phone had that the restore lost stay on that phone until it signs out; they are not sent again. Tell Devin how many hours of data were lost so the people affected can be told.
5. Start everything and check.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
   ```bash
   dc up -d --no-build
   curl -sS https://YOUR-NAME/api/health
   dc --profile tools run --rm -T dbtools psql --no-psqlrc -c \
     "SELECT (SELECT count(*) FROM accounts) AS accounts, (SELECT count(*) FROM tummy_logs) AS tummy_logs"
   ```
6. A backup does not hold `CODE_LOOKUP_SECRET`. If this is a new server, put the secret back from its separate safe place before step 5, or nobody can sign in (section 17).

### A drill: restore into a separate database

This is the way to test a backup without touching the live site. Time each step and write the result here.

Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`. It asks for the database administrator's password (the `POSTGRES_PASSWORD` value); typing it shows nothing.
```bash
read -rs PGPASSWORD; export PGPASSWORD
export PGUSER=<the POSTGRES_USER value>
# 1. make the new database and the two users' access to it
dc --profile tools run --rm -T -e PGUSER -e PGPASSWORD -e PGDATABASE=postgres -e DB_NAME=tummy_restore dbtools bash /infra/db/init-roles.sh
unset PGPASSWORD PGUSER
# 2. restore into it, and time it
time dc --profile tools run --rm -T -e PGDATABASE=tummy_restore dbtools bash /infra/restore.sh /backups/<file>.dump
# 3. look at it
dc --profile tools run --rm -T -e PGDATABASE=tummy_restore dbtools psql --no-psqlrc -c \
  "SELECT (SELECT count(*) FROM accounts) AS accounts, (SELECT count(*) FROM tummy_logs) AS tummy_logs"
```
Then remove it: repeat the administrator login (`read -rs PGPASSWORD; export PGPASSWORD; export PGUSER=...`) and run `dc --profile tools run --rm -T -e PGUSER -e PGPASSWORD -e PGDATABASE=postgres dbtools psql --no-psqlrc -c "DROP DATABASE tummy_restore"`, then `unset PGPASSWORD PGUSER`.

| Drill result | Measured |
|---|---|
| Restore time | About 1 second, for the sample data |
| Rows match the live database | Yes: the row counts matched |
| Done by, and on which server | The Block 8 reviewer, in the review container (Docker, test certificate for `localhost`). **Not a real server** |

The restore over the live database was also practiced in the review, with the sync counter step. It was not timed. A real server holds more data than the sample data, so its restore will take longer: measure it there.

## 17. Rotate a secret

Status: **the database password change was practiced in the review container, not on a real server.** It worked as written. Not practiced: changing the administrator's password on its own, and the HTTPS certificate (Caddy renews its own; nothing about that was run).

### The database passwords

There are three: the app user, the migrator user and the container's administrator. The passwords live in two places that must agree: inside the database, and in `infra/.env`.

**The app and migrator passwords**

1. Edit `infra/.env` and put the new values in (make each with `openssl rand -hex 24`).
2. Reset both inside the database. `init-roles.sh` sets both users' passwords to whatever `.env` now says. It runs as the administrator.

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra` (after `export TUMMY_VERSION=...` and the `dc` function from section 16)
   ```bash
   read -rs PGPASSWORD; export PGPASSWORD
   export PGUSER=<the POSTGRES_USER value>
   dc --profile tools run --rm -T -e PGUSER -e PGPASSWORD -e PGDATABASE=postgres dbtools bash /infra/db/init-roles.sh
   unset PGPASSWORD PGUSER
   ```
3. Restart the API so it connects with the new app password. Until you do, new connections fail (connections already open keep working).

   Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`
   ```bash
   dc up -d --no-build --force-recreate api
   curl -sS https://YOUR-NAME/api/health
   ```
4. Check the next deploy or backup works (they use the migrator password).

**Expect a short restart of the database too.** The database container's settings include the passwords. When you change them in `infra/.env`, Compose notices and restarts the database container as well, for a few seconds, the next time it starts the stack's services. The site can fail for those seconds. Do this when that is acceptable.

**The administrator's password (`POSTGRES_PASSWORD`).** The database container reads it only the first time it starts, so changing `.env` alone changes nothing. Change it inside the database first, then in `.env`.

Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra`. `\password` asks for the new password twice and shows nothing.
```bash
dc exec db sh -c 'psql -U "$POSTGRES_USER" -d postgres'
# at the postgres=# prompt:  \password   (type the new one twice), then  \q
```
Then put the same value in `infra/.env`.

### `CODE_LOOKUP_SECRET`: do NOT rotate it

This one is different. The database stores only a keyed hash of each family code, made with this secret. The code itself is not stored and cannot be worked out. So **if the secret changes, every family code made before stops finding its account, and there is no way to recompute them.** Rotating it locks every family out for good. It is not rotated without a migration plan, and today there is none, because there is no account recovery yet (Block 10).

- **Keeping it safe.** It must be backed up **separately from the database backups**, by whoever holds the server's other secrets: a database backup without it cannot sign anyone in; a copy of it without the database is useless. Where that safe place is, who can read it, and whether it is encrypted, is **an open decision for Devin and Dr. Gupta**. Until that is decided, do not put real family data on a server.
- **If it leaks.** Do not rotate it on your own. Tell Devin at once. What the secret alone gives an attacker is the ability to check guesses of family codes against a copy of the database, and only if they also have a copy of the database; they still need the PIN, which is stored as an Argon2id hash and locks an account after five wrong tries. To limit damage while Devin decides: if there is any sign the database was copied as well, end every signed-in phone by deleting the sessions (section 18 shows how to run SQL as the migrator; the statement is `DELETE FROM sessions`). Replacing the secret means every family registers again, and loses their log unless a recovery design exists first. That decision is for Devin and Dr. Gupta, with a security review. Write down when and how it leaked.
- **A stolen `.env` or server access** is the same: treat every secret in it as leaked.

### Rotate the HTTPS certificate

Caddy renews its own certificate by itself on the default path. If ODU issues the certificate instead, the renewal is ODU's process and is not written yet.

## 18. Lock or unlock one account by hand

Status: **practiced in the review container, not on a real server.** One account was locked and unlocked by hand as written: a locked account answered "locked" even to the right PIN, and signed in again once unlocked. Use it when a caregiver is locked out and cannot wait, or an account must be shut off.

**It is done by account ID only.** An account ID is a random UUID. Nobody, including us, can look an account up by its family code: the lookup key is a keyed hash made with `CODE_LOOKUP_SECRET`, and we deliberately provide no tool that takes a code and the secret together. The ID is not shown to the caregiver anywhere in the app today. That is a gap: right now the only routes to an ID are the audit events (a `sign_up` or `lockout` row has the account's ID and a time), which is a guess from a time, not a lookup. Decide how a caregiver and the lab identify an account (for example a "show my code" screen with a support code, planned for Block 10) before real support requests arrive. **Never ask a caregiver for their family code or PIN to find their account**; staff must not have them.

Rows to know in `accounts`: `failed_attempts` (wrong PINs in a row) and `locked_until` (when a lockout ends; empty means not locked). Five wrong PINs lock an account for a while by themselves.

Run SQL as the **migrator** user, never as the app user and never as the administrator, in the database container's network.

Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra` (after `export TUMMY_VERSION=...` and the `dc` function from section 16). `psql` opens at the prompt; paste one statement at a time.
```bash
dc --profile tools run --rm dbtools psql --no-psqlrc
```

Look at one account's state (nothing secret is shown):
```sql
SELECT id, failed_attempts, locked_until, created_at FROM accounts WHERE id = '<the-account-id>';
```

Unlock (clears the count and the lock):
```sql
UPDATE accounts SET failed_attempts = 0, locked_until = NULL WHERE id = '<the-account-id>';
```

Lock (a lock far in the future; the account stays shut until someone unlocks it), and sign out every phone that is already signed in to it, because a lock stops new sign-ins only:
```sql
UPDATE accounts SET locked_until = now() + interval '100 years' WHERE id = '<the-account-id>';
DELETE FROM sessions WHERE account_id = '<the-account-id>';
```

Each statement should say `UPDATE 1` (or `DELETE n`). `UPDATE 0` means the ID is wrong; do nothing else. These changes write no audit event. Write down who did it, when and why, somewhere the lab keeps (it is not decided where).

## 19. Read the logs

Status: **practiced in the review container, not on a real server.** After a full run (sign-up, sign-in, saves, sync, a deploy, a restore, a password change), the logs of all four containers were read. They held no visitor address, PIN, family code, cookie or request body. The only addresses were the containers' own "listening on" lines. Caddy wrote no request lines.

Runs in: the server, as `tummydeploy`, in `/opt/tummy-time/infra` (after `export TUMMY_VERSION=...` and the `dc` function from section 16)
```bash
dc logs --tail 200 api         # the API: one line per request
dc logs --tail 200 web         # nginx: one line per request for the app's files
dc logs --tail 100 caddy       # the outer proxy: start-up, certificates, errors
dc logs --tail 100 db          # PostgreSQL
dc ps                          # which are running and healthy
```
Add `-f` to follow live, and `--since 30m` to see only the last half hour. Docker keeps the last five files of 10 MB for each container and then overwrites the oldest, so old lines are gone.

**What is deliberately not in the logs** (`docs/data-map.md`, "In logs"): no PIN, no family code, no cookie, no session token, no request body, no network address. The API's log lines have a method, a path, a status, a duration and a random request ID. nginx's access line is the method, path, status and time, with no address. If you ever see one of those things in a log, stop and tell Devin: that is a bug and, in a real deployment, a leak.

Three things to keep an eye on, on a real server:
- **Caddy.** In the review it wrote no request lines. Its error lines (a failed secure connection from a real phone or a scanner, for example) can still include the visitor's address, and the review had no such visitors. `docs/data-map.md` says logs hold no network address. If Caddy does write one, either silence that log (`log` settings in `infra/Caddyfile`) or change the data map; Devin decides.
- **PostgreSQL.** An error line from the database can quote the row that caused it, such as the hash in a duplicate key error. Those are hashes, not PINs or codes, but read before pasting database logs into a ticket or a chat.
- **Docker's own log files** on the server are readable by administrators and the Docker group.

## 20. Backups and the daily jobs

Status: **the scripts were practiced in the review container, not on a real server. The timers were not run anywhere.** `infra/backup-scheduled.sh` and `infra/cleanup-scheduled.sh` were run by hand against the practice stack and worked (and every deploy runs the backup script). The cleanup command also has automated tests (`apps/api/test/db/cleanup.test.ts`). The systemd timer files were checked for syntax only and are not installed anywhere.

**What is solved and what is not.**

| Question | Answer today |
|---|---|
| Is a backup taken every day? | The script works (run by hand in the review). The daily timer (examples in `infra/systemd/`) is **not installed anywhere** |
| Where does it go? | `BACKUP_DIR`, on the server's own disk, outside Docker's storage. The script refuses a folder inside `/var/lib/docker` |
| Is it off the server's disk? | **No. Not solved.** A second disk, and an off-server copy, are open decisions |
| Is it encrypted? | **No. Not solved.** Each file is private to the deploy user (mode 600) and holds every family's tummy logs in the clear. Who holds an encryption key is an open decision. Do not copy these files anywhere until it is made |
| Does it include `CODE_LOOKUP_SECRET`? | **No, on purpose.** Back that up separately (section 17) |
| How long are backups kept? | `BACKUP_KEEP_DAYS` (default 30, to confirm: `docs/data-map.md`). After a good backup the script deletes `tummy-time-*.dump` files older than that, in `BACKUP_DIR` only. Nothing else in the folder is touched |

**Install the two daily timers** (examples; edit the user and the paths):

Runs in: the server, as an administrator
```bash
sudo cp /opt/tummy-time/infra/systemd/tummy-*.service /opt/tummy-time/infra/systemd/tummy-*.timer /etc/systemd/system/
sudoedit /etc/systemd/system/tummy-backup.service     # check User= and the path
sudoedit /etc/systemd/system/tummy-cleanup.service    # same
sudo systemctl daemon-reload
sudo systemctl enable --now tummy-backup.timer tummy-cleanup.timer
systemctl list-timers 'tummy-*'
```
Run each once by hand and read the output before trusting the timer:

Runs in: the server, as `tummydeploy`, in `/opt/tummy-time`
```bash
infra/backup-scheduled.sh       # expect: "backup-scheduled: wrote /srv/tummy-backups/tummy-time-....dump"
infra/cleanup-scheduled.sh      # expect: "db:cleanup: removed N ended sessions and M old audit events."
```
If a timer fails, `journalctl -u tummy-backup.service` shows why. **A backup that fails silently is the worst case:** nobody is alerted about a failed timer yet (section 21).

**The daily cleanup** (`pnpm db:cleanup`, run as `node dist/cli/cleanup.js` inside the API container) removes sessions that have ended (past their 90-day end, or unused for 30 days) and audit events older than 180 days. It prints counts only. It is safe to run twice and while the API is running. It does **not** erase "deleted" tummy log entries, although the data map says they go after 90 days: a phone that has not synced for longer than that would never hear about the delete and would keep showing the entry (`docs/adr/0005-sync.md`, "Known gap"). That job waits until a rule for such phones is decided. Until then those rows stay.

## 21. Uptime check and who is alerted

Status: **the script was practiced in the review container; the alert is not set up.** `infra/healthcheck.sh` worked, and it exits 1 on a wrong address. It has not run from a different machine, and nothing turns a failure into a message to a person.

`infra/healthcheck.sh` asks `/api/health` through the public address and prints one line (`healthcheck: ok ...` or `healthcheck: FAILED ...`), exiting non-zero on failure. It is `curl`, not a monitoring service.

Run it from a **different machine** than the server, every few minutes (a dead server cannot report its own death), from cron or a systemd timer, as the comment at the top of the script shows. Then something has to turn a non-zero exit into a message to a person.

**Who receives the alert, and how, is an open decision for Devin and Dr. Gupta.** Until it is made, no one is alerted, and an outage is found when someone looks. Put the person here once chosen: _(blank)_.

Also not covered: a failed backup or cleanup timer, a full disk, an expiring certificate.

## 22. Where every procedure stands

"Review container" means: run in Docker during the Block 8 review, with a test certificate for `localhost`. It is not a real server.

| Procedure | Status |
|---|---|
| Database on a developer machine, migrate, seed, reset (sections 2 to 5) | Practiced (Block 3) |
| Back up and restore a database on a developer machine (sections 6 and 7) | Practiced (Block 3) |
| The developer stack in containers (`pnpm docker:up`) | Practiced in the review container: sign up, timer, save, and the entry showing in a second browser |
| Backup and restore inside the Docker containers (section 16) | Practiced in the review container. **Not yet on a real server** |
| Move the sync counter forward after a restore | Practiced in the review container |
| `pnpm db:cleanup` against a local database | Practiced on a developer machine, with automated tests |
| `backup-scheduled.sh` and `cleanup-scheduled.sh` | Practiced by hand in the review container |
| Cleanup and backup timers (systemd) | **NOT YET PRACTICED.** Checked for syntax only; not installed anywhere |
| First-time server setup (section 13) | Partly: the settings file and first deploy in the review container. **NOT YET PRACTICED on a real server** |
| Practice stack on your own computer (section 13a) | Practiced in the review container |
| Deploy, and the automatic return to the previous version (sections 14 and 15) | Practiced in the review container. **Not yet on a real server** |
| Going back by hand (section 15, steps 2 to 4) | **NOT YET PRACTICED** |
| Restore on the server (section 16) | Practiced in the review container (drill and live). **Not yet on a real server** |
| Rotate database passwords (section 17) | Practiced in the review container |
| Rotate `CODE_LOOKUP_SECRET` | Not done on purpose: see section 17 |
| Lock and unlock an account (section 18) | Practiced in the review container |
| Read the logs (section 19) | Practiced in the review container. Caddy's error lines still to check on a real server |
| `infra/healthcheck.sh` (section 21) | Practiced in the review container. From another machine: **NOT YET PRACTICED**. No one is alerted |
| HTTPS, redirect from 80 to 443, HSTS | Practiced in the review container with a test certificate. **NOT YET PRACTICED** with a public certificate |
| Cache and security headers (section 11) | Read in the review container. **Not yet on a real server** |

## 23. Practice list for the first real server

Do these on the test site, in this order, and change this page where reality differs. Each one that works moves a row in section 22 to "practiced on a real server", with who did it and on which server. Most of them were already done in the review container (section 22); this list is about doing them where it counts.

1. `docker compose ... config --quiet`, then `docker compose ... --profile tools build`. Then pin every image by digest (the top of `infra/docker-compose.prod.yml` says how).
2. `infra/deploy.sh <version>` from empty. Open the site on a phone. Look for the "Test site. Sample data." strip if `SITE_BANNER=test`.
3. Section 13, step 8 and section 11: ports and headers from outside, with the public certificate.
4. Run both scheduled scripts by hand, then install the timers and read what they did the next day.
5. Deploy a second version that is deliberately broken (for example, one with a wrong `API_PORT` in a throwaway branch) and watch `deploy.sh` return to the first. Write down what it said and how long the site was down.
6. The restore drill in section 16, timed on real data.
7. Rotate the app password (section 17).
8. Lock and unlock a made-up account (section 18).
9. Stop the database container and see what the site and the uptime check do.
10. Run the uptime check from a different machine (section 21).

If a container will not start, suspect its `read_only` and `tmpfs` lines first.

## 24. Who to call

Names are blank on purpose. Fill them in, in a private copy, once they are known. This page is in the repo, so **no real phone number or email address goes in this file**: put a pointer to where the list is kept instead.

| For | Who | How to reach them |
|---|---|---|
| The server is down, or a deploy has gone wrong | _(blank: first person on call)_ | _(blank)_ |
| The server, its network, certificates or patching at ODU | _(blank: ODU IT or the CS systems group contact)_ | _(blank)_ |
| A suspected leak of data or of a secret | Devin, then Dr. Gupta | _(blank)_ |
| A caregiver's question about an account | _(blank: who answers families)_ | _(blank)_ |
| Anything that changes what is stored or how sign-in works | Devin | _(blank)_ |
| Where the private contact list is kept | _(blank)_ | |
