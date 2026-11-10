import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LogEntry, PutLogBody } from "@tummy/shared";
import { LOCAL_DB_NAME } from "./local-data";

/**
 * This phone's copy of the log, in IndexedDB (docs/data-map.md, "On the phone"). Three stores,
 * nothing else, and nothing in localStorage or sessionStorage:
 * - entries: this account's tummy times, as last seen here.
 * - outbox:  changes made here that the server has not taken yet. At most one per entry ID.
 * - meta:    the last rev seen from the server.
 *
 * Every change is written to `entries` and `outbox` in one IndexedDB transaction, so a change
 * is never saved without being queued, or queued without being saved.
 */

/** One tummy time on this phone. */
export interface LocalEntry {
  id: string;
  startedAt: string;
  durationSeconds: number;
  /** Set when deleted here and not yet confirmed. Server deletes remove the entry instead. */
  deletedAt: string | null;
  /** The server's rev for this entry, or null when the server has never confirmed it. */
  rev: number | null;
  /** The server refused this change for good (400 or 404), so the screen says it was not saved. */
  notSaved: boolean;
}

export type OutboxChange =
  | { id: string; seq: number; op: "put"; body: PutLogBody }
  | { id: string; seq: number; op: "delete" };

/** A change as the caller gives it. The store numbers it. */
export type NewChange = { op: "put"; body: PutLogBody } | { op: "delete" };

interface LogDb extends DBSchema {
  entries: { key: string; value: LocalEntry };
  outbox: { key: string; value: OutboxChange; indexes: { bySeq: number } };
  meta: { key: "lastRev"; value: number };
}

export interface LogStore {
  allEntries(): Promise<LocalEntry[]>;
  pendingCount(): Promise<number>;
  lastRev(): Promise<number>;
  /** Saves the entry and queues the change, replacing any older queued change for the same ID. */
  saveChange(entry: LocalEntry, change: NewChange): Promise<void>;
  /** The oldest queued change, or undefined when the outbox is empty. */
  nextChange(): Promise<OutboxChange | undefined>;
  /**
   * The server took `change`. Removes it from the outbox, and stores the server's copy (or
   * removes the entry, for `null`), unless a newer change for the same ID was queued meanwhile.
   */
  changeSent(change: OutboxChange, stored: LogEntry | null): Promise<void>;
  /** The server refused `change` for good. Removes it and marks the entry as not saved. */
  changeRefused(change: OutboxChange): Promise<void>;
  /**
   * Applies one page of server changes, in rev order, and records `latestRev`. A server entry
   * never replaces an entry that still has a change waiting in the outbox, nor a newer copy.
   */
  applyPull(entries: LogEntry[], latestRev: number): Promise<void>;
  close(): void;
}

function fromServer(entry: LogEntry): LocalEntry {
  return {
    id: entry.id,
    startedAt: entry.startedAt,
    durationSeconds: entry.durationSeconds,
    deletedAt: entry.deletedAt,
    rev: entry.rev,
    notSaved: false,
  };
}

/** Opens (or creates) the database. `onClosed` runs if another tab deletes or upgrades it. */
export async function openLogStore(onClosed: () => void): Promise<LogStore> {
  const db: IDBPDatabase<LogDb> = await openDB<LogDb>(LOCAL_DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore("entries", { keyPath: "id" });
      const outbox = database.createObjectStore("outbox", { keyPath: "id" });
      outbox.createIndex("bySeq", "seq", { unique: true });
      database.createObjectStore("meta");
    },
    // Another tab (or this one) is deleting the database at sign-out: let go at once, so the
    // delete is not blocked and nothing here writes to it again.
    blocking() {
      db.close();
      onClosed();
    },
    terminated() {
      onClosed();
    },
  });

  return {
    allEntries: () => db.getAll("entries"),
    pendingCount: () => db.count("outbox"),
    async lastRev() {
      return (await db.get("meta", "lastRev")) ?? 0;
    },

    async saveChange(entry, change) {
      const tx = db.transaction(["entries", "outbox"], "readwrite");
      const outbox = tx.objectStore("outbox");
      const last = await outbox.index("bySeq").openCursor(null, "prev");
      const seq = (last?.value.seq ?? 0) + 1;
      // The entry first, then the queued change, in the same transaction.
      await tx.objectStore("entries").put(entry);
      await outbox.put({ ...change, id: entry.id, seq });
      await tx.done;
    },

    async nextChange() {
      const cursor = await db.transaction("outbox").store.index("bySeq").openCursor();
      return cursor?.value;
    },

    async changeSent(change, stored) {
      const tx = db.transaction(["entries", "outbox"], "readwrite");
      const outbox = tx.objectStore("outbox");
      const queued = await outbox.get(change.id);
      if (queued?.seq === change.seq) {
        await outbox.delete(change.id);
        const entries = tx.objectStore("entries");
        // The server's copy, unless the change was a delete (then the entry is gone here too).
        if (stored !== null && stored.deletedAt === null) {
          await entries.put(fromServer(stored));
        } else {
          await entries.delete(change.id);
        }
      }
      await tx.done;
    },

    async changeRefused(change) {
      const tx = db.transaction(["entries", "outbox"], "readwrite");
      const outbox = tx.objectStore("outbox");
      const queued = await outbox.get(change.id);
      if (queued?.seq === change.seq) {
        await outbox.delete(change.id);
        const entries = tx.objectStore("entries");
        const local = await entries.get(change.id);
        if (local) {
          await entries.put({ ...local, notSaved: true });
        }
      }
      await tx.done;
    },

    async applyPull(serverEntries, latestRev) {
      const tx = db.transaction(["entries", "outbox", "meta"], "readwrite");
      const entries = tx.objectStore("entries");
      const outbox = tx.objectStore("outbox");
      for (const incoming of serverEntries) {
        // A change made here and not sent yet wins over what the server had before it.
        if ((await outbox.count(incoming.id)) > 0) continue;
        const local = await entries.get(incoming.id);
        if (local?.rev != null && local.rev >= incoming.rev) continue;
        if (incoming.deletedAt !== null) {
          await entries.delete(incoming.id);
        } else {
          await entries.put(fromServer(incoming));
        }
      }
      const meta = tx.objectStore("meta");
      const seen = (await meta.get("lastRev")) ?? 0;
      await meta.put(Math.max(seen, latestRev), "lastRev");
      await tx.done;
    },

    close: () => {
      db.close();
    },
  };
}
