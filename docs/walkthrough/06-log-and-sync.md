# Block 6: Tummy time log and sync

This chapter explains how a caregiver logs a tummy time on one phone and sees it on another, and how the app keeps working when the signal drops. This is the first block where the app does its real job. Read it with the code open. Section 5 tells you how to run it.

## 1. What was built

| Piece | Where | What it is |
|---|---|---|
| Shared shapes and limits | `packages/shared/src/logs.ts` | What a log entry looks like, and the limits on it |
| Log routes | `apps/api/src/logs/routes.ts` | Save, delete and "what changed since" |
| Ordered writes | `apps/api/src/db/account-scope.ts` (`lockedLogWrite`) | Makes one account's writes happen one at a time |
| Decision record | `docs/adr/0009-rev-order-per-account.md` | Why that lock exists |
| The phone's copy | `apps/web/src/log/store.ts` | Entries, an outbox and the last sync number, in IndexedDB |
| The sync engine | `apps/web/src/log/engine.ts` | Sends the outbox, retries, pulls changes |
| Start, stop, wipe | `apps/web/src/log/local-data.ts` | Loads the engine when signed in. Deletes the phone's copy on sign-out |
| Timer maths | `apps/web/src/log/timer.ts` | Elapsed time from clock readings |
| Screens | `apps/web/src/pages/log/` | Start tummy time, Log, Add a time |

The routes:

| Method and address | What it does |
|---|---|
| `PUT /api/logs/:id` | Saves an entry, replaces it, or brings a deleted one back |
| `DELETE /api/logs/:id` | Marks an entry deleted |
| `GET /api/logs?since=N` | Answers every change after sync number N, at most 500 at a time |

No new stored fields. An entry is a start time and a length in seconds. No notes, no names, no photos.

## 2. Why it is built this way

**The server is the truth, the phone keeps a copy.** A parent holding a baby cannot wait for a spinner, and hospital and home signal is often poor. So every change is saved on the phone first and shown at once. Sending it to the server happens afterwards, in the background, and is retried until it works. This pattern has a name: offline-first with an outbox.

**Simple conflict rule.** If two phones change the same entry, the last change to reach the server wins. Smarter merging exists, but a tummy time log almost never has two people editing one entry, and the next student has to be able to reason about the rule.

**No judgement.** The screens praise effort and show no streaks, targets or red marks. A parent who managed two minutes should not be told it was not enough.

## 3. The steps, in the order they were done

1. **Wrote the shared shapes and limits.**
2. **Built the three routes**, each needing a signed-in account.
3. **Fixed the ordering problem** found in Block 3's review, and wrote the tests that prove it.
4. **Wrote the decision record** for that fix.
5. **Added the `idb` library**, a small helper for the browser's IndexedDB.
6. **Built the phone's copy and the sync engine.**
7. **Tied it to sign-in**: start syncing when signed in, delete the copy when not.
8. **Built the three screens.**
9. **Wrote the tests**, including browser tests with two phones and with the network switched off.
10. **Broke things on purpose** to prove the tests catch them.

### Ideas worth understanding

**The phone makes the ID.** Each entry's ID is a random UUID made on the phone. That makes sending safe to repeat. If the phone sends a save, loses signal before the answer arrives, and sends it again, the server sees the same ID and saves the same entry twice over. Nothing is duplicated. An operation you can repeat without harm is called idempotent. That is also why the route is `PUT` ("put this here") and not `POST` ("make a new one").

**Sync numbers.** Every time the server saves a change to any entry, it stamps the entry with the next number from one counter. That number is called `rev`. A phone remembers the highest number it has seen and asks "give me everything after that". It gets only what is new. Deleted entries are kept with a "deleted" mark, so the delete itself is a change that reaches the other phones.

**The ordering bug, and why a lock fixes it.** Here is the trap. A database counter hands out a number when a write *asks*, not when the write *finishes*.

1. Write A asks and gets 41. It is slow.
2. Write B asks and gets 42. It finishes first.
3. A phone syncs. It sees 42 and remembers "I am up to 42".
4. Write A finishes, as 41.
5. The phone asks "anything after 42?" The answer is no. It never gets entry 41.

No error, no crash. One family's phone is just quietly missing an entry forever. Bugs like this are the worst kind, because nothing tells you.

The fix: before any write to an account's log, the server takes a lock on that account's row.

```sql
SELECT id FROM accounts WHERE id = $1 FOR UPDATE;
```

A second write for the same account has to wait until the first is completely finished. So one account's writes finish in the same order as their numbers. Different families do not wait for each other. The second half of the fix: the "newest number" in a sync answer is the highest number among the rows that answer actually returned. It is never read from the counter, which may be ahead.

Two tests prove it. One holds a write open and shows the second one waiting. The other fires many writes at once with syncs in between, and checks the phone ends with every row. With the lock removed, that second test really does lose a row.

**Another family's ID.** What if a phone sends a save with an ID that belongs to a different account? The save is one statement: insert, or if the ID exists, update. The update half carries its own rule, "only if this entry is mine". For someone else's entry nothing happens and the answer is "not found", the same as if it did not exist.

**The outbox.** On the phone, a change is written in one step to two places: the entry itself, and a queue of changes waiting to go. The engine sends the queue one at a time, oldest first.

- The queue holds at most one waiting change per entry. A newer change replaces the older one.
- If the server cannot be reached, the engine waits 2 seconds, then 4, then 8, up to 5 minutes. Growing waits are called backoff. Each wait is shortened by a random amount so that many phones do not all retry at the same instant.
- It also tries at once when the phone says it is back online, or the app comes back to the front.
- If the server says the change is not valid and never will be, the change leaves the queue and the entry is marked "This time could not be saved."

**Pull rules.** After the outbox is empty, the phone pulls. Two rules keep it safe. A change still waiting on the phone is never overwritten by what the server sent. And the phone's "last number seen" only ever goes up.

**A subtle race the store handles.** The engine sends a change. While the answer is on its way, the person changes the same entry again. When the first answer arrives, the engine must not remove the *newer* change from the queue. Each queued change has its own order number, and the engine only removes the one it actually sent.

**Three plain sentences for sync state.** "Saved on this phone", "Saved", and "Can't reach the server. We'll try again." A screen reader is told politely when the state changes, not on every retry.

**The timer.** Elapsed time is "now minus the start time", worked out fresh each time it is shown. It is never a count of ticks, because browsers slow or stop ticks when the app is in the background. The time is marked so a screen reader can read it when asked but does not interrupt every second. It announces once at start and once when saved.

**Undo.** Delete does not ask "are you sure?". It deletes and offers Undo, and focus moves to the Undo button. Undo stays until the next action. It does not vanish on a countdown, because a time limit is hard for someone using a screen reader or holding a baby.

**Leave nothing behind.** The phone's copy is deleted on sign-out, on sign-out everywhere, on account deletion, whenever the server says this phone is no longer signed in, and before a new sign-in. If you sign out with unsent changes, the app tries to send them once and, if it cannot, tells you and lets you choose.

**Loaded only when needed.** The log code is in its own files and loads after sign-in. Home, Lessons and When to call do not pay for it. The first download grew from 110.5 KB to 112.0 KB.

### Proof the checks bite

The builder broke six things and saw the named tests fail. The reviewer repeated the first two.

| Break | What failed |
|---|---|
| Removed the account lock | "while write A is open, write B waits". The builder also saw the many-writes test lose a real row |
| Removed "only if this entry is mine" from the save | Two tests on another account's entry |
| Doubled the future-time limit | Three limit tests |
| Let a pull overwrite a waiting change | "a server entry never overwrites a change here that is still waiting" |
| Removed the wipe on sign-out | Five unit tests and one browser test |
| Removed the 500 cap | "pages through every change, at most 500 at a time" |

### What the reviewer found and changed

- **The design for the ordering fix came from review.** Block 3's review wrote the problem down. Block 6's brief required the lock, the rule for "newest number", and the tests. The builder built them as asked.
- **Merged the layout fix from Block 4** (the bottom bar no longer covers the page) and moved the new browser tests onto the shared sideways-scroll helper.
- **Wrote down a gap the builder spotted.** The data map says deleted entries are erased after 90 days. Nothing does that yet. When it is built, a phone that has not synced for longer than that would never hear about those deletes. The rule that must come with the cleanup is now in ADR 0005.
- **Added a step to the runbook.** After a database restore, the sync counter must be moved forward, or phones would skip new changes that reuse old numbers.
- **Updated the threat model and the data map** to match what was built.
- **Read the two older tests the builder changed.** Both changed because the screens they test are real now and need sign-in. Nothing was loosened.
- The reviewer re-ran every check and the browser tests twice, and looked at the three screens.

## 4. How you would build this yourself

### a. Let the client make the ID, and make saving repeatable

```ts
const id = crypto.randomUUID();
await fetch(`/api/logs/${id}`, { method: "PUT", body: JSON.stringify(entry) });
```

### b. Stamp every change with a counter, and ask "what is new?"

```sql
SELECT * FROM tummy_logs WHERE account_id = $1 AND rev > $2 ORDER BY rev LIMIT 501;
```

Ask for one more than the page size. If you get it, there is more.

### c. Ask what happens when two writes overlap

Draw the timeline on paper, like the five steps above. If the order can go wrong, make the writes take turns.

### d. Save locally first, in one step with the queue

```ts
const tx = db.transaction(["entries", "outbox"], "readwrite");
await tx.objectStore("entries").put(entry);
await tx.objectStore("outbox").put({ id: entry.id, op: "put", seq });
await tx.done;
```

Either both are written or neither. You never have an entry with no queued send.

### e. Retry with growing waits

```ts
const wait = Math.min(5 * 60_000, 2000 * 2 ** (failures - 1));
```

### f. Compute time, do not count it

```ts
const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
```

### g. Decide what happens to local data at sign-out, and test it

## 5. Open it and follow along

You need the database and `.env` from chapters 3 and 4.

Runs in: a terminal, in the repo folder

```bash
git fetch origin
git checkout block-6-log-sync
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://127.0.0.1:5173` and create an account.

1. **Log a time.** Tap Log, then Start tummy time. Start, wait a few seconds, Stop. Go to Log.
2. **Look at the phone's copy.** Developer tools, Application, IndexedDB, `tummy-time`. Open `entries`, `outbox` and `meta`.
3. **Two phones.** Open a private window, sign in with your code and PIN, and open Log. The entry is there. Delete it in one window. Switch to the other and back so it syncs.
4. **Go offline.** Developer tools, Network, choose Offline. Use Add a time. The line says "Saved on this phone" and the `outbox` store has one row. Go back online. It becomes "Saved" and the outbox is empty.
5. **Watch the requests.** In the Network tab, find the `PUT /api/logs/...` and the `GET /api/logs?since=...`. Note the `rev` and `latestRev`.
6. **Try the limits.** In Add a time, enter 200 minutes, or a date two years ago. Read the messages.
7. **Sign out, then look at IndexedDB again.** The database is gone.
8. **See the lock.** Open `apps/api/test/logs/rev-order.test.ts` and read the first test. Then, in `account-scope.ts`, remove `.for("update")` and run `pnpm --filter @tummy/api test`. Read the failure. Put it back.

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

1. Why does the phone make the entry's ID, and what does that make safe?
2. Walk through the five steps of the ordering bug. Which step does the lock change?
3. Why must "newest number" come from the rows returned and not from the counter?
4. The server sends an entry in a pull, but the phone has an unsent change to the same entry. What happens, and why?
5. Why is elapsed time computed from the clock and not counted in ticks?
6. Name the five moments the phone's copy is deleted.
7. What would go wrong after a database restore if the counter were not moved forward?

## What is still open after Block 6

- **A running timer is lost if the page reloads or the app is closed.** Keeping it would mean storing one more thing on the phone, which needs a line in the data map and Devin's OK. The Add a time form covers the gap for now.
- **The app cannot open with no signal yet.** It works offline once open. Opening offline is Block 7.
- **Deleted entries are never erased yet**, and the cleanup needs the "start again from zero" rule first. See ADR 0005.
- **No screen to edit an entry.** The card did not ask for one. Delete and add again works.
- **Two tabs open at once** can both send the same change. It is harmless, because saving is repeatable, but it is not tested.
- **If one tab signs out, another open tab of the same account stops syncing** and only learns it is signed out on its next reload.
- **The line can say "Saved" for a moment on opening**, before the first pull has finished.
- **The safety reminder on the timer screen is a marked gap.** The style guide has no approved wording for it. It needs the client's clinician.
- **Saving under an ID that another account uses shows that the ID is taken.** Nothing else is shown. It is in the threat model.
- **Not yet done by a person:** two real phones, and the screen reader pass on the timer and the list. The block's card asks for both.

Written with AI assistance and reviewed by Devin Ferrell.
