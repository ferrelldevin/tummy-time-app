import { createHash } from "node:crypto";
import { forAccount, toAccountId } from "./account-scope.js";
import type { Db } from "./client.js";
import { accounts } from "./schema.js";

/**
 * Made-up sample data for development. Nothing here is real, and these accounts cannot sign in:
 * the PIN "hash" below is a placeholder that no PIN matches.
 *
 * Fixed IDs make the seed safe to run twice: rows that already exist are left alone.
 */
const SAMPLE_ACCOUNTS = [
  "00000000-0000-4000-8000-00000000a001",
  "00000000-0000-4000-8000-00000000a002",
] as const;

/** Shaped like an Argon2id hash so the column accepts it; it says "seed-only" and "not-a-real-hash". */
const PLACEHOLDER_PIN_HASH = "$argon2id$v=19$m=19456,t=2,p=1$c2VlZC1vbmx5$bm90LWEtcmVhbC1oYXNo";

/** 64 hex characters derived from a label, so no hash-like literal sits in the repo. */
function sampleLookup(label: string): string {
  return createHash("sha256").update(`tummy-time sample data: ${label}`).digest("hex");
}

function sampleLogId(account: number, entry: number): string {
  return `00000000-0000-4000-8000-0000000${String(account)}b${String(entry).padStart(3, "0")}`;
}

export interface SeedResult {
  accounts: number;
  logs: number;
}

export async function seed(db: Db): Promise<SeedResult> {
  let accountCount = 0;
  let logCount = 0;
  const base = Date.UTC(2026, 0, 5, 9, 0, 0);

  for (const [index, id] of SAMPLE_ACCOUNTS.entries()) {
    const inserted = await db
      .insert(accounts)
      .values({ id, codeLookup: sampleLookup(id), pinHash: PLACEHOLDER_PIN_HASH })
      .onConflictDoNothing()
      .returning({ id: accounts.id });
    if (inserted.length === 0) {
      continue;
    }
    accountCount += 1;

    const scope = forAccount(db, toAccountId(id));
    await scope.audit.record("sign_up");
    const entries = index === 0 ? 3 : 2;
    for (let entry = 1; entry <= entries; entry += 1) {
      await scope.logs.insert({
        id: sampleLogId(index + 1, entry),
        startedAt: new Date(base + entry * 3 * 60 * 60 * 1000),
        durationSeconds: 60 * (2 + entry),
      });
      logCount += 1;
    }
  }
  return { accounts: accountCount, logs: logCount };
}
