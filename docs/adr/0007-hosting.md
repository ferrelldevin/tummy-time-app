# 0007: Hosting and packaging

Status: Proposed (Nov 10, 2026). Devin approved temporary off-campus staging on Nov 10.

## Context
- The app's home is ODU servers. Who runs the lab's server, what it runs and how deploys happen are not yet known.
- The CS Systems Group site lists a research server named `handson-web.cs.odu.edu`, which is likely the lab's. Unconfirmed.
- Its personal web hosting (`~/secure_html`, files and PHP) is tied to one student's account and cannot run this app. A research project belongs on the lab's server, not in a personal web space.
- Waiting on a campus server should not block demos.

## Decision
- Package the app with Docker Compose: reverse proxy with HTTPS, app, database. The same files run on a laptop, on staging and on campus.
- Until the campus server is ready, run a temporary staging site off campus. Sample data only. Every page is labeled as a test site. It is deleted when the campus site is live.
- The staging provider is chosen in Block 8, when the database question in ADR 0001 is settled.
- Secrets come from the server's environment and are never in the repo.

## Options not taken
- **Wait for the campus server.** Hosting approval is a known long wait.
- **Install by hand on the server.** Works once, then nobody can repeat it.

## Consequences
- Two environments for a while. One deploy script serves both.
- If the campus server does not allow containers, Block 8 documents a plain Node service with the same environment variables.

## Reopen if
- The CS Systems Group or Dr. Gupta sets rules for the lab server.
