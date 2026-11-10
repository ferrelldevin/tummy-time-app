import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../../components/Button";
import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import type { LocalEntry } from "../../log/store";
import {
  dayHeading,
  entryText,
  fill,
  lengthText,
  localDayKey,
  timeOfDayText,
} from "../../log/format";
import { useLogSync } from "../../log/useLogSync";
import { en } from "../../strings/en";
import { SyncStatusLine } from "./SyncStatusLine";

const t = en.log;

interface DayGroup {
  key: string;
  heading: string;
  entries: LocalEntry[];
}

/** Entries are already newest first; this cuts them into days on this phone's own calendar. */
function byDay(entries: LocalEntry[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const start = new Date(entry.startedAt);
    const key = localDayKey(start);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, heading: dayHeading(start, now), entries: [entry] });
    }
  }
  return groups;
}

const deleteButtonId = (id: string) => `delete-${id}`;

/**
 * The log: every tummy time on this phone, by day, newest first. Delete has an Undo that stays
 * until the next delete or undo, or until the person leaves the screen (WCAG 2.2.1: no time
 * limit). Focus goes to Undo after a delete, and back to the entry after Undo.
 */
export function LogPage() {
  const { sync, state, failed } = useLogSync();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<LocalEntry | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);

  // Arrived from "Add a time" after saving: say so in the live region (written after the
  // screen appears, so a screen reader announces it), and forget it so a reload does not repeat it.
  const arrivedSaved = (location.state as { saved?: boolean } | null)?.saved === true;
  useEffect(() => {
    if (!arrivedSaved) return;
    setNotice(t.savedFlash);
    void navigate(location.pathname, { replace: true, state: null });
  }, [arrivedSaved, navigate, location.pathname]);

  useEffect(() => {
    if (undo) undoRef.current?.focus();
  }, [undo]);

  useEffect(() => {
    if (focusId === null || !state.entries.some((e) => e.id === focusId)) return;
    document.getElementById(deleteButtonId(focusId))?.focus();
    setFocusId(null);
  }, [focusId, state.entries]);

  async function remove(entry: LocalEntry) {
    if (sync === null) return;
    const removed = await sync.remove(entry.id);
    if (removed === undefined) return;
    setUndo(removed);
    setNotice(
      fill(t.deleted, { entry: entryText(new Date(removed.startedAt), removed.durationSeconds) }),
    );
  }

  async function putBack() {
    if (sync === null || undo === null) return;
    const entry = undo;
    await sync.restore(entry);
    setUndo(null);
    setFocusId(entry.id);
    setNotice(
      fill(t.putBack, { entry: entryText(new Date(entry.startedAt), entry.durationSeconds) }),
    );
  }

  let body;
  if (failed) {
    body = (
      <ErrorState
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  } else if (!state.ready) {
    body = <LoadingState />;
  } else if (state.entries.length === 0) {
    body = <EmptyState title={t.emptyTitle} body={t.emptyBody} />;
  } else {
    body = byDay(state.entries, new Date()).map((group) => (
      <section key={group.key} aria-labelledby={`day-${group.key}`} className="log-day">
        <h2 id={`day-${group.key}`}>{group.heading}</h2>
        <ul className="log-list">
          {group.entries.map((entry) => {
            const start = new Date(entry.startedAt);
            return (
              <li key={entry.id} className="log-entry">
                <p className="log-entry__text">
                  <span className="log-entry__time">{timeOfDayText(start)}</span>{" "}
                  <span>{lengthText(entry.durationSeconds)}</span>
                </p>
                {entry.notSaved ? <p className="log-entry__warning">{t.notSaved}</p> : null}
                <Button
                  variant="secondary"
                  id={deleteButtonId(entry.id)}
                  onClick={() => void remove(entry)}
                >
                  {t.delete}{" "}
                  <span className="visually-hidden">{entryText(start, entry.durationSeconds)}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
    ));
  }

  return (
    <Page title={t.title}>
      <SyncStatusLine state={state} />
      <Link to="/start-tummy-time" appearance="primary" block large>
        {t.start}
      </Link>
      <Link to="/log/add" appearance="secondary" block>
        {t.add}
      </Link>
      <div className="log-notice">
        <p role="status">{notice}</p>
        {undo ? (
          <Button variant="secondary" ref={undoRef} onClick={() => void putBack()}>
            {t.undo}
          </Button>
        ) : null}
      </div>
      {body}
    </Page>
  );
}
