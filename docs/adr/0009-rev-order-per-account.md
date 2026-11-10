# 0009: One account's log writes are committed in rev order

Status: Proposed (Nov 10, 2026). Devin approves.

## Context
- ADR 0005 has the server stamp every write to `tummy_logs` with the next number from one counter (`rev`), and a phone asks for "everything after rev N".
- A database counter hands out numbers when a write asks, not when it commits. Two writes that overlap can commit in the opposite order: write A takes 41, write B takes 42, B commits, a phone pulls and is told "you are up to 42", then A commits 41. The phone never asks below 42 again, so it never gets A's row.
- The next student must be able to see why the phone can trust "after rev N".

## Decision
- Every write to an account's tummy logs runs in one transaction that first locks that account's row (`SELECT id FROM accounts WHERE id = $1 FOR UPDATE`), then takes the next `rev`, then writes. A second write for the same account waits until the first has committed. One account's writes therefore commit in rev order.
- The lock lives in the one door to account data, `apps/api/src/db/account-scope.ts` (`lockedLogWrite`). Every write method there uses it.
- A pull reads its entries in a single statement, so it sees one consistent picture. Its `latestRev` is the highest rev among the rows that answer returned, or the `since` it was asked for when there are none. It is never read from the counter, which can be ahead of rows still being written.
- Writes for different accounts do not wait for each other. Revs of different accounts interleave; that does not matter, because a phone only ever asks about its own account.
- `apps/api/test/logs/rev-order.test.ts` holds one write open and shows the second waits, gets a higher rev and commits after it; and runs many writes at once with pulls in between and shows the phone ends with every row.

## Options not taken
- **A lock on the whole table, or a serializable transaction for every write.** Correct, but every family would wait on every other family, or writes would fail and need retries.
- **Read up to the "safe" rev** (the smallest rev still being written, from PostgreSQL's transaction status). Correct without locks, but much harder to explain, test and get right.
- **A commit timestamp instead of a counter.** Clocks are not ordered either; it moves the same problem.
- **A counter per account.** The same lock is needed to hand out the numbers, plus a new stored field.

## Consequences
- One account's writes are one at a time. A family has two or three phones and writes a few times a day, so the wait is never felt.
- A write that waits holds a database connection while it waits. A flood of writes for one account could hold every connection in the pool. The general rate limit (300 a minute per address) bounds this; a `lock_timeout` is a possible later guard.
- The lock row is the account row, which sign-in also updates (PIN attempt counts). A log write and a sign-in for the same account can wait briefly for each other.

## Reopen if
- Writes for one account become frequent (for example, automatic entries from a device).
- The database is no longer PostgreSQL (ADR 0008), since row locks and the counter would need equivalents.
- After a restore from backup (docs/runbook.md), phones may hold a `rev` higher than the restored counter. That is a separate operational rule, not this decision.
