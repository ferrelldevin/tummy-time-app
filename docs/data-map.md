# Data map

The complete list of what this app may store. **If a field is not on this page, the code may not store it.** From Block 3 on, an automatic test compares the live database to this page and fails the build on any difference.

To add a field: change this page first, in its own pull request, with Devin's approval. Then write the code.

Status: Proposed for the walking skeleton (Blocks 3 to 7). All data is made-up sample data until Dr. Gupta says in writing where real data may live.

## What we deliberately do not store

- Names of caregivers or babies
- Email addresses, phone numbers, home addresses
- Birth dates (if age is ever needed, it is asked as a range)
- Free-text notes (people type names and health details into notes)
- Network (IP) addresses, device IDs, location
- Photos, audio, video from caregivers
- Anything for a study, until the IRB rules

## On the server (database)

### accounts
One row per family account.

| Field | What it is | Why we need it | Personal? |
|---|---|---|---|
| id | Random ID made by the server | Links sessions and logs to an account | No |
| code_lookup | Keyed hash of the family code | Find the account at sign-in. The code itself cannot be read back | No |
| pin_hash | Argon2id hash of the PIN | Check the PIN. The PIN cannot be read back | No |
| failed_attempts | Count of wrong PINs in a row | Lockout | No |
| locked_until | When a lockout ends | Lockout | No |
| created_at | When the account was made | Support and cleanup | No |

### sessions
One row per signed-in phone.

| Field | What it is | Why we need it | Personal? |
|---|---|---|---|
| id_hash | SHA-256 hash of the session token | Recognize the phone. A database leak does not leak live sessions | No |
| account_id | Which account | Know whose data to show | No |
| created_at | When the phone signed in | 90-day limit | No |
| last_seen_at | Last use | 30-day idle limit | No |
| expires_at | When it ends | Expiry | No |

### tummy_logs
One row per tummy time.

| Field | What it is | Why we need it | Personal? |
|---|---|---|---|
| id | Random ID made on the phone | Lets a phone resend safely | No |
| account_id | Which account | Ownership | No |
| started_at | When the tummy time began | The log | Low: a time of day, tied to no name |
| duration_seconds | How long it lasted | The log | No |
| rev | Server counter value at the last change | Sync | No |
| updated_at | When it last changed | Sync, support | No |
| deleted_at | Set when deleted | Lets a delete reach the other phone | No |

### audit_events
A security record of account events.

| Field | What it is | Why we need it | Personal? |
|---|---|---|---|
| id | Random ID | Key | No |
| type | One of: sign_up, sign_in, sign_in_failed, lockout, sign_out, account_deleted | Spot attacks, answer "what happened" | No |
| account_id | Which account, if known | Same | No |
| created_at | When | Same | No |

## On the phone

| Where | What | Why | Cleared when |
|---|---|---|---|
| Cookie | Session token (HttpOnly, so page scripts cannot read it) | Stay signed in | Sign-out, expiry |
| IndexedDB | This account's tummy logs (the same fields as the server, plus a "could not be saved" mark), the outbox of unsent changes (which entry, save or delete, and its order in line), the last `rev` seen | Work offline, sync | Sign-out here or everywhere, account deletion, the server saying this phone is no longer signed in, and before a new sign-in or sign-up |
| Cache storage | App files and lesson content (no account data) | Open without signal | App update |

## In logs

Request method, path, status, duration, a random request ID. Never: PIN, family code, cookie, session token, request bodies, network address.

## Who can read what

| Who | Can read |
|---|---|
| A signed-in phone | Only its own account's rows |
| The app's database user | Rows in these tables. Cannot change the tables themselves |
| The migration database user | Table structure. Used only during deploys |
| Whoever administers the server | Everything in the database. This is why nothing here identifies a person |

## How long we keep it

| Data | Kept until |
|---|---|
| Account and its logs | The caregiver deletes the account (in the app), which erases every row for good |
| Sessions | Expiry. An ended session is refused and removed the next time it is presented. The daily cleanup for ones never presented again is not built yet (Block 8) |
| Deleted log entries (marked) | 90 days after deletion, then erased |
| Audit events | 180 days |
| Backups | 30 days (to confirm with whoever runs the server) |

Retention periods are proposals. The client and Dr. Gupta confirm them in Block 9.

## Not yet decided (each needs a row here before any code)

- Email address, if the client chooses email sign-in. It would be stored apart from any study data.
- Intake answers (baby's age range, weeks early range).
- Lesson progress and quick-check answers.
- Study consent and survey answers. Blocked until the IRB rules.
