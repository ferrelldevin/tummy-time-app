# Block 7: Offline and install

This chapter explains how the app opens with no signal, how it gets onto a phone's home screen, and how a phone moves to a new version without ever showing old safety text for longer than it must. Read it with the code open. Section 5 tells you how to run it.

## 1. What was built

| Piece | Where | What it is |
|---|---|---|
| Service worker settings | `apps/web/vite.config.ts` | What the phone keeps for offline use, and what it never keeps |
| Build check | `scripts/check-precache.mjs` | Fails the build if the worker breaks the caching rules |
| When to update | `apps/web/src/update/can-update.ts` | One small function: is it safe to reload right now? |
| The updater | `apps/web/src/update/updater.ts` | Looks for new versions and switches at safe moments |
| Update notice | `apps/web/src/update/UpdateNotice.tsx` | "A new version is ready" with a button |
| Signed in with no signal | `apps/web/src/session.tsx`, `log/local-data.ts` | Opens the log from the phone's copy when the server cannot be reached |
| "Needs a connection" | `apps/web/src/pages/account/` | Sign-in, sign-out and delete say plainly that they need signal |
| Manifest and icons | `apps/web/public/manifest.webmanifest`, `public/icons/` | What the phone needs to install the app |
| Help page | `apps/web/src/pages/AddToHomeScreen.tsx` | Steps for iPhone and Android |
| Server caching rules | `infra/nginx.conf.template`, `infra/nginx-security-headers.conf` | What the server tells browsers to keep |

## 2. Why it is built this way

A parent at 3 a.m. with a crying baby and one bar of signal needs "When to call" to open. That is the reason for this block.

But keeping files on a phone creates a new risk. This app shows health information. If a clinician corrects the safety card, a phone that kept the old copy keeps showing the wrong one. So the rules in this block are safety rules, and the reviewer set them before any code was written:

1. Keep the whole app on the phone, as one set, so old words never mix with new code.
2. Never keep a family's data in the file cache.
3. Look for a new version often, and switch to it as soon as that costs the person nothing.

## 3. The steps, in the order they were done

1. **Added `vite-plugin-pwa`**, which builds the service worker with Google's Workbox library.
2. **Set the caching rules** and wrote the build check that enforces them.
3. **Made the timer and the sync engine able to say "I am busy".**
4. **Made the app open signed in with no signal.**
5. **Wrote the updater.**
6. **Wrote the manifest, drew a placeholder icon, and built the help page.**
7. **Wrote browser tests with the worker really running**, including one that serves a second build to test updating.
8. **Wrote the server's caching rules.**
9. **Broke things on purpose** to prove the tests catch them.

### Ideas worth understanding

**What a service worker is.** It is a script the browser keeps and runs separately from the page. It sits between the page and the network. When the page asks for a file, the worker can answer from files it saved earlier. That is how a web page opens with no signal.

**Precache: one sealed set.** At build time, a list is made of every file in the app, each with a fingerprint of its contents. On the first visit the worker downloads all of them. That includes screens the person has not opened yet, so every screen works offline after one visit with signal. Twelve files, about 566 KB.

Lessons and the safety card are compiled into those files (chapter 5). So there is no separate "content cache" that could fall out of step. A phone has version A of everything or version B of everything, never a mix.

**What is never cached.** Nothing from `/api/`. A family's data on the phone lives in one place only, the IndexedDB copy from chapter 6, which is deleted at sign-out. The file cache holds only things that are the same for everyone, which is why sign-out can leave it alone and "When to call" still opens afterwards.

A promise like that is worth nothing unless it is checked. `check-precache.mjs` reads the built worker and fails the build if it contains any caching rule beyond the file list. A browser test also signs in, uses the app, then reads every cache and looks for anything from the API.

**How an update happens.** This is the life cycle, and it is the part most people get wrong:

1. The browser fetches `sw.js` again. If one byte differs, it is a new worker.
2. The new worker downloads the new set of files, next to the old set.
3. It then **waits**. The page that is open still runs the old files, and swapping files under a running page breaks it.
4. Someone has to tell it to take over, and then the page has to reload.

Step 4 is the design decision. Reload too eagerly and you wipe out a running timer. Never reload and the phone shows old text for days.

**The rule: `canUpdateNow`.** A waiting version is applied without asking only at a safe moment: the app starts, it comes back to the front, or the person moves to another screen. And only if all of these are true:

```ts
if (state.timerRunning) return false;
if (state.saving) return false;
if (state.typedText) return false;
if (state.unsent > 0 && state.canSend) return false;
return true;
```

No timer running. No save in progress. Nothing typed into a form. No unsent changes that could be sent first. Unsent changes that cannot be sent anyway (no signal) do not block it, because they are safe in IndexedDB across a reload.

The whole rule is one function with no side effects, so every line has a unit test. That is a pattern worth copying: put the decision in a pure function, and keep the messy browser code outside it.

There is also a notice at the top of every screen with an "Update now" button. A running timer holds even the button. It says to stop the timer first.

**Why the updater is our own code.** The plugin ships a helper that does the reload for you. It reloads every open tab the moment the new worker takes over, which could reload a tab with a running timer. So the builder wrote a small updater that checks the rule one last time right before reloading.

**Looking for updates.** At start, on every return to the front, when the phone comes back online, and once an hour while open.

**The server's part.** The browser also has an ordinary HTTP cache. If the server let browsers cache `sw.js`, phones would not notice a new version. So:

| File | Server says | Why |
|---|---|---|
| `sw.js`, `index.html`, the manifest | `no-cache`: ask me every time | These announce a new version |
| Files under `/assets/` | Keep for a year | Their names contain a fingerprint. New content means a new name |

**Signed in with no signal.** At start the page asks the server "am I signed in?". Offline, that question fails. The fix stores nothing new. The phone's log database exists only while the phone is signed in, because every way of signing out deletes it. So if the server cannot be reached and that database exists, the app treats the phone as signed in but not confirmed, shows the log from the phone's copy, and asks the server again when signal returns. If the server then says no, the copy is wiped as usual.

**Things that need signal say so.** Signing in, signing out and deleting the account all need the server. Offline, each says so in a plain sentence. Signing out offline does not quietly wipe the phone and claim success, because the server would still think the phone was signed in.

**Installing.** A web app manifest is a small file with the app's name, colours and icons. With it and a service worker, Android Chrome offers to install the app. iPhone has no install prompt at all, so the help page gives the steps through the Share button. A test keeps the manifest's colours equal to the design tokens.

### Proof the checks bite

The builder broke five things and saw the named tests fail. The reviewer repeated the first two.

| Break | What failed |
|---|---|
| Added a caching rule for `/api/` | The build check ("registers 2 routes", "uses NetworkFirst") and the browser test found `/api/me` in the cache |
| Made `canUpdateNow` ignore the timer | Four unit tests, and a browser test saw the page reload under a timer |
| Let offline sign-out wipe the phone | Two unit tests and a browser test |
| Removed "signed in, not confirmed" | Seven unit tests and a browser test |
| Changed the manifest colour | The token test |

### What the reviewer found and changed

- **The rules themselves came from review**, before the build. The card says the reviewer decides any rule that could leave old medical text on a phone.
- **Read the updater line by line.** One limit is accepted and written down: if a timer starts in the instant between "switch" and "reload", the page stays on the old files while the new worker is in charge. The page then reloads at the next safe moment. Keeping the previous release's files on the server for one release covers that gap, and that is now a runbook step.
- **One low-severity advisory is open and not hidden.** A build tool that Workbox depends on (`deepmerge`) has a reported flaw with no fixed version. It runs only on our own machine at build time, on our own settings, and never on a phone. It is listed in the pull request. It was not added to an ignore list.
- **Updated the threat model, data map, runbook and the plan card.** Lighthouse removed its "installable" check, so the card now names the browser's own installability report.
- **Wrote down an iPhone limit the builder raised.** Safari deletes a site's stored data after 7 days without use unless the app is on the home screen. Unsent changes could be lost that way. The help page is the answer for now, and the client should know.
- The reviewer re-ran every check and the browser tests twice.

### Scores

Lighthouse, simulated mid-range phone, production build: performance 97 to 100 and accessibility 100 on five screens. The browser reports no installability errors.

## 4. How you would build this yourself

### a. Decide what may be cached before writing anything

Two lists: "the same for everyone" and "belongs to one person". Only the first goes in the file cache.

### b. Let a tool build the worker

```ts
VitePWA({
  registerType: "prompt",
  workbox: { navigateFallbackDenylist: [/^\/api\//], runtimeCaching: [] },
});
```

### c. Check the built file, not your settings

Settings can be right and the output wrong. Read the output in a script and fail the build.

### d. Put the "may I reload?" decision in one pure function

Then test every line of it.

### e. Register the worker and ask for updates

```ts
const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void reg.update();
});
```

### f. Tell the waiting worker to take over, then reload

```ts
reg.waiting?.postMessage({ type: "SKIP_WAITING" });
navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
```

Put your safety check in front of both lines.

### g. Set the server's cache headers to match

## 5. Open it and follow along

The service worker only exists in the production build, not in `pnpm dev`.

Runs in: a terminal, in the repo folder

```bash
git fetch origin
git checkout block-7-offline-install
pnpm install
pnpm build
```

Change `APP_ORIGIN` in `.env` to `http://127.0.0.1:4173`, then start the API in one terminal and the built app in another:

```bash
pnpm --filter @tummy/api dev
```

```bash
pnpm --filter @tummy/web exec vite preview
```

Open `http://127.0.0.1:4173`.

1. **See the worker.** Developer tools, Application, Service workers. Then Cache storage: open the cache and count the files.
2. **Go offline.** Network tab, choose Offline. Reload. Open a lesson and When to call.
3. **Log offline.** Online again, create an account. Go offline, reload, add a time. Read the status line. Go online and watch it change.
4. **Try to sign out offline.** Read the message.
5. **Look for your data in the cache.** In Cache storage, search for `/api/`. There is nothing.
6. **Make an update.** Change a word in `apps/web/src/strings/en.ts`, run `pnpm build` again, and switch away from the browser tab and back. The notice appears, or the page reloads by itself if nothing is in the way.
7. **Hold it with a timer.** Start the timer, repeat step 6, and see that the page does not reload. Press "Update now" and read what it says.
8. **Trip the build check.** In `vite.config.ts`, change `runtimeCaching: []` to cache `/api/`, run `pnpm build` then `pnpm check:size`. Read the failure. Put it back.

Run the checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:size
pnpm test:e2e
```

## Check yourself

1. Why are lessons and the safety card cached as part of the app and not in a cache of their own?
2. Why does sign-out not clear the file cache, and what makes that safe?
3. A new worker has downloaded everything. Why does it wait?
4. List the conditions in `canUpdateNow`. Why do unsent changes block it only when they could be sent?
5. What would happen if the server let browsers cache `sw.js` for a day?
6. How does the app know it is signed in when it cannot reach the server, without storing anything new?
7. Why does signing out offline refuse instead of wiping the phone?

## What is still open after Block 7

- **Nothing was tried on a real phone.** The card asks for a real iPhone and a real Android phone in airplane mode. iPhone Safari's update behaviour, the help page's steps, and VoiceOver and TalkBack on the notice all need a person.
- **The server rules have never run.** No Docker where this was built. Block 8 runs them and checks each header. The steps are in the runbook.
- **A phone that stays offline keeps its old version**, and one left open on a single screen shows the notice but switches only at the next safe moment. Nothing can fix the first. The second is the price of never interrupting.
- **iPhone deletes stored data after 7 days without use** unless the app is on the home screen.
- **The icon is a placeholder** drawn from the app's colours. The client's logo replaces it.
- **One low-severity advisory in a build-time tool**, with no fix available yet.
- **A running timer is still lost on reload.** It waits on a decision about storing its start time on the phone.
- **`GET /api/me` answers 401 for a signed-out visitor**, which prints an error in the browser console on every signed-out page. It is correct but noisy.
- **A check by hand of the browser's storage after sign-out** is still owed.

Written with AI assistance and reviewed by Devin Ferrell.
