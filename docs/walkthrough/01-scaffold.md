# Block 1: Scaffold and quality pipeline

Written Nov 10, 2026. Read time: about 20 minutes. Best read with the repo open beside it.

## 1. What was built

An app that does almost nothing, wrapped in every check the finished app will need.

- A web page that shows "Tummy Time" and one line saying whether it can reach the server.
- A server (the API) with one address, `/api/health`, that answers `{"ok": true}`.
- A shared package holding the rule for what that answer must look like. Both sides use it.
- Automatic checks: lint, types, tests, a phone-sized browser test with an accessibility scan, a size limit, dependency and secret scans.
- Container files so the whole thing can run the same way on any machine.

It was built by Sonnet 5.5 following the Block 1 card in the build plan, then reviewed by Fable 5.2, which re-ran every check and broke things on purpose to prove the checks catch them (section 3, step 9).

## 2. Why build the checks before the app

Think of a kitchen. You install the smoke detector before you cook the first meal, not after the first fire. Each check is a detector:

| Check | What it catches | Everyday comparison |
|---|---|---|
| TypeScript (strict) | Using a value as the wrong kind of thing | A spell checker for code |
| ESLint | Risky patterns, missing image descriptions | A proofreader with a rulebook |
| Vitest (unit tests) | A function that gives the wrong answer | Checking each ingredient |
| Playwright (end to end) | The whole app not working together in a real browser | Tasting the finished dish |
| axe | Screens a blind or low-vision user could not use | An accessibility inspector |
| Size budget | The app getting too heavy for an old phone | A weight limit on a bridge |
| Audit, OSV | A library we use that has a known security hole | A product recall list |
| gitleaks | A password or key saved into the repo by mistake | Checking your pockets before the wash |

If these arrive late, they flag hundreds of old problems at once and people switch them off. If they arrive first, every line of code is born passing them.

**Why one tiny feature?** The health check is the smallest thing that passes through every layer: browser, network, server, shared rule, and back. If it works, the plumbing works. Engineers call this a "walking skeleton".

## 3. The steps, in the order they were done

1. **A branch was made** from the Block 0 branch, named `block-1-scaffold`.
2. **The workspace was set up.** `pnpm-workspace.yaml` tells pnpm (the package manager) that `apps/*` and `packages/*` are separate packages living in one repo. The Node version is pinned in `.nvmrc` so everyone runs the same one.
3. **The shared package** (`packages/shared`) got one schema. A schema is a description of what valid data looks like:

   ```ts
   export const healthResponseSchema = z.object({
     ok: z.literal(true),
   });
   ```

   Zod, the library, turns that description into a checker you can run on real data.
4. **The API** (`apps/api`) was written with Fastify. Two details matter for later blocks:
   - `buildApp()` creates the server without starting it. Tests can then send it pretend requests with no network involved.
   - `env.ts` checks the settings at startup. If `API_PORT` is missing, the API refuses to start and says why in plain words. A program that starts with wrong settings fails later in confusing ways.
5. **The web page** (`apps/web`) was written with React and Vite. The visible words live in `src/strings/en.ts`, not in the component, so they can be translated later. The status line has `role="status"`, which tells a screen reader to announce it when it changes.
6. **Tests were written** for each package, plus one Playwright test that opens the built page at 390 by 844 pixels (a phone) and runs axe on it.
7. **Lint, formatting and the pre-commit hook** were added. The hook runs on your machine each time you commit.
8. **Container files, the CI workflow and Dependabot** were added. In CI every outside action is pinned to an exact commit ID, so nobody can swap its code underneath us. Each ID was looked up from the action's own repository.
9. **Review: every local check was made to fail on purpose.**

   | What was broken | Which check went red |
   |---|---|
   | A number given a text value | `pnpm typecheck` |
   | The health route changed to answer `ok: false` | `pnpm test` |
   | An image with no description | `pnpm lint` (rule `jsx-a11y/alt-text`) |
   | The same image, plus a button with no name | `pnpm test:e2e` (axe rules `image-alt`, `button-name`) |

   Each change was undone afterwards. A check you have never seen fail might not be checking anything.
10. **This chapter was written, and a draft pull request was opened.**

## 4. How you would build this yourself

You need Node.js 22 and Git. Each step is small; do them in order.

### a. Start a workspace
Runs in: Git Bash, in an empty folder
```bash
corepack enable
pnpm init
mkdir -p apps/web apps/api packages/shared
```
Then create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
`corepack enable` lets Node fetch the pnpm version named in `package.json`.

### b. Make the shared package first
The other two depend on it. Give it a `package.json` with a name (ours is `@tummy/shared`), add Zod, and write the schema from step 3 above.

Runs in: Git Bash
```bash
pnpm --filter @tummy/shared add zod
```
`--filter` means "do this only in that package".

### c. Make the API
Runs in: Git Bash
```bash
pnpm --filter @tummy/api add fastify zod
pnpm --filter @tummy/api add -D typescript tsx vitest @types/node
```
`-D` marks tools needed only while developing. Write `buildApp()` in one file and the `listen` call in another. Look at `apps/api/src/app.ts` and `server.ts` to see the split.

### d. Make the web app
Runs in: Git Bash
```bash
pnpm create vite apps/web --template react-ts
```
In `vite.config.ts`, add a proxy so that the page's requests to `/api` are passed to the API during development. Without it, the browser would treat them as two different sites.

### e. Write a test before you trust anything
Open `apps/api/test/health.test.ts`. It builds the app, sends a pretend request, and checks the answer against the shared schema. Write one like it, run `pnpm test`, then change the route to return something wrong and watch the test fail. Change it back.

### f. Add the detectors one at a time
ESLint, then Prettier, then Playwright with axe. After adding each, break something it should catch. Our `eslint.config.js` and `apps/web/e2e/home.spec.ts` are short enough to read in full.

### g. Add CI last
A CI workflow is a list of the same commands you already run by hand. Ours is `.github/workflows/ci.yml`. Read it top to bottom: every `run:` line is a command from the table in the README.

## 5. Open it and follow along

Runs in: Git Bash
```bash
git clone https://github.com/ferrelldevin/tummy-time.git
cd tummy-time
git checkout block-1-scaffold
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

`git checkout block-1-scaffold` is only needed until this block is merged into `main`.

1. Open http://localhost:5173 in your browser. You should see "Tummy Time" and "Server is reachable".
2. Open http://localhost:3001/api/health. You should see `{"ok":true}`. That is the API answering directly.
3. In the terminal, press `Ctrl+C` to stop. Open `.env`, put a `#` in front of `API_PORT=3001`, and run `pnpm dev` again. Read the message. Remove the `#`.
4. Run the checks one at a time and read what each prints.

   Runs in: Git Bash
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm check:size
   ```
5. Break something. In `apps/web/src/App.tsx`, add `<img src="/x.png" />` on the line before `</main>`. Run `pnpm lint`. Read the error, then remove the line.
6. Follow one request through the code, in this order: `apps/web/src/App.tsx` (asks), `apps/web/src/health.ts` (sends), `apps/api/src/app.ts` (answers), `packages/shared/src/health.ts` (the rule both sides agree on).

## Check yourself

- Why does `buildApp()` not start the server itself?
- The page and the API both import `healthResponseSchema`. What goes wrong in a project where each side writes its own copy?
- Why pin a CI action to a commit ID instead of a version name like `v7`?

## What is still open after Block 1

- **Not yet seen running:** the CI workflow on GitHub, the secret scan, the OSV scan, CodeQL, and the container files. This workspace has no Docker service, and the two scanners could not be installed here. The first CI run on the pull request is their first real test.
- **CodeQL may need a paid GitHub plan** on a private repo. If its job fails for that reason, Devin decides between a plan change and dropping that one check.
- **Two tools are held one version back** (TypeScript 6, ESLint 9) because the lint plugins do not support the newest yet. Dependabot will raise it when they do.
- **A dependency advisory was fixed at its cause.** The first CI run failed because the OSV scan flagged `minimatch` 10.2.6 (a moderate advisory, used only by a lint tool, never shipped to phones). Its fix is in 11.0.1, but the lint tool still asks for 10. The `pnpm.overrides` entry in the root `package.json` forces the fixed version for that one tool, and lint was re-run to prove it still works. Remove the override once `typescript-eslint` asks for the fixed version itself. This is the scan doing its job: we fixed the cause instead of telling the scan to look away.
- The data-map and content tests are placeholders until Blocks 3 and 5.

Written with AI assistance and reviewed by Devin Ferrell.
