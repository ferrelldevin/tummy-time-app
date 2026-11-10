# Block 3: Database and API spine

This chapter explains the database, how it changes over time, and the rules every API route will follow. No caregiver can see anything new after this block. What changed is underneath: the place data will live, and the guards around it. Read it with the code open. Section 5 tells you how to run it.

Block 3 was built after Blocks 2 and 5. Chapter numbers follow block numbers, not build order.

## 1. What was built

| Piece | Where | What it is |
|---|---|---|
| Tables | `apps/api/src/db/schema.ts` | The four tables, written in TypeScript with Drizzle |
| First migration | `apps/api/drizzle/0000_init.sql` | The SQL that creates those tables |
| Commands | `pnpm db:migrate`, `db:seed`, `db:reset` | Apply migrations, load made-up data, start over (development only) |
| Two database users | `infra/db/init-roles.sql` | One that can only read and write rows, one that owns the tables |
| The one door | `apps/api/src/db/account-scope.ts` | The only way code may reach an account's rows |
| API rules | `apps/api/src/http/api-rules.ts` | Schemas on every route, one error shape |
| Security headers and limits | `apps/api/src/http/security.ts`, `infra/nginx.conf.template` | Headers, body size limit, rate limit |
| Logging | `apps/api/src/logging.ts` | What may be logged, and a redaction list |
| Backup and restore | `infra/backup.sh`, `infra/restore.sh` | Scripts, tried for real |
| Runbook | `docs/runbook.md` | How to get a database, change it, back it up, restore it |
| Decision record | `docs/adr/0008-postgresql-and-database-users.md` | Why PostgreSQL, why two users |

The tables are `accounts`, `sessions`, `tummy_logs` and `audit_events`. They hold exactly the fields listed in `docs/data-map.md` and nothing else. No names, emails, birth dates, notes or network addresses.

## 2. Why this block is mostly guards

Blocks 4 and 6 will add sign-in and the tummy time log. Those are the parts where a mistake hurts a family: one account seeing another's data, a PIN in a log file, a stray field that stores something personal.

You can try to avoid those mistakes by being careful in every route. Or you can build the guard once, before the first route exists, so being careless is hard. This block does the second. Each guard has a test, and each test was broken on purpose to prove it catches the mistake.

Think of it as building the kitchen before cooking: where the knives go, where raw food is kept, how the floor drains. It is not the meal, but it decides whether the meals are safe.

## 3. The steps, in the order they were done

1. **Added the libraries.** Drizzle (talks to the database with typed queries), `pg` (the PostgreSQL driver), `@fastify/helmet` (security headers) and `@fastify/rate-limit`. All pinned, all in `CREDITS.md`.
2. **Wrote the tables in `schema.ts` and generated the first migration.**
3. **Created the two database users.**
4. **Added the three `db:` commands.**
5. **Made the data-map test real.**
6. **Wrote the API rules, the security headers and the limits.**
7. **Wrote the logging rules and the redaction test.**
8. **Wrote the account-scope module and its guard test.**
9. **Wrote backup and restore, ran both, and wrote the runbook.**
10. **Gave CI its own throwaway PostgreSQL** so database tests run on every pull request.

### Ideas worth understanding

**What a migration is.** A database outlives any one version of the code. You cannot delete it and start over once real data is in it. So every change to the tables is a small SQL file with a number, kept in the repo. `pnpm db:migrate` runs any files the database has not seen yet, in order. Anyone can build the same database from empty by running them all.

**Why the tables are also written in TypeScript.** `schema.ts` describes the tables in code. Drizzle uses it for two things: it writes the migration SQL for you, and it gives every query types. If you misspell a column, the type checker tells you before the code runs.

**Constraints: the database as the last guard.** A constraint is a rule the database itself enforces, whatever the code does. Some examples from this schema:

- `pin_hash` must start with `$argon2id$`. A raw 6-digit PIN cannot be stored by mistake, because the database refuses it.
- `code_lookup` must be 64 hex characters, the shape of a keyed hash. A raw family code does not fit.
- `duration_seconds` must be between 1 and 7200.
- `audit_events.type` can only be one of the six values the data map lists.

The app checks these things too. The database checks them again in case the app has a bug.

**Two database users.** The API connects as a user that can read and write rows and nothing else. It cannot create, change or drop a table. Migrations use a second user that owns the tables. So if an attacker ever finds a way to run SQL through the app, the worst cases (dropping tables, adding their own) are closed. The API checks which user it is at start-up and refuses to run as the stronger one. This idea has a name: least privilege.

**The one door.** Every query on an account's rows goes through `forAccount(db, accountId)`. Each method adds `account_id = <this account>` to the query itself, so a route cannot forget it. The classic bug this prevents is: a route takes an ID from the address, looks up that row, and returns it without checking who owns it. With the one door, asking for another account's row returns nothing.

A test reads every source file and fails if any file outside the door imports those tables or names them in SQL text. It was proven by writing a file that does exactly that.

**The data map as a test.** `docs/data-map.md` is the list of what the app may store. The test migrates a real database, asks it for its tables and columns, and compares that to the page. A column not on the page fails the build. So does a field on the page that the database lacks. Privacy rules written in a document drift; this one cannot.

**API rules.** Each route declares, with Zod, exactly what it accepts and what it returns. A field the schema does not name is refused. The answer is checked before it is sent, so an extra field can never leak out. Every error has one shape:

```json
{ "error": { "code": "bad_request", "message": "The request is not valid." } }
```

The message is a fixed sentence per code. Stack traces and SQL never go to the browser, because they tell an attacker how the system is built.

**Logging.** A log line holds the method, path, status, time taken and a random request ID. Two layers keep secrets out. First, the code that formats a request for the log copies only allowed fields, so headers and bodies are never written. Second, a redaction list replaces anything named `pin`, `code`, `cookie`, `token` and similar with `[redacted]`, in case someone logs an object by hand. A test captures real log output and looks for a known PIN in it. Database errors are logged without their message, because those messages can quote row values.

**Rate limit and the "no network addresses" rule.** A rate limit has to tell clients apart, and the only thing available before sign-in is the network address. The limit counts by address in the server's memory only. The count is never written to the database or a log and is gone when the minute ends. The nginx access log was also changed to leave addresses out. This is an honest trade-off: the address is used for a moment and not kept.

**Backups are tested, not assumed.** A backup you have never restored is a hope, not a backup. Both scripts were run: back up, create a fresh empty database, restore, count the rows. The restore script refuses to run against a database that already has tables unless you pass a flag that says you mean it.

### Proof the guards bite

| Break | What failed |
|---|---|
| Emptied the redaction list | Logging tests: a PIN reached the log |
| Added a `notes` column | Data-map test: the column is not in `docs/data-map.md` |
| Dropped `deleted_at` | Data-map test: the field is on the page but not in the database |
| A new file importing `tummyLogs` | Guard test, with the file name and line |
| Raw SQL naming `tummy_logs` in another file | Guard test |
| Removed the account filter inside the door | Four two-account tests |
| Gave the app user permission to create tables | Role tests |
| No database running | The API tests stop with an error. They do not skip |

### What the reviewer found and changed

- **Database creation failed on some servers.** The reviewer set up a fresh PostgreSQL and the setup script stopped with "new encoding (UTF8) is incompatible with the encoding of the template database". The builder's server happened to default to UTF8, so it never saw this. The fix is one clause, `TEMPLATE template0`. This is why a second person runs the steps on a different machine.
- **The page had no security headers of its own.** The API set them on its answers, but the HTML page served by nginx did not get a Content Security Policy. The reviewer added them to the nginx template. They have not been seen running in a container yet, and that is written in the file.
- **Written down for Block 6, not fixed here:** the sync counter. Two writes that overlap in time can finish in the opposite order to their counter numbers. A phone that asks "everything after 41" at the wrong moment could miss number 41 forever. Block 6 has to handle this, and its review will check it.
- The reviewer re-ran every check, a backup and a restore, on its own database.

## 4. How you would build this yourself

### a. Write the data map before any table

One page: every field, why you need it, whether it is personal. If you cannot say why you need a field, do not store it.

### b. Describe the tables in code and generate the SQL

```ts
export const tummyLogs = pgTable("tummy_logs", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  durationSeconds: integer("duration_seconds").notNull(),
});
```

Then read the SQL file it writes. Never commit a migration you have not read.

### c. Add constraints for everything that must always be true

Ask of each column: what value would be a disaster here? Then make the database refuse it.

### d. Create a weak user for the app

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tummy_app;
```

And test that it cannot `CREATE TABLE`.

### e. Put ownership checks in one place

Write the one module. Then write the test that stops anyone going around it.

### f. Break each guard on purpose

A test you have never seen fail may not be testing anything.

## 5. Open it and follow along

You need PostgreSQL 16 or 17, or Docker. `docs/runbook.md` has both ways in full. The short version without Docker:

Runs in: a terminal, in the repo folder

```bash
git fetch origin
git checkout block-3-database-api
pnpm install
cp .env.example .env
```

Open `.env` and make up two passwords for `DB_APP_PASSWORD` and `DB_MIGRATOR_PASSWORD`. Then:

Runs in: the same terminal

```bash
set -a; . ./.env; set +a
PGHOST=127.0.0.1 PGPORT="$DB_PORT" PGUSER=postgres bash infra/db/init-roles.sh
pnpm db:migrate
pnpm db:seed
pnpm test
```

Things to try:

1. **Look at the tables.** Connect with `psql` as the migrator user and run `\d tummy_logs`. Find the constraints from section 3.
2. **Try to store a raw PIN.** As the migrator, run an `INSERT INTO accounts` with `pin_hash` set to `'123456'`. Read the error.
3. **Try to drop a table as the app user.** Connect as `tummy_app` and run `DROP TABLE tummy_logs;`. Read the error.
4. **Trip the data-map test.** As the migrator, run `ALTER TABLE tummy_logs ADD COLUMN notes text;` then `pnpm --filter @tummy/api test`. Read the failure. Undo it with `NODE_ENV=development pnpm db:reset`, then migrate and seed again.
5. **See the error shape.** Start the app with `pnpm dev` and open `http://127.0.0.1:3001/api/nothing-here`.
6. **Back up and restore.** Follow the steps in `docs/runbook.md`.

## Check yourself

1. Why does the API connect as a user that cannot create tables?
2. A route returns a tummy time by its ID. What stops it from returning another family's entry?
3. What are the two layers that keep a PIN out of the logs?
4. Someone adds a `baby_name` column in a migration. What happens in CI, and what should they have done first?
5. Why did the reviewer find a bug that the builder's tests did not?

## What is still open after Block 3

- **Not yet seen running:** the Docker Compose setup and the new nginx headers. There is no Docker where this was built. Block 8 runs them.
- **Sign-in, sessions and cross-site request checks** are Block 4. Block 4's sign-in lookups need a reviewed entry in the guard's allowlist, because they happen before anyone is signed in.
- **The sync counter ordering problem** described above belongs to Block 6.
- **HTTPS, encrypted connections to the database, where backups are kept, encrypting them and scheduling them** are Block 8.
- **The guard has limits.** It cannot catch SQL text assembled at run time, and the redaction list works on field names, not on words inside a message. Review still matters.
- **Tests share the development database.** They clean up after themselves but use up counter numbers.
- **PostgreSQL is not yet confirmed with ODU.** See the decision record for what would change if MySQL is required.

Written with AI assistance and reviewed by Devin Ferrell.
