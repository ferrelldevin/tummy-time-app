# 0010: A client demo build with a pretend API in the browser

Status: Proposed (Nov 2026). Waiting for Devin's OK in PR "Client demo".

## Context
- The client needs to see and tap through the app before the questionnaire comes back and before any ODU server exists.
- The real app needs the Fastify API and PostgreSQL. Neither can run on a plain static host such as a Claude Artifact link or GitHub Pages.
- A separate mockup would drift from the real code and would have to be thrown away.

## Decision
- One extra build mode, switched on with `DEMO=1` (`pnpm build:demo`). Same screens, same shared schemas, same strings.
- In that mode a small module (`apps/web/src/demo/demo-server.ts`) replaces `fetch` for `/api/*` only and answers from `localStorage`, using the shared Zod schemas, with made-up sample data.
- `MemoryRouter` instead of `BrowserRouter`, relative file paths, no service worker, banner always on.
- All demo code is behind the build-time constant `__DEMO__` and loaded with `import()`, so the real build does not contain it. A check in `docs/demo.md` proves it with `grep`.

## Options not taken
- **A clickable mockup** (Figma or a separate page). Quicker, but it is not the real app and teaches the team nothing about the code that ships.
- **A hosted test server with the real API.** The honest choice for later. Needs a host, a database and secrets, and is not set up yet.
- **Mock Service Worker (MSW).** A good library for this, but it needs a service worker of its own, which the Artifact host does not allow, and it is one more dependency.

## Consequences
- The demo is not secure and says so: PINs sit in plain text in that browser. It must never hold real data.
- Two builds to keep green. `pnpm test:e2e:demo` checks the demo on two phone sizes.
- When a real test server exists, the demo can stay for showing the app offline, or be removed by deleting `apps/web/src/demo/` and the `__DEMO__` lines.

## Reopen if
- A hosted test server with sample data is running.
- The demo code is ever found in the real build.
