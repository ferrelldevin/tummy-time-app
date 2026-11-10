import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { LOG_MAX_DURATION_SECONDS, LOG_MIN_DURATION_SECONDS } from "@tummy/shared";
import { Button } from "../../components/Button";
import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { clockText, fill, lengthText } from "../../log/format";
import { startLogSync } from "../../log/local-data";
import { elapsedSeconds, timer } from "../../log/timer";
import { useLogSync } from "../../log/useLogSync";
import { en } from "../../strings/en";
import { SyncStatusLine } from "./SyncStatusLine";

const t = en.startTummyTime;

/**
 * One large Start / Stop and save control and the running time. The time is a role="timer"
 * region with aria-live="off": a screen reader can read it at any moment, but is not
 * interrupted every second. Starting and saving are each announced once, politely.
 */
export function StartTummyTime() {
  const { state } = useLogSync();
  const { startedAtMs } = useSyncExternalStore(timer.subscribe, timer.get);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const labelId = useId();

  useEffect(() => {
    if (startedAtMs === null) return;
    setNow(Date.now());
    // Only redraws the screen. The time itself is always worked out from the start time.
    const handle = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(handle);
    };
  }, [startedAtMs]);

  const seconds = startedAtMs === null ? 0 : elapsedSeconds(startedAtMs, now);

  async function toggle() {
    if (startedAtMs === null) {
      timer.start(Date.now());
      setMessage(t.started);
      return;
    }
    const done = timer.stop(Date.now());
    if (done === null) return;
    const total = Math.floor(done.elapsedMs / 1000);
    if (total < LOG_MIN_DURATION_SECONDS) {
      setMessage(t.tooShort);
      return;
    }
    if (total > LOG_MAX_DURATION_SECONDS) {
      setMessage(t.tooLong);
      return;
    }
    setBusy(true);
    try {
      const sync = await startLogSync();
      await sync.add({
        startedAt: new Date(done.startedAtMs).toISOString(),
        durationSeconds: total,
      });
      setMessage(fill(t.saved, { time: lengthText(total) }));
    } catch {
      setMessage(en.account.errors.unexpected);
    } finally {
      setBusy(false);
    }
  }

  const running = startedAtMs !== null;
  return (
    <Page title={t.title}>
      <SyncStatusLine state={state} />
      <div className="timer-panel">
        <p className="timer-panel__label" id={labelId}>
          {t.timeLabel}
        </p>
        <div role="timer" aria-live="off" aria-labelledby={labelId} className="timer-panel__time">
          <span aria-hidden="true">{clockText(seconds)}</span>
          <span className="visually-hidden">{lengthText(seconds)}</span>
        </div>
        <Button
          block
          className="timer-panel__button"
          variant={running ? "secondary" : "primary"}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {running ? t.stop : t.start}
        </Button>
      </div>
      <p role="status" className="timer-panel__message">
        {message}
      </p>
      {message === t.tooLong ? (
        <Link to="/log/add" appearance="secondary" block>
          {t.addInstead}
        </Link>
      ) : null}
      <Link to="/log" appearance="secondary" block>
        {t.seeLog}
      </Link>
    </Page>
  );
}
