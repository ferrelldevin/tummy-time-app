import { useEffect, useState, useSyncExternalStore } from "react";
import type { LogSync, SyncState } from "./engine";
import { startLogSync } from "./local-data";

const NOT_READY: SyncState = { ready: false, entries: [], pending: 0, status: "saved" };
const noSubscribe = () => () => undefined;

/** The running sync engine and its state, for the log screens. */
export function useLogSync(): { sync: LogSync | null; state: SyncState; failed: boolean } {
  const [sync, setSync] = useState<LogSync | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    startLogSync().then(
      (engine) => {
        if (live) setSync(engine);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  const state = useSyncExternalStore(sync ? sync.subscribe : noSubscribe, () =>
    sync ? sync.getState() : NOT_READY,
  );
  return { sync, state, failed };
}
