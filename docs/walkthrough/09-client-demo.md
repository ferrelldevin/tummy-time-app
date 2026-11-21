# Client demo: the app with a pretend server

This chapter explains the demo built to show the client: how the same app runs with no server, how "Getting started" turns four answers into a plan, how lessons got quick checks, how the "Baby crying?" coach works, and how all of it was checked. Read it with the code open. Section 5 tells you how to run it.

**Where this stands.** Built in one overnight session on branch `demo-client-preview` (draft pull request, stacked on Block 8). Checked by automated tests in a real browser at two phone sizes. Not yet checked on a real phone or with a screen reader by a person. Every lesson and warning sign is a placeholder: no clinician has read them.

**This is not a Stage B block.** Stage B (Blocks 9 to 16) waits for the client's answers. This demo borrows early drafts of Blocks 11, 12 and 13 so the client has something real to react to. Expect most of it to change after the first meeting.

## 1. What was built

| Piece | Where | Has it run? |
|---|---|---|
| Demo build switch (`DEMO=1`) | `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `scripts/build-demo.mjs` | Yes, built and served, and tested |
| Pretend API in the browser | `apps/web/src/demo/demo-server.ts` | Yes: unit tests and the demo browser tests |
| Sample week of tummy time | `apps/web/src/demo/sample-data.ts` | Yes |
| Getting started (4 questions, one per screen) | `apps/web/src/pages/start/GettingStarted.tsx` | Yes |
| Corrected age as a range | `apps/web/src/plan/corrected-age.ts` | Yes, with its own tests |
| Plan: which lessons, in what order | `apps/web/src/plan/pathways.ts`, `store.ts` | Yes |
| 10 draft lessons, with quick checks | `content/lessons/*.md`, `packages/shared/src/content.ts` | Yes. All marked PLACEHOLDER |
| Quick check (one question, explained answer) | `apps/web/src/components/QuickCheck.tsx` | Yes |
| "Baby crying?" coach | `apps/web/src/pages/BabyCrying.tsx` | Yes |
| Week chart | `apps/web/src/pages/log/WeekChart.tsx`, `log/week.ts` | Yes |
| New look: font, colors, icons, drawings, motion | `apps/web/src/design/`, `components/Icon.tsx`, `Illustration.tsx`, `styles.css` | Yes, with contrast tests and axe |
| Demo browser tests | `apps/web/e2e-demo/demo.spec.ts` | Yes, 6 tests on 2 phone sizes |

## 2. Why this way

**The demo is the real app, not a mockup.** A mockup in a design tool is quicker, but it is thrown away, and it can promise things the code cannot do. Here the client taps the same screens the team will keep building. When she says "move this", the change lands in the real code.

**A pretend server, not a fake app.** The screens already talk to the API with `fetch("/api/...")`. The demo swaps in a small function that answers those same calls from the browser's own storage. The screens do not know the difference. Think of it like a flight simulator: the cockpit is real, only the sky is pretend. The answers are checked with the same Zod schemas the real API uses (`packages/shared`), so a screen cannot rely on an answer the real server would never give.

**Why `MemoryRouter`.** The real app uses real addresses like `/lessons/safe-setup`. A static host only has one file, `index.html`, so reloading `/lessons/safe-setup` would be "not found". `MemoryRouter` keeps the current screen in memory and never changes the address bar. The cost: the browser's back button leaves the demo instead of going back a screen. The app's own back links still work.

**Why no service worker in the demo.** A service worker keeps an old copy of the app on the phone. That is good for families with bad signal and bad for a demo you are fixing an hour before the meeting.

**Why the real build cannot contain the demo.** `__DEMO__` is a constant Vite writes into the code at build time. In the real build it is `false`, so `if (__DEMO__) { ... }` is dead code and the bundler removes it, and the `import("./demo/demo-server")` inside it is never bundled. `docs/demo.md` has the `grep` that proves it.

**Ranges, not dates.** The project rule is to collect the least data possible. "Getting started" never asks for a birth date or due date. It asks "How old is your baby now?" with ranges (less than 1 month, 1 to 2 months, ...) and "How early was your baby born?" with ranges of weeks (34 to 36, 28 to 33, before 28). Corrected age then comes out as a range too, which is honest: from ranges you cannot get one exact number.

**Lesson order lives in the lesson files.** Each lesson file says its own `order`, `pathways` tags, `minutes`, drawing and quick checks. The code only decides which tags apply to a family. Adding a lesson is still "add a file" (`docs/adding-a-lesson.md`).

**Placeholders you can see.** A step that needs the care team's words is written `CARE TEAM: ...` in the lesson file and shows on screen as a marked gap, not as advice. A video that is planned shows as a "video goes here" slot. A test fails the build if any lesson stops being `status: placeholder` without a sign-off.

**Motion only when asked for.** All animation sits inside `@media (prefers-reduced-motion: no-preference)`. A phone set to reduce motion gets none. A browser test checks it.

## 3. The steps, in order

1. **Took "before" screenshots** of the Block 8 app on a phone-sized browser, for the report.
2. **Added the demo switch.** `DEMO=1` in `vite.config.ts` sets `__DEMO__`, output folder `dist-demo`, relative paths (`base: "./"`), no PWA plugin. Declared `__DEMO__` in `globals.d.ts` so TypeScript knows it.
3. **Wrote the pretend server.** `handle(method, url, init)` matches the routes the app uses (sign-up, sign-in, session, sign-out, logs sync), checks bodies with the shared schemas, and returns `Response` objects with the same error codes as the real API. `installDemoServer()` wraps `window.fetch`: `/api/*` goes to `handle`, everything else goes to the real `fetch`. A 120 ms delay makes loading states visible, as on a real network.
4. **Published a first skeleton** to a private link to prove the host would accept it. It refused one file: the YAML library writes the character U+FFFD into the bundle. `scripts/build-demo.mjs` now rewrites it as the escape `�`, which is the same character to JavaScript.
5. **Wrote corrected-age math first, with tests.** Age since birth minus weeks born early, in weeks, as `[min, max]`. If even the oldest answer is before the due date, it says so instead of showing a negative age.
6. **Wrote the plan.** `tagsFor(profile)` turns answers into tags; `planFor(profile, lessons)` keeps the lessons with a matching tag, in file order, and moves a crying lesson to second when the family said "my baby cries".
7. **Extended the lesson schema** in `packages/shared/src/content.ts`: `checks` (up to 3; 2 to 4 choices each; exactly one right; an explanation), `order`, `minutes`, `illustration`, `videoPlanned`. Then wrote 10 draft lessons.
8. **Built the screens**: Getting started, Your plan, the new Home, Lessons, the lesson view with quick checks and "Mark as done", the crying coach, the week chart, the About demo panel.
9. **New design tokens**: a softer palette, each color pair checked for contrast in `tokens.test.ts`; the Atkinson Hyperlegible Next font served from our own files (the rules forbid fonts from other servers).
10. **Tests**: unit tests for every new screen with axe, and a new demo browser suite that taps the whole path on a 393 px and a 320 px phone, runs axe on every screen, checks 200% text causes no sideways scrolling, checks reduced motion, and fails on any console or security-policy error.
11. **Fixed what the tests found**: cards that overflowed at 320 px (grid columns need `minmax(0, 1fr)`), a duplicate link name, a label that did not match its visible text, and a readability check that should skip the credits line.
12. **Ran the whole gate** (lint, types, all unit tests, both browser suites, bundle size) and opened the draft pull request.

## 4. Build it yourself

The key idea in 15 lines. A pretend server is just a function in front of `fetch`:

```ts
const realFetch = window.fetch.bind(window);

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, location.href).pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);   // not ours: pass through
  if (path === "/api/health") return Response.json({ ok: true });
  return Response.json({ error: "not_found" }, { status: 404 });
};
```

- Every screen still calls `fetch("/api/health")`. It just never leaves the page.
- The real file adds storage, schemas and the rest of the routes. Read `handle()` in `demo-server.ts` next to the real routes in `apps/api/src/auth/` and `apps/api/src/logs/` and compare one route.

Try the corrected-age math by hand. A baby who is 2 to 4 months old (9 to 17 weeks) and was born at 28 to 33 weeks (7 to 12 weeks early): youngest corrected age = 9 - 12 = below 0, so 0; oldest = 17 - 7 = 10 weeks. 10 weeks is 2 whole months (10 x 12 / 52 = 2.3, rounded down), so the app says "About 0 to 2 months". Now open `corrected-age.test.ts` and find the same case.

## 5. Open it and follow along

Runs in: Git Bash, from the repo root

```bash
git fetch origin demo-client-preview
git switch demo-client-preview
pnpm install
pnpm build:demo
DEMO=1 pnpm --filter @tummy/web exec vite preview --port 4175
```

Open http://127.0.0.1:4175. Press F12 and switch on the phone view (the phone icon) to see it at phone size.

Follow this path while reading the code:

1. Home -> **Get started**. Answer the four questions. Open `GettingStarted.tsx` beside it.
2. **Your plan** shows the corrected-age range and your lessons. Change an answer (About -> Start over on this phone) and watch the order change. That is `planFor`.
3. Open a lesson. Find its file in `content/lessons/`. The `CARE TEAM:` line is the marked gap on screen.
4. Answer a quick check wrong, then right. Read `QuickCheck.tsx`.
5. Home -> **Baby crying?** Read `BabyCrying.tsx`: it is a small state machine (breathe, try one idea, better or still crying).
6. About -> sign in with the sample family (code and PIN are shown there) and open **Log** to see the week chart.
7. In DevTools, Application -> Local storage: `tummy-plan` and `tummy-demo-server` are everything the demo keeps.

Run the checks:

```bash
pnpm --filter @tummy/web test      # unit tests, including the new screens
pnpm test:e2e:demo                 # the demo in a real browser, two phone sizes
```

## 6. What is still not proven

- Not used on a real phone by a person, and no VoiceOver or TalkBack pass.
- The lessons, warning signs and quick-check answers are drafts from general public guidance. A clinician must rewrite or approve every one.
- Pathways, the four questions and their ranges are our guesses until the client answers.
- The `tummy-plan` storage row in `docs/data-map.md` waits for Devin's OK.
- The drawings are decoration. They do not show correct positions.

Written with AI assistance and reviewed by Devin Ferrell.
