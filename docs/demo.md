# The client demo build

A version of the app that runs with **no server at all**, so it can be shown from any plain web host (a Claude Artifact link, GitHub Pages, a laptop). It is the real app's screens and code, with one difference: the API is pretended inside the browser, on made-up sample data.

It is a demo, not a pilot. Nothing a person types leaves their browser. Every lesson and warning sign is a placeholder until the client's clinician signs it off.

## Build it and open it

Runs in: Git Bash (or any terminal), from the repo root

```bash
pnpm install
pnpm build:demo                                    # writes apps/web/dist-demo/
DEMO=1 pnpm --filter @tummy/web exec vite preview --port 4175
```

Open http://127.0.0.1:4175 on your computer, or the same port on your computer's network address from a phone on the same Wi-Fi.

Check it like a user would (two phone sizes, axe on every screen, no security-policy errors):

```bash
pnpm test:e2e:demo     # set PW_CHROMIUM_PATH if Chromium is installed somewhere else
```

## What is different from the real build

| | Real build (`pnpm build`) | Demo build (`pnpm build:demo`) |
|---|---|---|
| API | Fastify + PostgreSQL on the server | `apps/web/src/demo/demo-server.ts` answers `/api/*` inside the page, using the same shared Zod schemas |
| Data | The database | The browser's `localStorage` (key `tummy-demo-server`), sample week from `apps/web/src/demo/sample-data.ts` |
| Routing | `BrowserRouter` (real addresses) | `MemoryRouter` (the address bar never changes, so any static host and an iframe both work) |
| Offline | Service worker | None. A demo should never be stuck on an old copy |
| Banner | Only on the test site | Always: "Test site. Sample data." |
| File paths | `/` | `./` (works from any folder) |

The switch is the `DEMO=1` environment variable, which `apps/web/vite.config.ts` turns into the constant `__DEMO__`. The pretend server, the sample data and the demo panel sit behind `if (__DEMO__)` and are loaded with `import()`, so the real build drops them. Two small things do stay in the real build, unused: the demo's sentences in `strings/en.ts` and one `__DEMO__ ?` choice on Home. To prove it:

```bash
pnpm --filter @tummy/web build && grep -rl "tummy-demo-server" apps/web/dist || echo "no demo code in the real build"
```

## Sample sign-in

The About screen shows it, with a **Reset the demo** button.

- Family code: `DEMQ 2345 TEST`
- PIN: `246810`

These open a made-up family with a made-up week of tummy time. Making a new account also works; it lives only in that browser.

## Hosting it

`apps/web/dist-demo/` is a folder of plain files. Any static host serves it.

- **Claude Artifact** (what was used for the first client link): publish `index.html` with every other file in the folder as a supporting file at the same path. `scripts/build-demo.mjs` already escapes one character that the Artifact host refuses (see the comment at the top of that file).
- **GitHub Pages**: needs Devin to turn on Pages in the repo settings. Not set up.

Before sharing a link with anyone outside the team, read it once as the client would: the banner is there, the draft labels are there, and there are no dates.

## Where the pieces are

| What | File |
|---|---|
| Pretend API | `apps/web/src/demo/demo-server.ts` (+ `demo-server.test.ts`) |
| Sample week | `apps/web/src/demo/sample-data.ts` |
| Demo panel on About | `apps/web/src/pages/DemoPanel.tsx` |
| Switch | `apps/web/vite.config.ts`, `apps/web/src/main.tsx` |
| Build script | `scripts/build-demo.mjs` |
| Browser tests | `apps/web/playwright.demo.config.ts`, `apps/web/e2e-demo/demo.spec.ts` |

The student-level chapter is `docs/walkthrough/09-client-demo.md`.
