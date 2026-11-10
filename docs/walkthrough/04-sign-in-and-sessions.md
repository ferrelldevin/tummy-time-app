# Block 4: Sign-in and sessions

This chapter explains how a caregiver makes an account, signs in, stays signed in, signs out and deletes the account. It is the first block where a mistake could let one family into another family's data, so most of the work is defence. Read it with the code open. Section 5 tells you how to run it.

Block 4 was built after Blocks 2, 5 and 3. Chapter numbers follow block numbers, not build order.

## 1. What was built

| Piece | Where | What it is |
|---|---|---|
| The sign-in seam | `apps/api/src/auth/provider.ts` | One interface every sign-in method must fit |
| Family code and PIN | `apps/api/src/auth/family-code-pin.ts`, `family-code.ts`, `pin-rules.ts`, `pin-hash.ts` | The default sign-in method |
| Lockout | `apps/api/src/auth/pin-check.ts` | 5 wrong PINs, then 15 minutes locked |
| Queries before sign-in | `apps/api/src/auth/credential-store.ts` | The one file allowed to look up an account nobody has proven yet |
| Sessions | `apps/api/src/auth/sessions.ts` | The cookie, its lifetime, and ending it |
| The guard | `apps/api/src/auth/guard.ts` | `defineAccountRoute`: a route that needs a signed-in account |
| Routes | `apps/api/src/auth/routes.ts` | Sign-up, sign-in, sign-out, sign-out everywhere, account, delete |
| Cross-site check | `apps/api/src/http/security.ts` | Refuses requests that do not come from our own page |
| Settings | `apps/api/src/auth/config.ts`, `.env.example` | The secret key and the app's address, checked at start-up |
| Test-only sign-in | `apps/api/src/auth/dev-fake.ts` | Signs in with the code alone. Refuses to run outside development and test |
| Screens | `apps/web/src/pages/account/` | Welcome, Create account, Your family code, Sign in, Signed out, Your account |
| Session state in the page | `apps/web/src/session.tsx`, `api.ts` | Asks the server "am I signed in?" and keeps the answer in memory only |

The routes:

| Method and address | What it does |
|---|---|
| `POST /api/auth/sign-up/finish` | Takes a PIN, makes an account, answers with the family code once |
| `POST /api/auth/sign-in/finish` | Takes the code and PIN, starts a session |
| `POST /api/auth/sign-out` | Ends this phone's session |
| `POST /api/auth/sign-out-everywhere` | Ends every session of the account |
| `GET /api/me` | Says whether you are signed in and on how many phones |
| `DELETE /api/me` | Asks for the PIN again, then deletes the account and its log |

Each of sign-up and sign-in also has a `start` route. The family-code method does nothing in them. They exist so a method with two steps, like "email me a code, then I type it", fits later without changing the routes.

No new stored fields. Everything uses the columns Block 3 created from the data map.

## 2. Why it is built this way

**No personal information.** A normal sign-in asks for an email. An email identifies a person, and the client may not want that stored. So the server makes up a 12-character family code, and the caregiver picks a 6-digit PIN. Neither says who you are.

**A 6-digit PIN is weak on its own.** There are only one million of them. The safety comes from three things working together: the long random code (you cannot even try a PIN without it), the lockout, and the rate limit. That is why those three are tested as hard as the normal path.

**The method may change.** The client has not chosen a final sign-in method. So the routes talk to an interface, not to the family-code code directly. Swapping the method later means writing one new file.

## 3. The steps, in the order they were done

1. **Added two libraries**: `argon2` (hashes PINs) and `@fastify/cookie` (reads and writes cookies). Pinned and credited.
2. **Put the shared rules in `packages/shared`**: the code's alphabet, how a typed code is tidied up, the request shapes. The web app and the API read a code the same way because they run the same function.
3. **Wrote the seam, then the family-code provider behind it.**
4. **Wrote the lockout.**
5. **Wrote sessions and the guard.**
6. **Wrote the cross-site check.**
7. **Wrote the routes.**
8. **Wrote the settings check**, so a missing key stops the API at start-up.
9. **Wrote the test-only provider** and the two guards that keep it out of a real server.
10. **Built the six screens** and the session state in the page.
11. **Wrote the tests**, including browser tests that sign up and sign in through the real method on two "phones".
12. **Broke things on purpose** to prove the tests catch them.

### Ideas worth understanding

**Hashing: storing something you cannot read back.** A hash turns text into a fixed-looking string, one way only. To check a PIN you hash what was typed and compare. If the database leaks, the thief has hashes, not PINs.

But a million PINs can all be hashed and compared in a moment with a fast hash. So PINs use **Argon2id**, a hash designed to be slow and to need a lot of memory (here about 46 MB and under a tenth of a second each). One check is nothing to a real user. A million checks is expensive. We did not write Argon2id. It comes from the `argon2` library, which wraps the reference implementation. Rule of the trade: never write your own cryptography.

**Why the family code uses a different hash.** To sign in, the server must find the account from the code. A slow, salted hash gives a different result every time, so you cannot search by it. The code is hashed with **HMAC-SHA-256**, which is a hash mixed with a secret key. Same code and same key always give the same result, so the database can look it up. Without the key, a stolen database is no help for testing guesses. The key lives only in the server's settings (`CODE_LOOKUP_SECRET`), never in the database. The code is long and random (about 59 bits), so a fast hash is fine for it. The PIN is short, so it gets the slow one.

**Do not tell a stranger which half was wrong.** If "unknown code" and "wrong PIN" gave different answers, an attacker could find out which codes exist. So both give the same message. They must also take the same time, or a stopwatch would tell them apart. When the code matches no account, the server still runs one full Argon2id check against a dummy hash made at start-up. A test measures both paths and compares them.

**Lockout, and a race.** After 5 wrong PINs in a row the account is locked for 15 minutes. The obvious way to code this is: read the count, check the PIN, write the count plus one. That has a hole. Send 100 guesses at the same instant and each one reads "0 wrong so far" before any of them writes. All 100 get checked.

The fix is to count first, in a single database statement:

```sql
UPDATE accounts SET failed_attempts = failed_attempts + 1
WHERE code_lookup = $1 AND locked_until IS NULL AND failed_attempts < 5
RETURNING ...
```

The database runs each UPDATE on a row one at a time. Only 5 can succeed. The others get no row back and are refused before any PIN is checked. A right PIN then sets the count back to zero. A test sends 20 wrong PINs at once and checks that exactly 5 were checked.

**Sessions: how the server remembers a phone.** After sign-in the server makes 32 random bytes (the token) and sends it in a cookie. The browser sends the cookie back with every request. The database stores only a SHA-256 hash of the token, so a database leak does not hand out live sessions. The token is already long and random, so a fast hash is enough here too.

The cookie's settings each close a door:

| Setting | What it stops |
|---|---|
| `HttpOnly` | Scripts on the page cannot read it. A script injection bug cannot steal the session |
| `Secure` | It is only sent over HTTPS |
| `SameSite=Lax` | It is not sent on requests another site makes in the background |
| `__Host-` at the start of the name | The browser refuses it unless it is Secure, for the whole site, with no domain. Another site or subdomain cannot plant one |

A session ends 30 days after it was last used or 90 days after sign-in, whichever comes first. The server decides. The cookie's own lifetime is only a hint to the browser.

**Session fixation.** An attacker plants a token in your browser, you sign in, and now the attacker's token is signed in. The defence is to always make a brand-new token at sign-in and end whatever token the browser had before.

**Cross-site request forgery (CSRF).** Your browser sends your cookie with every request to our server, even one started by a different website. So a hostile page could try to make your phone send "delete my account". Three defences are stacked:

1. `SameSite=Lax` on the cookie.
2. The API checks that the `Origin` header is exactly our own address. The browser sets that header and a page cannot fake it. Our address comes from a setting (`APP_ORIGIN`), never from the request, because the request is what we do not trust.
3. The request must carry a custom header, `X-Tummy-Request: 1`. A plain form on another site cannot add headers.

The check runs before the request body is even read. If `APP_ORIGIN` is not set, every changing request is refused. That is called failing closed: when unsure, say no.

**The guard and the one door.** Block 3 built `forAccount(db, accountId)`, the only way to reach an account's rows. Block 4 supplies the account ID. A route made with `defineAccountRoute` gets an `account` object that is already tied to the signed-in account. The ID comes from the session in the database, never from anything the phone sends. A handler has no way to ask for someone else's rows.

**The one exception, kept small.** Finding an account by its code happens before anyone is signed in, so it cannot go through that door. Those few queries live in one file, `credential-store.ts`. Block 3's guard test has a list of files allowed to touch the account tables. This file was added to it, with the reason, and without access to tummy logs.

**The page stores nothing.** The web app asks `GET /api/me` and keeps the answer in memory. Nothing goes in `localStorage` or any other storage on the phone. A test checks that both are empty after a full sign-up.

**A PIN field that helps tired people.** It is a password field that opens the number pad, has a "Show PIN" button, allows paste and works with password managers. Errors are written in words, announced to screen readers, tied to the field, and focus moves to them.

### Proof the checks bite

The builder broke its checks on purpose while building. The reviewer then broke these five again, one at a time, saw the tests fail, and put the code back.

| Break | What failed |
|---|---|
| Removed the dummy check for an unknown code | "an unknown code still runs one full Argon2id check" and the timing test |
| Dropped `HttpOnly` from the cookie | The cookie attribute test |
| Removed the origin comparison | Five cross-site tests: foreign, look-alike, wrong scheme, `null` and missing Origin |
| Ignored the 30-day unused limit | "30 days unused: treated as absent and deleted" |
| Took the lock out of the counting statement | The lockout tests |

### What the reviewer found and changed

- **An account could have been shut for good.** The builder's lockout counted the fifth attempt in one statement and set the lock in a second one, after checking the PIN. If the API stopped between the two (a crash, a lost database connection), the account was left at 5 with no lock. With no lock there is no time at which it opens again, and the count only resets on a successful sign-in, which was now impossible. The reviewer moved the lock into the counting statement, so they cannot come apart, and added a test that counts a fifth attempt and then stops. This is a good example of asking "what if the program dies on this exact line?" about any two-step change.
- **The threat model, both decision records, the data map and the runbook were updated** to say what was really built, including what was not: the daily cleanup of ended sessions does not exist yet.
- **The runbook now has the warning that matters most**: if `CODE_LOOKUP_SECRET` is lost or changed, no existing family code can ever be found again.
- **Two browser tests were changed by the builder.** The reviewer read both changes. Each adds a wait for the page to finish drawing before the test acts. Nothing was removed or loosened. One of them had failed about once in 40 runs before this block for that reason.
- The reviewer re-ran every check on a fresh database, and the browser tests twice.

## 4. How you would build this yourself

### a. Decide what proves who someone is, and what you store

Store only one-way values. Slow hash for anything a person chose. Keyed or plain fast hash only for long random values you must look up.

### b. Hash with a library

```ts
import argon2 from "argon2";
const hash = await argon2.hash(pin, { type: argon2.argon2id, memoryCost: 47104, timeCost: 2, parallelism: 1 });
const ok = await argon2.verify(hash, typedPin);
```

### c. Make the wrong paths look alike

Same message, same status, same amount of work. Then write the test that measures it.

### d. Count attempts in the database, in one statement

Never read, decide in your code, then write. Ask the database to do all three at once. Then ask what happens if your program stops after each line.

### e. Make the session token random, store its hash, set every cookie flag

```ts
const token = randomBytes(32).toString("base64url");
reply.setCookie("__Host-session", token, { path: "/", httpOnly: true, secure: true, sameSite: "lax" });
```

### f. Check where changing requests come from

Compare `Origin` to a configured value. Refuse when in doubt.

### g. Give handlers the account, not the ID

If a handler never holds a raw ID from the request, it cannot use the wrong one.

## 5. Open it and follow along

You need the database from chapter 3 running.

Runs in: a terminal, in the repo folder

```bash
git fetch origin
git checkout block-4-sign-in
pnpm install
```

Make a key. This prints one:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Open `.env`. Paste the key after `CODE_LOOKUP_SECRET=` and add `APP_ORIGIN=http://127.0.0.1:5173`. Then:

Runs in: the same terminal

```bash
pnpm db:migrate
pnpm dev
```

Open `http://127.0.0.1:5173`. Use that exact address, not `localhost`, or the origin check will refuse you.

Things to try:

1. **Create an account.** Tap Sign in, then Create account. Try the PIN `123456` first and read the message. Then pick a real one. Write the family code down.
2. **Look at the cookie.** Open the browser's developer tools, then Application, then Cookies. Find `__Host-tummy_session` and its HttpOnly and Secure marks. In the Console, type `document.cookie`. The session cookie is not there.
3. **Look at what the database holds.** With `psql` as the migrator user: `SELECT code_lookup, pin_hash, failed_attempts, locked_until FROM accounts;`. Your code and PIN are not in it.
4. **Second phone.** Open a private window, sign in with the code and PIN. The Account screen now says 2 phones. Sign out on all phones from one, then reload the other.
5. **Lock yourself out.** Sign in with a wrong PIN 5 times. Try the right one. Then look at `locked_until` in the database.
6. **Forge a request.** In a terminal:

   ```bash
   curl -i -X POST http://127.0.0.1:3001/api/auth/sign-out -H "Origin: https://evil.example" -H "X-Tummy-Request: 1"
   ```

   Read the status. Then change the origin to `http://127.0.0.1:5173` and try again.
7. **Read the audit trail.** `SELECT type, created_at FROM audit_events ORDER BY created_at DESC LIMIT 20;`

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

1. Why does the PIN get a slow hash and the family code a fast keyed one?
2. A family code is typed that matches no account. What work does the server still do, and why?
3. 100 wrong PINs arrive in the same instant. How many are checked, and what makes that true?
4. What does each of `HttpOnly`, `Secure`, `SameSite` and `__Host-` protect against?
5. Where does a route get the account ID from, and why not from the request?
6. What was wrong with setting the lock in a second statement?
7. What happens to every account if `CODE_LOOKUP_SECRET` is lost?

## What is still open after Block 4

- **A lost family code cannot be recovered**, and a PIN cannot be changed. The sign-up screen says so. Block 10 designs recovery. Until a PIN can be changed, "Sign out on all phones" does not keep out someone who knows the code and PIN.
- **The sign-in method is the client's choice.** Family code and PIN is the default until they pick.
- **No daily cleanup of ended sessions yet.** They are refused and removed when next used. The job itself is Block 8.
- **Where the secret key is kept on the server and how it is backed up** is Block 8.
- **Rate limits count per network address, in memory.** An attack from many addresses at once is not stopped by them. Limits at the proxy are Block 8.
- **Anyone who knows a family code can lock that account** for 15 minutes at a time by sending wrong PINs. That is the cost of any lockout. The code is the secret that prevents it.
- **Sign-up is three steps, not one transaction**: make the account, record it, start the session. If the last step failed, an unused account would be left behind. It holds nothing and harms nobody, but it is untidy.
- **A wrong PIN on the delete screen counts toward the lockout.** That is on purpose, so a borrowed phone cannot be used to guess the PIN there.
- **The browser console shows a 401 line when you are signed out.** That is the "am I signed in?" question getting the answer no.
- **One older browser test can still race** (the 200% text size test checks before the page has drawn). It has not failed here. It is written in the pull request.
- **HTTPS is not seen running yet.** The cookie is marked Secure, and browsers allow that on `127.0.0.1`. The real certificate arrives in Block 8.
- **A person must still do the screen reader pass** on the six new screens, on real phones.

Written with AI assistance and reviewed by Devin Ferrell.
