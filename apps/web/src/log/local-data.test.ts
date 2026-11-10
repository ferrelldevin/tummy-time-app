import { describe, expect, it, vi } from "vitest";
import { LOCAL_DB_NAME, localDataExists } from "./local-data";
import { openLogStore } from "./store";

/** The same database factory with databases() taken away, like a browser that lacks it. */
function withoutDatabases(factory: IDBFactory): IDBFactory {
  return {
    open: factory.open.bind(factory),
    deleteDatabase: factory.deleteDatabase.bind(factory),
    cmp: factory.cmp.bind(factory),
  } as unknown as IDBFactory;
}

async function names(factory: IDBFactory): Promise<(string | undefined)[]> {
  return (await factory.databases()).map((d) => d.name);
}

describe("localDataExists: is there a copy of the log on this phone, without making one", () => {
  it("no: and it does not create the database", async () => {
    expect(await localDataExists(indexedDB)).toBe(false);
    expect(await names(indexedDB)).toEqual([]);
  });

  it("yes, once sync has opened it", async () => {
    const store = await openLogStore(() => undefined);
    store.close();
    expect(await localDataExists(indexedDB)).toBe(true);
  });

  describe("in a browser without indexedDB.databases()", () => {
    it("no: and the open it tries leaves no empty database behind", async () => {
      const real = indexedDB;
      expect(await localDataExists(withoutDatabases(real))).toBe(false);
      expect(await names(real)).toEqual([]);
      // Asking twice gives the same answer: the first ask made nothing.
      expect(await localDataExists(withoutDatabases(real))).toBe(false);
    });

    it("yes, once sync has opened it, and the database is left as it was", async () => {
      const store = await openLogStore(() => undefined);
      store.close();
      expect(await localDataExists(withoutDatabases(indexedDB))).toBe(true);
      // Still the log's own database, with its stores.
      const reopened = await openLogStore(() => undefined);
      expect(await reopened.pendingCount()).toBe(0);
      reopened.close();
      expect(await names(indexedDB)).toEqual([LOCAL_DB_NAME]);
    });
  });

  it("a browser with no IndexedDB at all has no copy", async () => {
    vi.stubGlobal("indexedDB", undefined);
    try {
      expect(await localDataExists()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
