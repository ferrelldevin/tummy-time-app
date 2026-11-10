# 0008: PostgreSQL, two database users, and a database the API cannot start without

Status: Proposed (Nov 10, 2026). Devin chose PostgreSQL on Nov 10. Dr. Gupta's approval of the stack is still open.

## Context
- ADR 0001 said "PostgreSQL first, MySQL as the fallback" and left the choice open until Block 3.
- The CS department's own database service is MySQL. What the lab's server offers is not yet known.
- Block 3 builds the tables, so the choice had to be made.

## Decision
- The database is PostgreSQL (16 or 17). It runs in a container next to the app, so it does not depend on what the campus service offers.
- Two database users. The **app user** can only read and write rows. The **migrator user** owns the tables and is used only for migrations, backups and restores. The API checks at start-up that it is the app user, and refuses to run as anything stronger.
- The API needs the database to start. Without one, the API, its tests and the browser tests fail loudly. Nothing skips.
- Every query on an account's rows goes through one module, `apps/api/src/db/account-scope.ts`. A test fails the build if any other file touches those tables.
- One database counter (`tummy_logs_rev_seq`) stamps every write to `tummy_logs`. Sync (Block 6) is built on it.

## Options not taken
- **MySQL now.** It matches the department service, but nothing confirms the lab server must use it, and PostgreSQL gives us stricter checks in the database itself.
- **One database user.** Simpler. But then a bug in the app could drop a table.
- **Let the API start without a database.** Friendlier on day one, but it hides a broken setup until a caregiver hits it.

## Consequences
- A developer needs PostgreSQL locally or Docker. `docs/runbook.md` gives both ways.
- If ODU later requires MySQL, the schema file and migrations are rewritten. Routes, the account-scope module's interface and the data map stay. Three checks in the schema use PostgreSQL features (a regular-expression check, an enum type, a named sequence) and would need MySQL equivalents.
- Sign-in lookups that happen before anyone is signed in (Block 4) need a reviewed entry in the guard's allowlist.

## Reopen if
- ODU IT or the CS Systems Group names a database that is not PostgreSQL.
- The campus server cannot run containers and offers only the department's MySQL service.
