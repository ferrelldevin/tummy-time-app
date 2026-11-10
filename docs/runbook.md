# Runbook

How to get a database, change it, back it up and put a backup back. Every command says where it runs. Commands are written for Git Bash on Windows, or any terminal on macOS and Linux, from the repo root unless the label says otherwise.

What is in this page so far comes from Block 3 (database and API spine) and Block 4 (sign-in settings, section 10). Block 8 adds the server: deploys, scheduled backups, where backups are kept and who can reach them.

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

Not yet practiced: a backup and restore inside the Docker containers, and on the ODU server. Block 8 does both.

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
- Where it is kept and who can read it is decided in Block 8. Until then no real server exists.

On your own machine, losing the key only costs your local test accounts: run `NODE_ENV=development pnpm db:reset`, then migrate and seed again.

Each PIN check uses about 46 MB of memory for under a tenth of a second, and at most 4 run at once. Leave about 200 MB of room for the API on the server.
