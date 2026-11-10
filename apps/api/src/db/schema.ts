import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The database tables. Every table and column here must also be listed in docs/data-map.md;
 * test/db/data-map.test.ts compares the live database to that page and fails on any difference.
 *
 * Only two modules may import the tables: src/db/account-scope.ts (every query on account-owned
 * rows) and src/db/seed.ts (made-up data). test/account-scope-guard.test.ts enforces that.
 *
 * To change a table: edit this file, run `pnpm --filter @tummy/api db:generate`, read the new
 * SQL file it writes under apps/api/drizzle/, and commit both.
 */

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** The six audit event types the data map allows. Nothing else can be stored. */
export const auditEventTypes = [
  "sign_up",
  "sign_in",
  "sign_in_failed",
  "lockout",
  "sign_out",
  "account_deleted",
] as const;
export type AuditEventType = (typeof auditEventTypes)[number];
export const auditEventType = pgEnum("audit_event_type", auditEventTypes);

/** One counter for every write to tummy_logs (ADR 0005). Sync asks for "everything after rev N". */
export const tummyLogsRevSeq = pgSequence("tummy_logs_rev_seq", { startWith: 1, increment: 1 });

/** Hex SHA-256 / HMAC-SHA-256 output: 64 lowercase hex characters. */
const HEX_SHA256 = sql.raw(`'^[0-9a-f]{64}$'`);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeLookup: text("code_lookup").notNull(),
    pinHash: text("pin_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamptz("locked_until"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_code_lookup_key").on(t.codeLookup),
    // A keyed hash is 64 hex characters, so a raw 12-character family code cannot be stored here.
    check("accounts_code_lookup_is_hex_sha256", sql`${t.codeLookup} ~ ${HEX_SHA256}`),
    // Only an Argon2id hash fits, so a raw 6-digit PIN cannot be stored here by mistake.
    check("accounts_pin_hash_is_argon2id", sql`${t.pinHash} LIKE '$argon2id$%'`),
    check("accounts_failed_attempts_range", sql`${t.failedAttempts} BETWEEN 0 AND 1000`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    idHash: text("id_hash").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
  },
  (t) => [
    index("sessions_account_id_idx").on(t.accountId),
    index("sessions_expires_at_idx").on(t.expiresAt),
    check("sessions_id_hash_is_hex_sha256", sql`${t.idHash} ~ ${HEX_SHA256}`),
    check("sessions_expires_after_created", sql`${t.expiresAt} > ${t.createdAt}`),
    check("sessions_seen_after_created", sql`${t.lastSeenAt} >= ${t.createdAt}`),
  ],
);

export const tummyLogs = pgTable(
  "tummy_logs",
  {
    // Made on the phone (a random UUID), so there is no default: the server never invents one.
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    startedAt: timestamptz("started_at").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    // bigint in the database; read as a JS number, which is exact up to 2^53 writes.
    rev: bigint("rev", { mode: "number" })
      .notNull()
      .default(sql`nextval('tummy_logs_rev_seq')`),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    deletedAt: timestamptz("deleted_at"),
  },
  (t) => [
    // "Everything for this account after rev N": the one query sync runs on every pull.
    index("tummy_logs_account_id_rev_idx").on(t.accountId, t.rev),
    // Each write gets its own number from the counter; two rows can never share one.
    uniqueIndex("tummy_logs_rev_key").on(t.rev),
    // Same limits Block 6 validates in the API (1 second to 2 hours). The database is the backstop.
    check("tummy_logs_duration_range", sql`${t.durationSeconds} BETWEEN 1 AND 7200`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: auditEventType("type").notNull(),
    // "If known": a failed sign-in for a code that matches no account has no account.
    // When an account is deleted its events stay, unlinked, for the audit retention period.
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_events_account_id_idx").on(t.accountId),
    index("audit_events_created_at_idx").on(t.createdAt),
  ],
);
