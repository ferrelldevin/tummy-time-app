import type { SyncState } from "../../log/engine";
import { en } from "../../strings/en";

/**
 * The sync state in plain words. A polite live region: a screen reader says it when the words
 * change, after what it is reading now. Retries do not change the words, so they are not
 * announced again and again.
 */
export function SyncStatusLine({ state }: { state: SyncState }) {
  return (
    <p role="status" className="sync-status">
      {state.ready ? en.log.sync[state.status] : ""}
    </p>
  );
}
