# Architecture decision records (ADRs)

One short page per decision that would be expensive to change later. Format after Michael Nygard: context, decision, options not taken, consequences, and what would reopen it.

**Status words:** Proposed (recommended, waiting on approval), Accepted, Superseded by NNNN.

All seven are **Proposed** as of Nov 10, 2026. Dr. Gupta approves the platform; Devin approves the rest.

| # | Decision | Status |
|---|---|---|
| [0001](0001-stack.md) | Stack: TypeScript end to end, React PWA, Fastify API, SQL database | Proposed |
| [0002](0002-repo-layout.md) | One repo with workspaces | Proposed |
| [0003](0003-sign-in-seam.md) | Sign-in behind a seam; family code + PIN as the default | Proposed |
| [0004](0004-sessions.md) | Server-side sessions in a cookie | Proposed |
| [0005](0005-sync.md) | Sync: server is truth, last write to arrive wins | Proposed |
| [0006](0006-content-as-files.md) | Lessons and the safety card are files, not code | Proposed |
| [0007](0007-hosting.md) | Hosting: containers, temporary staging, then ODU | Proposed |
| [0008](0008-postgresql-and-database-users.md) | PostgreSQL, two database users, database required at start-up | Proposed |

To add one: copy the newest file, give it the next number, and add a row here. Never edit an Accepted record's decision; write a new one that supersedes it.
