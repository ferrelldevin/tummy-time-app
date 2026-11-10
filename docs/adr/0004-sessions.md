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

## As built (Block 4)
- The cookie is named `__Host-tummy_session`. The `__Host-` prefix makes the browser refuse it unless it is `Secure`, has path `/` and no domain, so another site or subdomain cannot set it. There is no relaxed setting for development: browsers accept `Secure` cookies on `127.0.0.1`.
- The app's own origin is configured as `APP_ORIGIN`. It is never worked out from the request.
- Any session the browser already had is ended before a new one starts.
- The time a session was last used is written at most about once an hour.
- Home, Lessons and When to call need no sign-in. Only the log and the account screens do.
- Not built yet: the daily job that removes ended sessions. An ended session is refused and removed when it is next presented, so this is housekeeping, not a hole. Block 8.

## Options not taken
- **JWT stored in the browser (localStorage).** Any script on the page can read it, and it cannot be revoked without extra machinery.
- **Very short sessions.** Safer on a shared device, but a caregiver holding a crying baby should not be asked for a PIN.

## Consequences
- One database read per request. Fine at this size.
- The web app and API must share an origin, which the reverse proxy provides.

## Reopen if
- The app is ever used on shared clinic tablets. Session length would shorten for that mode.
