# 0003: Sign-in behind a seam, family code + PIN as the default

Status: Proposed (Nov 10, 2026). The client picks the final method (Block 10).

## Context
- Sign-in is required, and the method is undecided until the first client meeting. Email is one candidate.
- An earlier note says the client asked that no personal information be collected. An email address is personal information. Both are unconfirmed.
- The skeleton has to prove sync on two phones before any of that is settled, and before any ODU mail service exists.

## Decision
- All sign-in goes through one interface, `AuthProvider`, in `apps/api/src/auth/`. Routes never call a provider directly.
- The default provider is `family-code-pin`:
  - The app generates a 12-character family code from an alphabet without look-alike characters (about 60 bits of randomness), from the system's secure random source.
  - The caregiver chooses a 6-digit PIN. The most common PINs are refused.
  - The server stores a keyed hash of the code (HMAC-SHA-256 with a server secret) for lookup, and an Argon2id hash of the PIN. Neither can be read back.
  - Five wrong PINs lock the account for 15 minutes. Sign-in and sign-up are rate limited per network address, without storing the address.
- A second phone signs in with the same code and PIN. Caregivers who share the code share the log.

## As built (Block 4)
- Argon2id runs with 46 MiB of memory, 2 passes and 1 lane, through the `argon2` library. That is above the OWASP minimum.
- A PIN attempt is counted before the PIN is checked, and the fifth attempt sets the lock in the same database statement. Guesses sent at the same moment cannot get more than 5 checks, and a crash cannot leave an account at the limit with no lock.
- An unknown family code runs one full check against a dummy hash, so it costs the same as a wrong PIN.
- Deleting the account asks for the PIN again and shares the same count.
- A second provider, `dev-fake`, signs in with the code alone for development and tests. The API refuses to start with it unless `NODE_ENV` is `development` or `test`.
- The secret key for the code lookup is `CODE_LOOKUP_SECRET`. If it is lost or changed, no existing family code can be found again. Keeping it safe on the server is Block 8.

## Options not taken
- **Email one-time code now.** Needs a mail service we do not have and stores personal information the client may not want. It can be added later as a second provider.
- **Username and password.** People reuse passwords. A breach here would then hurt them elsewhere.
- **ODU account sign-in (MIDAS).** Caregivers will not have ODU accounts.
- **An auth library that owns the whole flow.** Considered. The family-code method is unusual enough that we would fight the library. We use well-known libraries for every cryptographic piece and write none ourselves.

## Consequences
- No personal information is stored to sign in.
- A caregiver who loses the code cannot recover the account yet. The sign-up screen says so plainly. Block 10 adds recovery.
- A 6-digit PIN is weak alone. Its safety comes from the long random code plus lockout and rate limits, so those are tested as carefully as the happy path.

## Reopen if
- The client chooses email or another method (add a provider, keep the seam).
- The client's clinic wants to issue codes itself.
