# 0001: Stack

Status: Proposed (Nov 10, 2026). Needs Dr. Gupta's OK.

## Context
- One part-time builder, plus students who inherit the code later. Fewer languages means fewer things to learn.
- The lab's CMAI Tracker is reported to use React, TypeScript and Vite. Nobody on this project has read its code yet, so that is a lead.
- The app needs sign-in, a database and sync, and must install on phones without an app store.
- The ODU CS Systems Group site (read Nov 10, 2026) lists MySQL as the department database service, "available on research servers", and lists a research server named `handson-web.cs.odu.edu`. PostgreSQL is not mentioned.

## Decision
- TypeScript in strict mode everywhere.
- Front end: React, Vite, installable PWA.
- API: Node.js (current LTS) with Fastify. Zod validates every input and output.
- Database: a SQL database through Drizzle ORM, with migration files in the repo. **PostgreSQL is the first choice. MySQL is the fallback if that is what the lab server offers.** This is settled before Block 3 starts.
- Tests: Vitest, Playwright, axe-core.

## Options not taken
- **PHP on the department's personal web hosting.** It is what `~/secure_html` supports, but it is tied to one student's account, and it splits the code into two languages.
- **A full-stack framework (Next.js, Remix).** More moving parts on the server than this app needs, and harder to host on a plain campus machine.
- **A hosted backend service (Firebase, Supabase).** Data would live off ODU servers, against the project's direction.
- **Express instead of Fastify.** More students know it. Fastify has schema validation built in, which we rely on for security. Either would work.

## Consequences
- One student can work on both halves.
- A single-page app can get heavy. A size budget in CI keeps it honest.
- If the database becomes MySQL, only the data layer and migrations change, as long as we know before Block 3.

## Reopen if
- Dr. Gupta or the CS Systems Group names a required platform.
- CMAI Tracker's real stack differs and the lab wants the two alike.
