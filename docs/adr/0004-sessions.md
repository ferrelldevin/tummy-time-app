# 0004: Server-side sessions in a cookie

Status: Proposed (Nov 10, 2026).

## Context
After sign-in the app must remember the phone for weeks, since tired caregivers should not sign in daily, and still be able to cut a phone off.

## Decision
- On sign-in the server creates a random 256-bit token and sends it in a cookie: `Secure`, `HttpOnly`, `SameSite=Lax`, path `/`.
- The database stores only a SHA-256 hash of the token, so a database leak does not leak live sessions.
- A session ends after 30 days without use or 90 days in total. A new token is issued at every sign-in.
- State-changing requests must come from our own origin and carry a custom header.
- "Sign out" ends this phone's session. "Sign out everywhere" ends all of them.

## Options not taken
- **JWT stored in the browser (localStorage).** Any script on the page can read it, and it cannot be revoked without extra machinery.
- **Very short sessions.** Safer on a shared device, but a caregiver holding a crying baby should not be asked for a PIN.

## Consequences
- One database read per request. Fine at this size.
- The web app and API must share an origin, which the reverse proxy provides.

## Reopen if
- The app is ever used on shared clinic tablets. Session length would shorten for that mode.
